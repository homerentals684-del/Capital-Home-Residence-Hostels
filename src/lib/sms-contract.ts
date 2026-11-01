import { z } from "zod";
import { PAYMENT_ORIGINS, PAYMENT_SERVICE_ORIGIN } from "./payment-contract";
export type SmsRecipient = {
  userId: string;
  name: string;
  phone: string;
  room: string;
  residence: string;
  semester: string;
  dueDate: string;
  balanceCents: number;
  paidCents: number;
  totalCents: number;
  status: string;
};

export const sendSchema = z.object({
  recipientIds: z.array(z.string().uuid()).min(1).max(200),
  message: z.string().trim().min(5).max(900),
  kind: z.enum(["custom", "rent_reminder"]).default("custom"),
});


export const smsRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("recipients") }),
  z.object({ action: z.literal("history") }),
  z.object({ action: z.literal("send"), data: sendSchema }),
]);
export type SmsSendInput = z.infer<typeof sendSchema>;
export function smsEndpoint(origin: string) {
  if (!PAYMENT_ORIGINS.has(origin)) throw new Error("SMS is not enabled for this website address.");
  return `${origin === "https://capital-home-residence-hostels.vercel.app" ? PAYMENT_SERVICE_ORIGIN : origin}/api/public/sms`;
}
