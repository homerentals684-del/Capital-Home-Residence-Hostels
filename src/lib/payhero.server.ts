const BASE = "https://backend.payhero.co.ke/api/v2";

function creds() {
  const token = process.env["PAYHERO_AUTH_TOKEN"];
  const channel = process.env["PAYHERO_CHANNEL_ID"];
  if (!token || !channel) throw new Error("Payments are not configured yet.");
  return { auth: token.startsWith("Basic ") ? token : `Basic ${token}`, channel: Number(channel) };
}

export function paymentsConfigured() {
  return Boolean(process.env["PAYHERO_AUTH_TOKEN"] && process.env["PAYHERO_CHANNEL_ID"]);
}

/** Send an M-Pesa STK push. Amount is whole KES. */
export async function payheroStkPush(input: { amountKsh: number; phone: string; reference: string; customerName: string; callbackUrl: string }) {
  const { auth, channel } = creds();
  const res = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: input.amountKsh,
      phone_number: input.phone.startsWith("254") ? "0" + input.phone.slice(3) : input.phone,
      channel_id: channel,
      provider: "m-pesa",
      external_reference: input.reference,
      customer_name: input.customerName.slice(0, 60),
      callback_url: input.callbackUrl,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; status?: string; reference?: string; CheckoutRequestID?: string; error_message?: string; message?: string };
  return { ok: res.ok && json.success !== false && Boolean(json.reference), status: json.status ?? "", providerReference: json.reference ?? null, message: json.error_message ?? json.message ?? "" };
}

export async function payheroStatus(providerReference: string) {
  const { auth } = creds();
  const res = await fetch(`${BASE}/transaction-status?reference=${encodeURIComponent(providerReference)}`, { headers: { Authorization: auth } });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as { status?: string; amount?: number; provider_reference?: string; transaction_date?: string; result_desc?: string } | null;
}

/** Verify with PayHero and settle the attempt. Safe to call repeatedly. */
export async function reconcileReference(reference: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: attempt } = await supabaseAdmin.from("payment_attempts").select("status, provider_reference").eq("reference", reference).maybeSingle();
  if (!attempt) return "not_found";
  if (attempt.status !== "pending") return attempt.status === "success" ? "already_processed" : attempt.status;
  if (!attempt.provider_reference) return "pending";
  const tx = await payheroStatus(attempt.provider_reference);
  if (!tx) return "pending";
  const s = (tx.status ?? "").toUpperCase();
  if (s === "SUCCESS") {
    const { data, error } = await supabaseAdmin.rpc("finalize_payment", {
      _reference: reference,
      _amount_cents: Math.round((tx.amount ?? 0) * 100),
      _currency: "KES",
      _paystack_id: 0,
      _paid_at: tx.transaction_date ? new Date(tx.transaction_date).toISOString() : new Date().toISOString(),
    });
    if (error) throw new Error("Could not record payment");
    if (tx.provider_reference) await supabaseAdmin.from("payment_attempts").update({ provider_message: `M-Pesa ${tx.provider_reference}` }).eq("reference", reference);
    return data as string;
  }
  if (s === "FAILED" || s === "CANCELLED") {
    await supabaseAdmin.from("payment_attempts")
      .update({ status: "failed", provider_status: s.toLowerCase(), provider_message: tx.result_desc ?? null, updated_at: new Date().toISOString() })
      .eq("reference", reference).eq("status", "pending");
    return "failed";
  }
  return "pending";
}
