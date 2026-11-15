import { normalizeKePhone } from "./format";
import { PAYMENT_ORIGINS } from "./payment-contract";
import { roomPayRequestSchema } from "./room-pay-contract";
import { pushForCharge } from "./payments-service.server";
import { reconcileReference } from "./payhero.server";

/** Public room QR payments: the tenant proves identity by the phone registered to that room. */
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

    const phone = normalizeKePhone(req.phone);
    if (!phone) return reply({ error: "Enter a valid Safaricom number." }, 400);
    const { data: tenancies } = await supabaseAdmin.from("tenancies").select("id, user_id").eq("room_id", room.id).eq("status", "active");
    const ids = (tenancies ?? []).map((t) => t.user_id);
    const { data: profiles } = ids.length ? await supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", ids) : { data: [] };
    const tenant = (profiles ?? []).find((p) => normalizeKePhone(p.phone ?? "") === phone);
    if (!tenant) return reply({ error: "This number is not registered to an active tenant of this room." }, 404);
    const tenancy = tenancies!.find((t) => t.user_id === tenant.id)!;
    const { data: charge } = await supabaseAdmin.from("rent_charges").select("id, amount_cents, paid_cents, due_date")
      .eq("tenancy_id", tenancy.id).neq("status", "paid").order("due_date").limit(1).maybeSingle();
    if (req.action === "lookup") {
      return reply({ firstName: (tenant.full_name ?? "").split(" ")[0], outstandingCents: charge ? charge.amount_cents - charge.paid_cents : 0, dueDate: charge?.due_date ?? null });
    }
    if (!charge) return reply({ ok: false, error: "You have no outstanding rent." });
    // Anyone (parent, friend) may pay; money is still recorded on this tenant's room charge.
    const payer = req.payerPhone ? normalizeKePhone(req.payerPhone) : phone;
    if (!payer) return reply({ ok: false, error: "Enter a valid M-Pesa number for the payer." });
    return reply(await pushForCharge({ chargeId: charge.id, userId: tenant.id, phone: payer, mode: req.mode, amountKsh: req.amountKsh, source: "room_qr" }));
  } catch (e) {
    console.error("Room pay failed", e instanceof Error ? e.name : "UnknownError");
    return reply({ error: "Payment service unavailable. Please try again shortly." }, 503);
  }
}
