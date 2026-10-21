const BASE = "https://api.paystack.co";

function key() {
  const k = process.env["PAYSTACK_SECRET_KEY"];
  if (!k) throw new Error("Payments are not configured yet.");
  return k;
}

export async function paystackCharge(input: { email: string; amountCents: number; phone: string; reference: string; metadata: Record<string, unknown> }) {
  const res = await fetch(`${BASE}/charge`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountCents,
      currency: "KES",
      reference: input.reference,
      mobile_money: { phone: input.phone, provider: "mpesa" },
      metadata: input.metadata,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: { status?: string; display_text?: string; message?: string; id?: number } };
  return { ok: res.ok && json.status === true, message: json.message ?? "", data: json.data ?? {} };
}

export async function paystackVerify(reference: string) {
  const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  const json = (await res.json().catch(() => ({}))) as { status?: boolean; data?: { status?: string; amount?: number; currency?: string; id?: number; paid_at?: string; gateway_response?: string } };
  return json.status ? json.data ?? null : null;
}

export async function verifySignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key()), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/** Verify with Paystack and settle the attempt. Safe to call repeatedly. */
export async function reconcileReference(reference: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tx = await paystackVerify(reference);
  if (!tx) return "not_found";
  if (tx.status === "success") {
    const { data, error } = await supabaseAdmin.rpc("finalize_payment", {
      _reference: reference,
      _amount_cents: tx.amount ?? 0,
      _currency: tx.currency ?? "",
      _paystack_id: tx.id ?? 0,
      _paid_at: tx.paid_at ?? new Date().toISOString(),
    });
    if (error) throw new Error("Could not record payment");
    return data as string;
  }
  if (tx.status === "failed" || tx.status === "abandoned" || tx.status === "reversed") {
    await supabaseAdmin.from("payment_attempts")
      .update({ status: "failed", provider_status: tx.status, provider_message: tx.gateway_response ?? null, updated_at: new Date().toISOString() })
      .eq("reference", reference).eq("status", "pending");
    return "failed";
  }
  return "pending";
}
