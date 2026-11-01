import { describe, it, expect } from "vitest";
import { smsEndpoint, sendSchema } from "./sms-contract";
import { PAYMENT_SERVICE_ORIGIN } from "./payment-contract";
describe("SMS routing and validation", () => {
  it("forwards Vercel only to the fixed trusted SMS host", () => {
    expect(smsEndpoint("https://capital-home-residence-hostels.vercel.app")).toBe(`${PAYMENT_SERVICE_ORIGIN}/api/public/sms`);
    expect(() => smsEndpoint("https://attacker.example")).toThrow();
  });
  it("requires selected tenant IDs and limits messages to 900 characters", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(sendSchema.safeParse({ recipientIds: [], message: "Hello" }).success).toBe(false);
    expect(sendSchema.safeParse({ recipientIds: [id], message: "x".repeat(901) }).success).toBe(false);
    expect(sendSchema.safeParse({ recipientIds: [id], message: "x".repeat(900) }).success).toBe(true);
  });
});
