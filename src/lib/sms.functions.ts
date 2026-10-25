import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeKePhone } from "./format";
import { ksh } from "./format";

type AdminContext = {
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
    from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  userId: string;
};

async function requireAdmin(context: AdminContext) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Only administrators can use SMS");
}

export type SmsRecipient = {
  userId: string;
  name: string;
  phone: string;
  room: string;
  residence: string;
  semester: string;
  dueDate: string;
  balanceCents: number;
  paidCents: number;
  totalCents: number;
  status: string;
};

export const listSmsRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context as unknown as AdminContext);
    const { supabase } = context;

    const { data: tenancies, error } = await supabase
      .from("tenancies")
      .select(
        "user_id, status, rooms(room_number, residences(name)), semesters(academic_year, name, rent_due_date), rent_charges(amount_cents, paid_cents, status)",
      )
      .eq("status", "active");
    if (error) throw new Error(error.message);

    const ids = [...new Set((tenancies ?? []).map((t) => t.user_id as string))];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids)
      : { data: [] };

    const recipients: SmsRecipient[] = [];
    for (const t of tenancies ?? []) {
      const p = profiles?.find((x: { id: string }) => x.id === t.user_id);
      const phone = normalizeKePhone(p?.phone ?? "");
      if (!phone) continue; // skip tenants without a valid Kenyan number
      const charges = (t.rent_charges ?? []) as { amount_cents: number; paid_cents: number; status: string }[];
      const total = charges.reduce((s, c) => s + c.amount_cents, 0);
      const paid = charges.reduce((s, c) => s + c.paid_cents, 0);
      const sem = t.semesters as { academic_year: string; name: string; rent_due_date: string } | null;
      const room = t.rooms as { room_number: string; residences: { name: string } | null } | null;
      recipients.push({
        userId: t.user_id as string,
        name: p?.full_name ?? "Tenant",
        phone,
        room: room?.room_number ?? "",
        residence: room?.residences?.name ?? "",
        semester: sem ? `${sem.academic_year} ${sem.name}` : "",
        dueDate: sem?.rent_due_date ?? "",
        balanceCents: total - paid,
        paidCents: paid,
        totalCents: total,
        status: total - paid <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid",
      });
    }
    return recipients.sort((a, b) => a.name.localeCompare(b.name));
  });

const sendSchema = z.object({
  recipientIds: z.array(z.string().uuid()).min(1).max(200),
  message: z.string().trim().min(5).max(900),
  kind: z.enum(["custom", "rent_reminder"]).default("custom"),
});

const DEDUPE_WINDOW_HOURS = 24;

export const sendSmsMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => sendSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context as unknown as AdminContext);
    const { supabase, userId } = context;
    const { sendAfricasTalkingSms } = await import("./africastalking.server");

    // Load the selected tenants with their balances for personalization.
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", data.recipientIds);
    const { data: tenancies } = await supabase
      .from("tenancies")
      .select("user_id, semesters(rent_due_date), rent_charges(amount_cents, paid_cents)")
      .eq("status", "active")
      .in("user_id", data.recipientIds);

    const results: { userId: string; name: string; phone: string; outcome: "sent" | "failed" | "skipped"; detail?: string }[] = [];
    const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 3600 * 1000).toISOString();

    for (const id of data.recipientIds) {
      const p = profiles?.find((x: { id: string }) => x.id === id);
      const phone = normalizeKePhone(p?.phone ?? "");
      const name = p?.full_name ?? "Tenant";
      if (!phone) {
        results.push({ userId: id, name, phone: p?.phone ?? "", outcome: "skipped", detail: "No valid Kenyan phone number" });
        continue;
      }

      const t = tenancies?.find((x: { user_id: string }) => x.user_id === id);
      const charges = (t?.rent_charges ?? []) as { amount_cents: number; paid_cents: number }[];
      const total = charges.reduce((s, c) => s + c.amount_cents, 0);
      const paid = charges.reduce((s, c) => s + c.paid_cents, 0);
      const balance = total - paid;
      const sem = t?.semesters as { rent_due_date: string } | null;

      // Personalize template tokens.
      const message = data.message
        .replaceAll("{name}", name.split(" ")[0] ?? name)
        .replaceAll("{balance}", ksh(balance))
        .replaceAll("{paid}", ksh(paid))
        .replaceAll("{due}", sem?.rent_due_date ?? "the due date")
        .replaceAll("{status}", balance <= 0 ? "paid in full" : paid > 0 ? "partially paid" : "unpaid");

      // Prevent duplicate sends: same phone + same message within the window.
      const { data: dupes } = await supabase
        .from("sms_messages")
        .select("id")
        .eq("phone", phone)
        .eq("message", message)
        .in("status", ["sent", "pending"])
        .gte("created_at", dedupeSince)
        .limit(1);
      if (dupes && dupes.length > 0) {
        results.push({ userId: id, name, phone, outcome: "skipped", detail: "Same message already sent in the last 24 hours" });
        continue;
      }

      const { data: row, error: insErr } = await supabase
        .from("sms_messages")
        .insert({ recipient_user_id: id, phone, message, kind: data.kind, status: "pending", sent_by: userId })
        .select("id")
        .single();
      if (insErr || !row) {
        results.push({ userId: id, name, phone, outcome: "failed", detail: insErr?.message ?? "Could not log message" });
        continue;
      }

      const r = await sendAfricasTalkingSms(phone, message);
      await supabase
        .from("sms_messages")
        .update({ status: r.status, provider_id: r.messageId ?? null, cost_cents: r.costCents ?? null, error: r.error ?? null })
        .eq("id", row.id);
      results.push({ userId: id, name, phone, outcome: r.ok ? "sent" : "failed", detail: r.error });
    }

    return {
      sent: results.filter((r) => r.outcome === "sent").length,
      failed: results.filter((r) => r.outcome === "failed").length,
      skipped: results.filter((r) => r.outcome === "skipped").length,
      results,
    };
  });

export const listSmsHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context as unknown as AdminContext);
    const { supabase } = context;
    const { data, error } = await supabase
      .from("sms_messages")
      .select("id, phone, message, kind, status, cost_cents, error, created_at, recipient_user_id")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const ids = [...new Set((data ?? []).map((m) => m.recipient_user_id).filter(Boolean))] as string[];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] };
    return (data ?? []).map((m) => ({
      ...m,
      name: profiles?.find((p: { id: string }) => p.id === m.recipient_user_id)?.full_name ?? "",
    }));
  });
