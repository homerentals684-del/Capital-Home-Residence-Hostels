import { describe, expect, it } from "vitest";
import { paymentEndpoint, PAYMENT_SERVICE_ORIGIN, paymentRequestSchema } from "./payment-contract";

describe("shared payment routing", () => {
  it("sends Vercel payments to the trusted Lovable service", () => {
    expect(paymentEndpoint("https://capital-home-residence-hostels.vercel.app")).toBe(`${PAYMENT_SERVICE_ORIGIN}/api/public/payments`);
  });
  it("keeps Lovable payment requests on the Lovable host", () => {
    expect(paymentEndpoint("https://capital-home-residence-hostels.lovable.app")).toBe("https://capital-home-residence-hostels.lovable.app/api/public/payments");
  });
  it("never forwards a session to an arbitrary website", () => {
    expect(() => paymentEndpoint("https://attacker.example")).toThrow();
  });
  it("rejects invalid payment actions", () => {
    expect(paymentRequestSchema.safeParse({ action: "finalize", data: { reference: "CHR-123" } }).success).toBe(false);
  });
});