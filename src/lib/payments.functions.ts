import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { startPaymentSchema, referenceSchema } from "./payment-contract";

export const startMpesaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => startPaymentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { startPayment } = await import("./payments-service.server");
    return startPayment(data, context);
  });

export const checkPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => referenceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { checkPayment } = await import("./payments-service.server");
    return checkPayment(data, context);
  });

export const adminReconcile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => referenceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { reconcilePayment } = await import("./payments-service.server");
    return reconcilePayment(data, context);
  });
