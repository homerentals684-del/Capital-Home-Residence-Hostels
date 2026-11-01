import { beforeEach, expect, it, vi } from "vitest";
import { sendSms, getSmsRecipients, type SmsContext } from "./sms-service.server";

const provider = vi.hoisted(() => vi.fn());
vi.mock("./africastalking.server", () => ({ sendAfricasTalkingSms: provider }));
beforeEach(() => vi.resetAllMocks());
it("rejects non-admins before reading tenants or sending SMS", async () => {
  const from = vi.fn();
  const context = { userId: "tenant", supabase: { rpc: vi.fn().mockResolvedValue({ data: false }), from } } as unknown as SmsContext;
  await expect(getSmsRecipients(context)).rejects.toThrow("Forbidden");
  expect(from).not.toHaveBeenCalled();
  expect(provider).not.toHaveBeenCalled();
});
it("blocks two selected recipients until a provider-accepted test exists", async () => {
  const limit = vi.fn().mockResolvedValue({ data: [], error: null });
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(), limit };
  const context = { userId: "admin", supabase: { rpc: vi.fn().mockResolvedValue({ data: true }), from: vi.fn().mockReturnValue(query) } } as unknown as SmsContext;
  await expect(sendSms({ recipientIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"], message: "Rent reminder", kind: "custom" }, context)).rejects.toThrow("Send a successful single-tenant test before bulk SMS.");
  expect(provider).not.toHaveBeenCalled();
});