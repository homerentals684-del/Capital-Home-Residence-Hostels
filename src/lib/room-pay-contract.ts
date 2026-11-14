import { z } from "zod";
import { PAYMENT_ORIGINS, PAYMENT_SERVICE_ORIGIN } from "./payment-contract";

/** Permanent public address printed on each room's wall QR code. */
export const ROOM_QR_BASE = "https://capital-home-residence-hostels.lovable.app/r/";
export const roomQrUrl = (roomId: string) => ROOM_QR_BASE + roomId;

const roomId = z.string().uuid();
const phone = z.string().min(9).max(16);
export const roomPayRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("info"), roomId }),
  z.object({ action: z.literal("lookup"), roomId, phone }),
  z.object({ action: z.literal("start"), roomId, phone, mode: z.enum(["full", "partial"]), amountKsh: z.number().int().positive().max(1_000_000).optional() }),
  z.object({ action: z.literal("check"), reference: z.string().min(5).max(64) }),
]);
export type RoomPayRequest = z.infer<typeof roomPayRequestSchema>;

export function roomPayEndpoint(origin: string) {
  if (!PAYMENT_ORIGINS.has(origin)) throw new Error("Payments are not enabled for this website address.");
  return `${origin === "https://capital-home-residence-hostels.vercel.app" ? PAYMENT_SERVICE_ORIGIN : origin}/api/public/room-pay`;
}
