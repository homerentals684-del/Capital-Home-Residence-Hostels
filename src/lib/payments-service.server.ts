import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizeKePhone } from "./format";
import { paystackCharge, reconcileReference } from "./paystack.server";
import type { StartPaymentInput } from "./payment-contract";

export type PaymentContext = { supabase: SupabaseClient<Database>; userId: string };

export async function startPayment(data: StartPaymentInput, context: PaymentContext) {
    const phone = normalizeKePhone(data.phone);
    if (!phone) return { ok: false as const, error: "Enter a valid Safaricom M-Pesa number." };

    // Read through the caller's RLS: they can only see their own charge.
    const { data: charge } = await context.supabase.from("rent_charges").select("id, user_id, amount_cents, paid_cents, status, tenancy_id").eq("id", data.chargeId).maybeSingle();
    if (!charge || charge.user_id !== context.userId) return { ok: false as const, error: "Rent charge not found." };
    const { data: tenancy } = await context.supabase.from("tenancies").select("status").eq("id", charge.tenancy_id).single();
    if (tenancy?.status !== "active") return { ok: false as const, error: "Your tenancy is not active." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Settle any stale pending attempts first, then block concurrent ones.
    const { data: pending } = await supabaseAdmin.from("payment_attempts").select("reference, created_at").eq("rent_charge_id", charge.id).eq("status", "pending");
    for (const p of pending ?? []) await reconcileReference(p.reference).catch(() => null);
    const { count } = await supabaseAdmin.from("payment_attempts").select("id", { count: "exact", head: true })
      .eq("rent_charge_id", charge.id).eq("status", "pending").gte("created_at", new Date(Date.now() - 3 * 60_000).toISOString());
    if ((count ?? 0) > 0) return { ok: false as const, error: "A payment request is already in progress. Complete it on your phone or wait 3 minutes." };

    const { data: fresh } = await supabaseAdmin.from("rent_charges").select("amount_cents, paid_cents").eq("id", charge.id).single();
    const outstanding = (fresh?.amount_cents ?? 0) - (fresh?.paid_cents ?? 0);
    if (outstanding <= 0) return { ok: false as const, error: "This rent charge is fully paid." };
    const amountCents = data.mode === "full" ? outstanding : (data.amountKsh ?? 0) * 100;
    if (data.mode === "partial" && (amountCents <= 0 || amountCents >= outstanding)) {
      return { ok: false as const, error: "Partial amount must be more than zero and less than your balance." };
    }

    const { data: profile } = await supabaseAdmin.from("profiles").select("email, full_name").eq("id", context.userId).single();
    const reference = `CHR-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const { error: insErr } = await supabaseAdmin.from("payment_attempts").insert({
      reference, user_id: context.userId, rent_charge_id: charge.id, amount_cents: amountCents, phone,
    });
    if (insErr) return { ok: false as const, error: "Could not start payment." };

    try {
      const res = await paystackCharge({
        email: profile?.email ?? "", amountCents, phone: `+${phone}`, reference,
        metadata: { rent_charge_id: charge.id, tenant: profile?.full_name },
      });
      const status = res.data.status ?? "";
      const failed = !res.ok || status === "failed";
      await supabaseAdmin.from("payment_attempts").update({
        status: failed ? "failed" : "pending",
        provider_status: status || null,
        display_text: res.data.display_text ?? null,
        provider_message: res.data.message ?? res.message ?? null,
        paystack_id: res.data.id ?? null,
        updated_at: new Date().toISOString(),
      }).eq("reference", reference);
      if (failed) {
        console.error("Paystack charge failed", res.message);
        return { ok: false as const, error: "M-Pesa request could not be sent. Please try again." };
      }
      if (status === "success") await reconcileReference(reference);
      return { ok: true as const, reference, status, displayText: res.data.display_text ?? "Check your phone and enter your M-Pesa PIN to complete payment." };
    } catch (e) {
      console.error(e);
      await supabaseAdmin.from("payment_attempts").update({ status: "failed", provider_message: "Request error" }).eq("reference", reference);
      return { ok: false as const, error: e instanceof Error && e.message.includes("configured") ? e.message : "Payment service unavailable. Try again shortly." };
    }
}

export async function checkPayment(data: { reference: string }, context: PaymentContext) {
    const { data: attempt } = await context.supabase.from("payment_attempts").select("status, user_id").eq("reference", data.reference).maybeSingle();
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
