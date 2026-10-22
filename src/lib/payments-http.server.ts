import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PAYMENT_ORIGINS, paymentRequestSchema } from "./payment-contract";
import { checkPayment, reconcilePayment, startPayment } from "./payments-service.server";

export async function handlePaymentRequest(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  if (origin && !PAYMENT_ORIGINS.has(origin)) return Response.json({ error: "Website not allowed." }, { status: 403, headers });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return reply({ error: "Sign in required." }, 401);
  const token = auth.slice(7);
  if (token.length > 8192 || token.split(".").length !== 3) return reply({ error: "Sign in required." }, 401);
  // Secrets stay on the Lovable host; Vercel sends only the caller's session.
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key || !process.env["PAYSTACK_SECRET_KEY"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    console.error("Payment service configuration incomplete");
    return reply({ error: "Payments are not configured on the payment service yet." }, 503);
  }
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth }, fetch: (input, init) => {
      const h = new Headers(init?.headers);
      h.set("apikey", key);
      h.set("Authorization", auth);
      return fetch(input, { ...init, headers: h });
    } },
  });
  try {
    const { data: userData, error: authError } = await client.auth.getUser(token);
    if (authError || !userData.user) return reply({ error: "Sign in required." }, 401);
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: "Payment request too large." }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: "Invalid payment request." }, 400); }
    const parsed = paymentRequestSchema.safeParse(body);
    if (!parsed.success) return reply({ error: "Invalid payment details." }, 400);
    const context = { supabase: client, userId: userData.user.id };
    switch (parsed.data.action) {
      case "start": return reply(await startPayment(parsed.data.data, context));
      case "check": return reply(await checkPayment(parsed.data.data, context));
      case "reconcile": return reply(await reconcilePayment(parsed.data.data, context));
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") return reply({ error: "Permission denied." }, 403);
    // Don't log session tokens, phone numbers, or request bodies.
    console.error("Payment service request failed", error instanceof Error ? error.name : "UnknownError");
    return reply({ error: "Payment service unavailable. Please try again shortly." }, 503);
  }
}