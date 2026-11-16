import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Download, FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roomQrUrl } from "@/lib/room-pay-contract";
import logoUrl from "@/assets/logo.png";

type Room = { id: string; room_number: string; residences?: { name: string } | null };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

/** Builds a high-resolution wall card (PNG data URL) for painting or printing. */
async function buildCard(room: Room) {
  const W = 1200, H = 1700;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  // Canvas output is a printed artefact, so it uses fixed brand print colours.
  ctx.fillStyle = "#0b1f3a";
  ctx.fillRect(0, 0, W, H);
  const logo = await loadImage(logoUrl);
  const lw = 420, lh = (logo.height / logo.width) * lw;
  ctx.drawImage(logo, (W - lw) / 2, 50, lw, lh);
  ctx.textAlign = "center"; ctx.fillStyle = "#d4af37";
  ctx.font = "bold 110px Georgia, serif"; ctx.fillText(`Room ${room.room_number.replace(/^.*Room-?/i, "")}`, W / 2, 140 + lh);
  ctx.fillStyle = "#ffffff"; ctx.font = "40px sans-serif"; ctx.fillText(room.residences?.name ?? "Capital Home Residence", W / 2, 205 + lh);
  const qr = await QRCode.toDataURL(roomQrUrl(room.id), { width: 820, margin: 2, errorCorrectionLevel: "H", color: { dark: "#0b1f3a", light: "#ffffff" } });
  const qi = await loadImage(qr);
  const y = 250 + lh;
  ctx.fillStyle = "#ffffff"; ctx.fillRect((W - 860) / 2, y, 860, 860);
  ctx.drawImage(qi, (W - 820) / 2, y + 20, 820, 820);
  ctx.fillStyle = "#d4af37"; ctx.font = "bold 64px sans-serif"; ctx.fillText("SCAN TO PAY RENT", W / 2, y + 960);
  ctx.fillStyle = "#ffffff"; ctx.font = "36px sans-serif"; ctx.fillText("M-Pesa STK push · No login needed", W / 2, y + 1020);
  return c.toDataURL("image/png");
}

export function RoomQrCodes({ rooms }: { rooms: Room[] }) {
  const [cards, setCards] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const r of rooms) out[r.id] = await buildCard(r);
      if (alive) setCards(out);
    })();
    return () => { alive = false; };
  }, [rooms]);

  const [prop, setProp] = useState("");
  const [q, setQ] = useState("");
  const props = useMemo(() => [...new Set(rooms.map((r) => r.residences?.name ?? "Capital Home Residence"))].sort(), [rooms]);
  const shown = rooms.filter((r) => (!prop || (r.residences?.name ?? "Capital Home Residence") === prop) && (!q || r.room_number.toLowerCase().includes(q.toLowerCase())));
  const ready = shown.length > 0 && shown.every((r) => cards[r.id]);
  const slug = (prop || "all").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const download = (r: Room) => {
    const a = document.createElement("a"); a.href = cards[r.id]!; a.download = `room-${r.room_number}-pay-qr.png`; a.click();
  };
  const pdf = async (list: Room[], name: string) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    // Single room: one full A4 card. Bulk: 4 cards per A4 page (2x2) to save paper.
    if (list.length === 1) doc.addImage(cards[list[0]!.id]!, "PNG", 15, 21, 180, 255);
    else list.forEach((r, i) => {
      if (i && i % 4 === 0) doc.addPage();
      const slot = i % 4, w = 90, h = 127.5; // 12:17 ratio
      doc.addImage(cards[r.id]!, "PNG", 10 + (slot % 2) * (w + 10), 16 + Math.floor(slot / 2) * (h + 10), w, h);
    });
    doc.save(name);
  };
  const printAll = () => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html><head><title>Room QR codes</title><style>body{margin:0}img{width:48%;margin:1%;page-break-inside:avoid}</style></head><body>${shown.map((r) => `<img src="${cards[r.id]}"/>`).join("")}</body></html>`);
    w.document.close(); setTimeout(() => w.print(), 500);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Each code is permanent for its room — tenants scan it, pick the tenant, enter any M-Pesa number and get an M-Pesa prompt.</p>
        <div className="flex gap-2"><Button variant="outline" onClick={() => pdf(shown, `${slug}-room-qr-codes.pdf`)} disabled={!ready}><FileDown />Download {prop ? "property" : "all"} (PDF)</Button><Button variant="gold" onClick={printAll} disabled={!ready}><Printer />Print {prop ? "property" : "all"}</Button></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Filter by property" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={prop} onChange={(e) => setProp(e.target.value)}>
          <option value="">All properties</option>
          {props.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input aria-label="Search room" placeholder="Search room…" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-sm text-muted-foreground">Showing {shown.length} of {rooms.length} rooms</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((r) => (
          <div key={r.id} className="rounded-xl border bg-card p-3">
            {cards[r.id] ? <img src={cards[r.id]} alt={`QR code for ${r.room_number}`} className="w-full rounded-lg" /> : <div className="aspect-[12/17] animate-pulse rounded-lg bg-muted" />}
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => download(r)} disabled={!cards[r.id]}><Download />PNG</Button>
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => pdf([r], `room-${r.room_number}-pay-qr.pdf`)} disabled={!cards[r.id]}><FileDown />PDF</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
