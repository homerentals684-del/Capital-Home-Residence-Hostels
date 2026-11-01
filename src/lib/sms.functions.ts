import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendSchema } from "./sms-contract";
export type { SmsRecipient } from "./sms-contract";

export const listSmsRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getSmsRecipients } = await import("./sms-service.server");
    return getSmsRecipients(context);
  });

export const sendSmsMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => sendSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { sendSms } = await import("./sms-service.server");
    return sendSms(data, context);
  });

export const listSmsHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getSmsHistory } = await import("./sms-service.server");
    return getSmsHistory(context);
  });
