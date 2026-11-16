import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Smartphone, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ksh } from "@/lib/format";
import { roomPayEndpoint, type RoomPayRequest } from "@/lib/room-pay-contract";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/r/$roomId")({
  head: () => ({
    meta: [
      { title: "Pay Room Rent — Capital Home Residence" },
      { name: "description", content: "Scan and pay your room rent by M-Pesa from any number." },
      { property: "og:title", content: "Pay Room Rent — Capital Home Residence" },
      { property: "og:description", content: "Quick M-Pesa rent payment for your room." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomPay,
});

async function call<T>(body: RoomPayRequest): Promise<T> {
  const res = await fetch(roomPayEndpoint(window.location.origin), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Connection problem. Try again.");
  return json as T;
}

function RoomPay() {
  const { roomId } = Route.useParams();
  const [room, setRoom] = useState<{ roomNumber: string; residence: string } | null>(null);
  const [roomError, setRoomError] = useState("");
  const [phone, setPhone] = useState("");
  type T = { id: string; firstName: string; outstandingCents: number; dueDate: string | null };
  const [tenants, setTenants] = useState<T[] | null>(null);
  const [tenantId, setTenantId] = useState("");
  const tenant = tenants?.find((t) => t.id === tenantId) ?? null;
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<"success" | "failed" | null>(null);

  useEffect(() => {
    call<{ room: { roomNumber: string; residence: string } }>({ action: "info", roomId }).then((r) => setRoom(r.room)).catch((e: Error) => setRoomError(e.message));
    call<{ tenants: T[] }>({ action: "lookup", roomId }).then((r) => { setTenants(r.tenants); if (r.tenants.length === 1) setTenantId(r.tenants[0]!.id); }).catch(() => setTenants([]));
  }, [roomId]);

  useEffect(() => {
    if (!pending) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const r = await call<{ status: string }>({ action: "check", reference: pending }).catch(() => ({ status: "pending" }));
      if (r.status !== "pending" || tries > 120) {
        clearInterval(t); setPending(null);
        if (r.status === "success") setResult("success");
        else if (r.status === "pending") setError("Still waiting for M-Pesa. Your balance updates once confirmed.");
        else setResult("failed");
      }
    }, 1500);
    return () => clearInterval(t);
  }, [pending]);

  async function pay(e: React.FormEvent) {
    e.preventDefault(); if (!tenant) return; setError(""); setResult(null);
    const amountKsh = mode === "partial" ? Math.round(Number(amount)) : undefined;
    if (!phone.trim()) return setError("Enter the M-Pesa number to pay from.");
    if (mode === "partial" && (!amountKsh || amountKsh * 100 >= tenant.outstandingCents)) return setError("Enter an amount above zero and below your balance.");
    setBusy(true);
    try {
      const r = await call<{ ok: boolean; error?: string; reference?: string }>({ action: "start", roomId, tenantId: tenant.id, phone, mode, amountKsh });
      if (!r.ok || !r.reference) setError(r.error ?? "Could not send M-Pesa request."); else setPending(r.reference);
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-gradient-navy px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex flex-col items-center text-center text-primary-foreground">
          <img src={logo} alt="Capital Home Residence" className="h-20 w-auto" />
          {room ? <><p className="mt-3 text-sm text-primary-foreground/70">{room.residence}</p><h1 className="font-display text-4xl text-gold">Room {room.roomNumber}</h1></> : !roomError && <Loader2 className="mt-4 animate-spin" />}
        </div>
        <div className="rounded-2xl bg-card p-6 shadow-elegant">
          {roomError ? <p className="text-center text-destructive">{roomError}</p> : !tenants ? <Loader2 className="mx-auto animate-spin" /> : tenants.length === 0 ? (
            <p className="text-center text-muted-foreground">No active tenant in this room yet.</p>
          ) : !tenant ? (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Smartphone className="h-5 w-5 text-gold" />Who are you paying for?</h2>
              {tenants.map((t) => <Button key={t.id} variant="outline" size="lg" className="w-full justify-between" onClick={() => setTenantId(t.id)}><span>{t.firstName}</span><span>{ksh(t.outstandingCents)}</span></Button>)}
            </div>
          ) : result === "success" ? (
            <div className="space-y-3 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-leaf" /><p className="text-xl font-semibold">Payment confirmed</p><p className="text-sm text-muted-foreground">Thank you, {tenant.firstName}. Your receipt is in your dashboard.</p></div>
          ) : tenant.outstandingCents <= 0 ? (
            <p className="text-center font-medium text-leaf">Hi {tenant.firstName}, you have no outstanding rent. Thank you!</p>
          ) : (
            <form onSubmit={pay} className="space-y-4">
              <p>Hi <strong>{tenant.firstName}</strong>, your balance is</p>
              <p className="font-display text-5xl text-primary">{ksh(tenant.outstandingCents)}</p>
              {tenant.dueDate && <p className="text-xs text-muted-foreground">Due {new Date(tenant.dueDate).toLocaleDateString("en-KE")}</p>}
              <div className="grid grid-cols-2 gap-3">
                {(["full", "partial"] as const).map((m) => (
                  <button type="button" key={m} onClick={() => setMode(m)} className={`rounded-xl border-2 p-3 text-left text-sm ${mode === m ? "border-primary bg-secondary" : "border-border"}`}>
                    <p className="font-semibold">{m === "full" ? "Pay full" : "Pay part"}</p>
                  </button>
                ))}
              </div>
              {mode === "partial" && <div className="space-y-1.5"><Label htmlFor="amt">Amount (KSh)</Label><Input id="amt" type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>}
              <div className="space-y-1.5"><Label htmlFor="payer">M-Pesa number to pay from</Label><Input id="payer" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" /><p className="text-xs text-muted-foreground">Any Safaricom number — yours, a parent's or a friend's. The payment is recorded for this room.</p></div>
              {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              {pending && <div className="flex gap-3 rounded-lg bg-accent p-3 text-sm"><Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />Check the paying phone and enter the M-Pesa PIN.</div>}
              {result === "failed" && <p className="flex items-center gap-2 text-sm text-destructive"><XCircle className="h-4 w-4" />Payment not completed. Your balance is unchanged.</p>}
              <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy || !!pending}>{busy && <Loader2 className="animate-spin" />}Send M-Pesa request</Button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-primary-foreground/60">We never ask for your M-Pesa PIN on this page.</p>
      </div>
    </main>
  );
}
