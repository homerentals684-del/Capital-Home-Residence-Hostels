import { describe, it, expect } from "vitest";
import { expandRoomRange, roomKey } from "./room-range";

describe("room range", () => {
  it("names rooms Room N", () => {
    expect(expandRoomRange("1", "3")).toEqual(["Room 1", "Room 2", "Room 3"]);
  });
  it("merges with existing rooms: 7 existing + range 1-10 adds 3", () => {
    const existing = new Set(["Room 1","Room 2","Room 3","Room 4","Room 5","Room 6","Room 7"].map(roomKey));
    const add = expandRoomRange("1", "10").filter((n) => !existing.has(roomKey(n)));
    expect(add).toEqual(["Room 8", "Room 9", "Room 10"]);
  });
  it("treats old names as the same room", () => {
    expect(roomKey("Old Room-07")).toBe(roomKey("Room 7"));
  });
  it("rejects reversed ranges", () => {
    expect(() => expandRoomRange("5", "2")).toThrow();
  });
});
