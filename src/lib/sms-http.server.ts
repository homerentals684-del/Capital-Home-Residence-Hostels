import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PAYMENT_ORIGINS } from "./payment-contract";
import { smsRequestSchema } from "./sms-contract";
import { getSmsRecipients, getSmsHistory, sendSms } from "./sms-service.server";

export async function handleSmsRequest(request: Request): Promise<Response> {
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
  if (!url || !key || !process.env["AFRICASTALKING_API_KEY"] || !process.env["AFRICASTALKING_USERNAME"]) {
    console.error("SMS service configuration incomplete");
    return reply({ error: "SMS is not configured on the messaging service yet." }, 503);
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
    if (raw.length > 16384) return reply({ error: "SMS request too large." }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: "Invalid SMS request." }, 400); }
    const parsed = smsRequestSchema.safeParse(body);
    if (!parsed.success) return reply({ error: "Invalid SMS details." }, 400);
    const context = { supabase: client, userId: userData.user.id };
    switch (parsed.data.action) {
      case "recipients": return reply(await getSmsRecipients(context));
      case "history": return reply(await getSmsHistory(context));
      case "send": return reply(await sendSms(parsed.data.data, context));
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") return reply({ error: "Permission denied." }, 403);
    if (error instanceof Error && error.message === "Send a successful single-tenant test before bulk SMS.") return reply({ error: error.message }, 409);
    // Don't log session tokens, phone numbers, or request bodies.
    console.error("SMS service request failed", error instanceof Error ? error.name : "UnknownError");
    return reply({ error: "SMS service unavailable. Please try again shortly." }, 503);
  }
}