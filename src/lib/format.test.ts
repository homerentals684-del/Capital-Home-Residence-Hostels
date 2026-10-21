import { describe, expect, it } from "vitest";
import { ksh, normalizeKePhone } from "./format";

describe("format", () => {
  it("shows KSh 15,000 for 1,500,000 cents", () => expect(ksh(1500000)).toBe("KSh 15,000"));
  it("accepts Kenyan 07 numbers", () => expect(normalizeKePhone("0712 345 678")).toBe("254712345678"));
  it("accepts +254 numbers", () => expect(normalizeKePhone("+254112345678")).toBe("254112345678"));
  it("rejects bad numbers", () => expect(normalizeKePhone("12345")).toBeNull());
});
