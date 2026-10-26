// Server-only Africa's Talking SMS client. Production endpoint only — never sandbox.
// Credentials come from server secrets (AFRICASTALKING_API_KEY, AFRICASTALKING_USERNAME)
// and are read inside the function, never at module scope.

const AT_ENDPOINT = "https://api.africastalking.com/version1/messaging";

export type AtSmsResult = {
  ok: boolean;
  status: string;
  messageId?: string | undefined;
  costCents?: number | null | undefined;
  error?: string | undefined;
};

export async function sendAfricasTalkingSms(to: string, message: string): Promise<AtSmsResult> {
  const apiKey = process.env["AFRICASTALKING_API_KEY"];
  const username = process.env["AFRICASTALKING_USERNAME"];
  if (!apiKey || !username) {
    return { ok: false, status: "failed", error: "SMS service is not configured" };
  }

  const body = new URLSearchParams({ username, to: `+${to}`, message });
  let res: Response;
  try {
    res = await fetch(AT_ENDPOINT, {
      method: "POST",
      headers: {
        apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch {
    return { ok: false, status: "failed", error: "Could not reach the SMS service" };
  }

  const json = (await res.json().catch(() => null)) as {
    SMSMessageData?: {
      Message?: string;
      Recipients?: { status?: string; messageId?: string; cost?: string }[];
    };
  } | null;

  const recipient = json?.SMSMessageData?.Recipients?.[0];
  if (!res.ok || !recipient) {
    return {
      ok: false,
      status: "failed",
      error: json?.SMSMessageData?.Message ?? `SMS service error (HTTP ${res.status})`,
    };
  }

  const costMatch = /([\d.]+)/.exec(recipient.cost ?? "");
  const success = recipient.status === "Success";
  return {
    ok: success,
    status: success ? "sent" : "failed",
    messageId: recipient.messageId,
    costCents: costMatch ? Math.round(Number(costMatch[1]) * 100) : null,
    error: success ? undefined : (recipient.status ?? "Rejected by SMS service"),
  };
}
