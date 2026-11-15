import { normalizeKePhone } from "./format";
import { PAYMENT_ORIGINS } from "./payment-contract";
import { roomPayRequestSchema } from "./room-pay-contract";
import { pushForCharge } from "./payments-service.server";
import { reconcileReference } from "./payhero.server";

/** Public room QR payments: any M-Pesa number may pay for an active tenant of that room. */
export async function handleRoomPayRequest(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  if (origin && !PAYMENT_ORIGINS.has(origin)) return Response.json({ error: "Website not allowed." }, { status: 403, headers });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  const raw = await request.text();
  if (raw.length > 2048) return reply({ error: "Request too large." }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return reply({ error: "Invalid request." }, 400); }
  const parsed = roomPayRequestSchema.safeParse(body);
  if (!parsed.success) return reply({ error: "Invalid details." }, 400);
  const req = parsed.data;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (req.action === "check") {
      const { data: a } = await supabaseAdmin.from("payment_attempts").select("status, source").eq("reference", req.reference).maybeSingle();
      if (!a || a.source !== "room_qr") return reply({ status: "not_found" });
      if (a.status !== "pending") return reply({ status: a.status });
      const r = await reconcileReference(req.reference).catch(() => "pending");
      return reply({ status: r === "already_processed" ? "success" : r });
    }
    const { data: room } = await supabaseAdmin.from("rooms").select("id, room_number, residences(name)").eq("id", req.roomId).eq("active", true).maybeSingle();
    if (!room) return reply({ error: "Room not found." }, 404);
    const roomInfo = { roomNumber: room.room_number, residence: (room.residences as { name: string } | null)?.name ?? "Capital Home Residence" };
    if (req.action === "info") return reply({ room: roomInfo });

    // No phone matching: whoever scans may pay from any number; money is credited to the chosen tenant's charge.
    const { data: tenancies } = await supabaseAdmin.from("tenancies").select("id, user_id").eq("room_id", room.id).eq("status", "active");
    const ids = (tenancies ?? []).map((t) => t.user_id);
    const { data: profiles } = ids.length ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
    const tenants = await Promise.all((tenancies ?? []).map(async (t) => {
      const { data: charge } = await supabaseAdmin.from("rent_charges").select("id, amount_cents, paid_cents, due_date")
        .eq("tenancy_id", t.id).neq("status", "paid").order("due_date").limit(1).maybeSingle();
      const name = (profiles ?? []).find((p) => p.id === t.user_id)?.full_name ?? "Tenant";
      return { id: t.user_id, firstName: name.split(" ")[0], charge };
    }));
    if (req.action === "lookup") {
      return reply({ tenants: tenants.map((t) => ({ id: t.id, firstName: t.firstName, outstandingCents: t.charge ? t.charge.amount_cents - t.charge.paid_cents : 0, dueDate: t.charge?.due_date ?? null })) });
    }
    const target = tenants.find((t) => t.id === req.tenantId);
    if (!target) return reply({ ok: false, error: "This tenant is not in this room." });
    if (!target.charge) return reply({ ok: false, error: "No outstanding rent." });
    const payer = normalizeKePhone(req.phone);
    if (!payer) return reply({ ok: false, error: "Enter a valid M-Pesa number." });
    return reply(await pushForCharge({ chargeId: target.charge.id, userId: target.id, phone: payer, mode: req.mode, amountKsh: req.amountKsh, source: "room_qr" }));
  } catch (e) {
    console.error("Room pay failed", e instanceof Error ? e.name : "UnknownError");
    return reply({ error: "Payment service unavailable. Please try again shortly." }, 503);
  }
}
