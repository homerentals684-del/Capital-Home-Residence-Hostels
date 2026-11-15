import { z } from "zod";
import { PAYMENT_ORIGINS, serviceBase } from "./payment-contract";

/** Permanent public address printed on each room's wall QR code. */
export const ROOM_QR_BASE = "https://capital-home-residence-hostel.vercel.app/r/";
export const roomQrUrl = (roomId: string) => ROOM_QR_BASE + roomId;

const roomId = z.string().uuid();
const phone = z.string().min(9).max(16);
export const roomPayRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("info"), roomId }),
  z.object({ action: z.literal("lookup"), roomId }),
  z.object({ action: z.literal("start"), roomId, tenantId: z.string().uuid(), phone, mode: z.enum(["full", "partial"]), amountKsh: z.number().int().positive().max(1_000_000).optional() }),
  z.object({ action: z.literal("check"), reference: z.string().min(5).max(64) }),
]);
export type RoomPayRequest = z.infer<typeof roomPayRequestSchema>;

export function roomPayEndpoint(origin: string) {
  if (!PAYMENT_ORIGINS.has(origin)) throw new Error("Payments are not enabled for this website address.");
  return `${serviceBase(origin)}/api/public/room-pay`;
}
