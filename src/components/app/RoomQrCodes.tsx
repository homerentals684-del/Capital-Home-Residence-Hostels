import { useEffect, useState } from "react";
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

  const download = (r: Room) => {
    const a = document.createElement("a"); a.href = cards[r.id]!; a.download = `room-${r.room_number}-pay-qr.png`; a.click();
  };
  const pdf = async (list: Room[], name: string) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    list.forEach((r, i) => {
      if (i) doc.addPage();
      // A4 210x297; card ratio 12:17 → 180x255 centred.
      doc.addImage(cards[r.id]!, "PNG", 15, 21, 180, 255);
    });
    doc.save(name);
  };
  const printAll = () => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html><head><title>Room QR codes</title><style>body{margin:0}img{width:48%;margin:1%;page-break-inside:avoid}</style></head><body>${rooms.map((r) => `<img src="${cards[r.id]}"/>`).join("")}</body></html>`);
    w.document.close(); setTimeout(() => w.print(), 500);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Each code is permanent for its room — tenants scan it, pick the tenant, enter any M-Pesa number and get an M-Pesa prompt.</p>
        <div className="flex gap-2"><Button variant="outline" onClick={() => pdf(rooms, "all-room-qr-codes.pdf")} disabled={Object.keys(cards).length !== rooms.length}><FileDown />Download all (PDF)</Button><Button variant="gold" onClick={printAll} disabled={Object.keys(cards).length !== rooms.length}><Printer />Print all</Button></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rooms.map((r) => (
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
