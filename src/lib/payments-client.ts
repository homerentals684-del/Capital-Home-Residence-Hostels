import { supabase } from "@/integrations/supabase/client";
import { paymentEndpoint, type StartPaymentInput, type StartPaymentResult } from "./payment-contract";

async function requestPayment<T>(action: "start" | "check" | "reconcile", data: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Please sign in again before making a payment.");
  const response = await fetch(paymentEndpoint(window.location.origin), {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, data }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(response.status === 401 ? "Please sign in again before making a payment." : result?.error ?? "Payment connection unavailable. Please try again shortly.");
  }
  return result as T;
}

export const startMpesaPayment = ({ data }: { data: StartPaymentInput }) => requestPayment<StartPaymentResult>("start", data);
export const checkPaymentStatus = ({ data }: { data: { reference: string } }) => requestPayment<{ status: string }>("check", data);
export const adminReconcile = ({ data }: { data: { reference: string } }) => requestPayment<{ status: string }>("reconcile", data);