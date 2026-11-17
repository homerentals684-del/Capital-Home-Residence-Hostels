import { describe, it, expect } from "vitest";
import { expandRoomRange } from "./room-range";
describe("expandRoomRange", () => {
  it("generates every room in range", () => expect(expandRoomRange("1", "5")).toEqual(["1","2","3","4","5"]));
  it("keeps prefix and zero padding", () => expect(expandRoomRange("A-08", "A-10")).toEqual(["A-08","A-09","A-10"]));
  it("rejects end before start", () => expect(() => expandRoomRange("10", "2")).toThrow());
  it("rejects mismatched prefixes", () => expect(() => expandRoomRange("A-1", "B-3")).toThrow());
});
