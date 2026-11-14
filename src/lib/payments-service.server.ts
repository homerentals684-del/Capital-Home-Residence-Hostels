import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizeKePhone } from "./format";
import { payheroStkPush, reconcileReference } from "./payhero.server";
import { PAYMENT_SERVICE_ORIGIN, type StartPaymentInput } from "./payment-contract";

export type PaymentContext = { supabase: SupabaseClient<Database>; userId: string };
type PushResult = { ok: false; error: string } | { ok: true; reference: string; status: string; displayText: string };

/** Shared STK push for a verified tenant + charge. Callers must have authorised the tenant. */
export async function pushForCharge(input: { chargeId: string; userId: string; phone: string; mode: "full" | "partial"; amountKsh?: number | undefined; source: "app" | "room_qr" }): Promise<PushResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: pending } = await supabaseAdmin.from("payment_attempts").select("reference").eq("rent_charge_id", input.chargeId).eq("status", "pending");
  for (const p of pending ?? []) await reconcileReference(p.reference).catch(() => null);
  const { count } = await supabaseAdmin.from("payment_attempts").select("id", { count: "exact", head: true })
    .eq("rent_charge_id", input.chargeId).eq("status", "pending").gte("created_at", new Date(Date.now() - 3 * 60_000).toISOString());
  if ((count ?? 0) > 0) return { ok: false, error: "A payment request is already in progress. Complete it on your phone or wait 3 minutes." };

  const { data: fresh } = await supabaseAdmin.from("rent_charges").select("amount_cents, paid_cents").eq("id", input.chargeId).single();
  const outstanding = (fresh?.amount_cents ?? 0) - (fresh?.paid_cents ?? 0);
  if (outstanding < 100) return { ok: false, error: "This rent charge is fully paid." };
  // PayHero takes whole shillings.
  const amountCents = input.mode === "full" ? Math.floor(outstanding / 100) * 100 : (input.amountKsh ?? 0) * 100;
  if (input.mode === "partial" && (amountCents <= 0 || amountCents >= outstanding)) {
    return { ok: false, error: "Partial amount must be more than zero and less than your balance." };
  }

  const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", input.userId).single();
  const reference = `CHR-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const { error: insErr } = await supabaseAdmin.from("payment_attempts").insert({
    reference, user_id: input.userId, rent_charge_id: input.chargeId, amount_cents: amountCents, phone: input.phone, source: input.source,
  });
  if (insErr) return { ok: false, error: "Could not start payment." };

  try {
    const res = await payheroStkPush({
      amountKsh: amountCents / 100, phone: input.phone, reference,
      customerName: profile?.full_name ?? "Tenant",
      callbackUrl: `${PAYMENT_SERVICE_ORIGIN}/api/public/payhero-webhook`,
    });
    await supabaseAdmin.from("payment_attempts").update({
      status: res.ok ? "pending" : "failed",
      provider_status: res.status || null,
      provider_reference: res.providerReference,
      provider_message: res.message || null,
      updated_at: new Date().toISOString(),
    }).eq("reference", reference);
    if (!res.ok) {
      console.error("PayHero STK push failed", res.message);
      return { ok: false, error: "M-Pesa request could not be sent. Please try again." };
    }
    return { ok: true, reference, status: res.status, displayText: "Check your phone and enter your M-Pesa PIN to complete payment." };
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    await supabaseAdmin.from("payment_attempts").update({ status: "failed", provider_message: "Request error" }).eq("reference", reference);
    return { ok: false, error: e instanceof Error && e.message.includes("configured") ? e.message : "Payment service unavailable. Try again shortly." };
  }
}

export async function startPayment(data: StartPaymentInput, context: PaymentContext): Promise<PushResult> {
  const phone = normalizeKePhone(data.phone);
  if (!phone) return { ok: false, error: "Enter a valid Safaricom M-Pesa number." };
  // Read through the caller's RLS: they can only see their own charge.
  const { data: charge } = await context.supabase.from("rent_charges").select("id, user_id, tenancy_id").eq("id", data.chargeId).maybeSingle();
  if (!charge || charge.user_id !== context.userId) return { ok: false, error: "Rent charge not found." };
  const { data: tenancy } = await context.supabase.from("tenancies").select("status").eq("id", charge.tenancy_id).single();
  if (tenancy?.status !== "active") return { ok: false, error: "Your tenancy is not active." };
  return pushForCharge({ chargeId: charge.id, userId: context.userId, phone, mode: data.mode, amountKsh: data.amountKsh, source: "app" });
}

export async function checkPayment(data: { reference: string }, context: PaymentContext) {
  const { data: attempt } = await context.supabase.from("payment_attempts").select("status").eq("reference", data.reference).maybeSingle();
  if (!attempt) return { status: "not_found" };
  if (attempt.status === "pending") {
    const r = await reconcileReference(data.reference).catch(() => "pending");
    return { status: r === "already_processed" ? "success" : r };
  }
  return { status: attempt.status };
}

export async function reconcilePayment(data: { reference: string }, context: PaymentContext) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
  return { status: await reconcileReference(data.reference) };
}
