/** Standard room name used across all properties, e.g. "Room 7". */
export function roomName(n: number): string {
  return `Room ${n}`;
}

/** Number key of a room name ("Room 07", "Old Room-07", "7" -> 7) so ranges merge with existing rooms. */
export function roomKey(name: string): string {
  const m = name.trim().match(/(\d+)$/);
  return m ? String(parseInt(m[1]!, 10)) : name.trim().toLowerCase();
}

/** Expand a range like "1".."20" or "Room 1".."Room 20" into standard room names ("Room 1".."Room 20"). */
export function expandRoomRange(start: string, end: string, max = 500): string[] {
  const a = start.trim().match(/(\d+)$/);
  const b = end.trim().match(/(\d+)$/);
  if (!a || !b) throw new Error("Room numbers must end with a number, e.g. 1 or Room 1");
  const from = parseInt(a[1]!, 10), to = parseInt(b[1]!, 10);
  if (to < from) throw new Error("Ending room number must be greater than or equal to the starting number");
  if (to - from + 1 > max) throw new Error(`At most ${max} rooms at once`);
  const out: string[] = [];
  for (let n = from; n <= to; n++) out.push(roomName(n));
  return out;
}
