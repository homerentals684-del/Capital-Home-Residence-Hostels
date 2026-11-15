import { z } from "zod";

// One trusted host owns PayHero credentials and verified settlement for both sites.
export const PAYMENT_SERVICE_ORIGIN = "https://project--f75de88d-4c49-43a5-9d77-d7cd290225f7.lovable.app";
export const PAYMENT_PATH = "/api/public/payments";
export const PAYMENT_ORIGINS = new Set([
  PAYMENT_SERVICE_ORIGIN,
  "https://capital-home-residence-hostels.lovable.app",
  "https://capital-home-residence-hostels.vercel.app",
  "https://capital-home-residence-hostel.vercel.app",
  "https://id-preview--f75de88d-4c49-43a5-9d77-d7cd290225f7.lovable.app",
  "https://project--f75de88d-4c49-43a5-9d77-d7cd290225f7-dev.lovable.app",
  "http://localhost:8080",
]);

/** External hosts (e.g. Vercel) that cannot hold server secrets forward to the trusted Lovable host. */
export const FORWARDED_ORIGINS = new Set([
  "https://capital-home-residence-hostels.vercel.app",
  "https://capital-home-residence-hostel.vercel.app",
]);
export const serviceBase = (origin: string) => (FORWARDED_ORIGINS.has(origin) ? PAYMENT_SERVICE_ORIGIN : origin);

export const startPaymentSchema = z.object({
  chargeId: z.string().uuid(),
  mode: z.enum(["full", "partial"]),
  amountKsh: z.number().int().positive().optional(),
  phone: z.string().min(9).max(16),
});
export const referenceSchema = z.object({ reference: z.string().min(5).max(64) });
export const paymentRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), data: startPaymentSchema }),
  z.object({ action: z.literal("check"), data: referenceSchema }),
  z.object({ action: z.literal("reconcile"), data: referenceSchema }),
]);

export type StartPaymentInput = z.infer<typeof startPaymentSchema>;
export type StartPaymentResult = { ok: false; error: string } | { ok: true; reference: string; status: string; displayText: string };

export function paymentEndpoint(origin: string) {
  if (!PAYMENT_ORIGINS.has(origin)) throw new Error("Payments are not enabled for this website address.");
  return `${serviceBase(origin)}${PAYMENT_PATH}`;
}