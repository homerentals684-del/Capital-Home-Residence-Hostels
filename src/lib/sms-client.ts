import { supabase } from "@/integrations/supabase/client";
import { smsEndpoint, type SmsSendInput } from "./sms-contract";
import type { getSmsRecipients, getSmsHistory, sendSms } from "./sms-service.server";
export type { SmsRecipient } from "./sms-contract";
async function requestSms<T>(action: "recipients" | "history" | "send", data?: SmsSendInput): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Please sign in again to use SMS.");
  const response = await fetch(smsEndpoint(window.location.origin), {
    method: "POST", credentials: "omit",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, data }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 401 ? "Please sign in again to use SMS." : result?.error ?? "SMS connection unavailable.");
  return result as T;
}
export const listSmsRecipients = () => requestSms<Awaited<ReturnType<typeof getSmsRecipients>>>("recipients");
export const listSmsHistory = () => requestSms<Awaited<ReturnType<typeof getSmsHistory>>>("history");
export const sendSmsMessages = ({ data }: { data: SmsSendInput }) => requestSms<Awaited<ReturnType<typeof sendSms>>>("send", data);
