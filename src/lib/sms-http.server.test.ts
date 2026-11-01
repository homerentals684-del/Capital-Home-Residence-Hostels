import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), send: vi.fn(), recipients: vi.fn(), history: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("./sms-service.server", () => ({ sendSms: mocks.send, getSmsRecipients: mocks.recipients, getSmsHistory: mocks.history }));
import { handleSmsRequest } from "./sms-http.server";

const origin = "https://capital-home-residence-hostels.vercel.app";
function request(body: unknown, authenticated = true) {
  return new Request("http://localhost/api/public/sms", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...(authenticated ? { Authorization: "Bearer test.session.token" } : {}) },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://backend.example");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-public");
  vi.stubEnv("AFRICASTALKING_USERNAME", "test-username");
  vi.stubEnv("AFRICASTALKING_API_KEY", "test-paystack");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "tenant-1" } }, error: null });
});
describe("authenticated cross-host payments", () => {
  it("allows Vercel preflight without credentials", async () => {
    const r = await handleSmsRequest(new Request("http://localhost/api/public/sms", { method: "OPTIONS", headers: { Origin: origin } }));
    expect(r.status).toBe(204);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("rejects unapproved origins", async () => {
    const r = await handleSmsRequest(new Request("http://localhost/api/public/sms", { method: "OPTIONS", headers: { Origin: "https://attacker.example" } }));
    expect(r.status).toBe(403);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
  it("does not start a payment without a session", async () => {
    expect((await handleSmsRequest(request({}, false))).status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects a session the backend cannot verify", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    const response = await handleSmsRequest(request({ action: "history" }));
    expect(response.status).toBe(401);
    expect(mocks.history).not.toHaveBeenCalled();
  });
  it("passes only validated selected tenant SMS to the shared sender", async () => {
    const data = { recipientIds: ["11111111-1111-4111-8111-111111111111"], message: "A real test message", kind: "custom" };
    mocks.send.mockResolvedValue({ sent: 1, failed: 0, skipped: 0 });
    const r = await handleSmsRequest(request({ action: "send", data }));
    expect(r.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(data, expect.objectContaining({ userId: "tenant-1" }));
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
  it("denies tenant access to recipient details", async () => {
    mocks.recipients.mockRejectedValue(new Error("Forbidden"));
    expect((await handleSmsRequest(request({ action: "recipients" }))).status).toBe(403);
  });
  it("rejects bulk sending before a successful test", async () => {
    mocks.send.mockRejectedValue(new Error("Send a successful single-tenant test before bulk SMS."));
    const r = await handleSmsRequest(request({ action: "send", data: { recipientIds: ["11111111-1111-4111-8111-111111111111"], message: "Hello tenant" } }));
    expect(r.status).toBe(409);
  });
});
