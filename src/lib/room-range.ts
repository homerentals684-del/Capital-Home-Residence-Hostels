/** Expand a room range like "1".."20", "01".."20" or "A-01".."A-20" into room numbers. */
export function expandRoomRange(start: string, end: string, max = 500): string[] {
  const a = start.trim().match(/^(.*?)(\d+)$/);
  const b = end.trim().match(/^(.*?)(\d+)$/);
  if (!a || !b) throw new Error("Room numbers must end with a number, e.g. 1 or A-01");
  if (a[1] !== b[1]) throw new Error("Start and end must use the same prefix");
  const from = parseInt(a[2]!, 10), to = parseInt(b[2]!, 10);
  if (to < from) throw new Error("Ending room number must be greater than or equal to the starting number");
  if (to - from + 1 > max) throw new Error(`At most ${max} rooms at once`);
  const width = a[2]!.startsWith("0") ? a[2]!.length : 0;
  const out: string[] = [];
  for (let n = from; n <= to; n++) out.push(a[1] + String(n).padStart(width, "0"));
  return out;
}
