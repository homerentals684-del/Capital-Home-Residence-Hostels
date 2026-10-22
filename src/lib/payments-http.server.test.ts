// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), start: vi.fn(), check: vi.fn(), reconcile: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("./payments-service.server", () => ({ startPayment: mocks.start, checkPayment: mocks.check, reconcilePayment: mocks.reconcile }));
import { handlePaymentRequest } from "./payments-http.server";

const origin = "https://capital-home-residence-hostels.vercel.app";
function request(body: unknown, authenticated = true) {
  return new Request("http://localhost/api/public/payments", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...(authenticated ? { Authorization: "Bearer test.session.token" } : {}) },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://backend.example");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-public");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-private");
  vi.stubEnv("PAYSTACK_SECRET_KEY", "test-paystack");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "tenant-1" } }, error: null });
});
describe("authenticated cross-host payments", () => {
  it("allows Vercel preflight without credentials", async () => {
    const r = await handlePaymentRequest(new Request("http://localhost/api/public/payments", { method: "OPTIONS", headers: { Origin: origin } }));
    expect(r.status).toBe(204);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("rejects unapproved origins", async () => {
    const r = await handlePaymentRequest(new Request("http://localhost/api/public/payments", { method: "OPTIONS", headers: { Origin: "https://attacker.example" } }));
    expect(r.status).toBe(403);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
  it("does not start a payment without a session", async () => {
    expect((await handlePaymentRequest(request({}, false))).status).toBe(401);
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("rejects a session the backend cannot verify", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    expect((await handlePaymentRequest(request({ action: "check", data: { reference: "CHR-123" } })))).status).toBe(401);
    expect(mocks.check).not.toHaveBeenCalled();
  });
  it("passes validated Vercel STK details and verified identity to the same payment logic", async () => {
    const data = { chargeId: "11111111-1111-4111-8111-111111111111", mode: "partial", amountKsh: 10, phone: "0712345678" };
    mocks.start.mockResolvedValue({ ok: true, reference: "CHR-123", status: "pending", displayText: "Confirm on phone" });
    const r = await handlePaymentRequest(request({ action: "start", data }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, reference: "CHR-123", status: "pending", displayText: "Confirm on phone" });
    expect(mocks.start).toHaveBeenCalledWith(data, expect.objectContaining({ userId: "tenant-1" }));
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
  it("uses the same confirmation logic for Vercel polling", async () => {
    mocks.check.mockResolvedValue({ status: "success" });
    const r = await handlePaymentRequest(request({ action: "check", data: { reference: "CHR-123" } }));
    expect(await r.json()).toEqual({ status: "success" });
    expect(mocks.check).toHaveBeenCalledWith({ reference: "CHR-123" }, expect.objectContaining({ userId: "tenant-1" }));
  });
  it("preserves the admin permission check", async () => {
    mocks.reconcile.mockRejectedValue(new Error("Forbidden"));
    expect((await handlePaymentRequest(request({ action: "reconcile", data: { reference: "CHR-123" } })))).status).toBe(403);
  });
});