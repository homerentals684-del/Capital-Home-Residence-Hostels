import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Smartphone, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/app/AppShell";
import { ksh } from "@/lib/format";
import { startMpesaPayment, checkPaymentStatus } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/pay")({
  head: () => ({
    meta: [
      { title: "Pay Rent — Capital Home Residence" },
      { name: "description", content: "Pay your semester rent via M-Pesa." },
      { property: "og:title", content: "Pay Rent — Capital Home Residence" },
      { property: "og:description", content: "Partial or full M-Pesa rent payments." },
    ],
  }),
  component: PayPage,
});

function PayPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const start = useServerFn(startMpesaPayment);
  const check = useServerFn(checkPaymentStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["pay-info", user.id],
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("full_name, email, phone").eq("id", user.id).single();
      const { data: c } = await supabase.from("rent_charges")
        .select("id, reference, amount_cents, paid_cents, due_date, status, rooms(room_number, residences(name)), semesters(academic_year, name), tenancies!inner(status)")
        .eq("user_id", user.id).eq("tenancies.status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return { p, c };
    },
  });
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ reference: string; text: string } | null>(null);
  const [result, setResult] = useState<"success" | "failed" | null>(null);

  useEffect(() => { if (data?.p?.phone && !phone) setPhone("0" + data.p.phone.slice(3)); }, [data, phone]);

  useEffect(() => {
    if (!pending) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const r = await check({ data: { reference: pending.reference } }).catch(() => ({ status: "pending" }));
      if (r.status === "success" || r.status === "failed" || r.status === "unmatched" || tries > 40) {
        clearInterval(t);
        setPending(null);
        setResult(r.status === "success" ? "success" : r.status === "pending" ? null : "failed");
        if (r.status === "pending") setError("Still waiting for M-Pesa confirmation. Check Payment History shortly.");
        qc.invalidateQueries();
      }
    }, 5000);
    return () => clearInterval(t);
  }, [pending, check, qc]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  const c = data?.c;
  const outstanding = c ? c.amount_cents - c.paid_cents : 0;
  const payCents = mode === "full" ? outstanding : Math.round(Number(amount) || 0) * 100;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!c) return;
    setError(""); setResult(null);
    if (mode === "partial" && (payCents <= 0 || payCents >= outstanding)) return setError("Enter an amount above zero and below your balance.");
    setBusy(true);
    const r = await start({ data: { chargeId: c.id, mode, amountKsh: mode === "partial" ? payCents / 100 : undefined, phone } }).catch(() => ({ ok: false as const, error: "Payment service unavailable." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (r.status === "success") { setResult("success"); qc.invalidateQueries(); return; }
    setPending({ reference: r.reference, text: r.displayText });
  }

  return (
    <AppShell title="Pay Rent" name={data?.p?.full_name}>
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Back to dashboard</Link>
      {!c ? (
        <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">You have no rent charge to pay.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl bg-gradient-navy p-6 text-primary-foreground shadow-elegant">
            <p className="text-sm text-primary-foreground/70">Payment summary</p>
            <dl className="mt-4 space-y-2 text-sm">
              {[
                ["Tenant", data?.p?.full_name], ["Email", data?.p?.email],
                ["Room", `${c.rooms?.residences?.name} · ${c.rooms?.room_number}`],
                ["Semester", `${c.semesters?.academic_year} ${c.semesters?.name}`],
                ["Charge ref", c.reference], ["Semester rent", ksh(c.amount_cents)], ["Verified payments", ksh(c.paid_cents)],
              ].map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-primary-foreground/10 pb-2"><dt className="text-primary-foreground/70">{k}</dt><dd className="text-right">{v}</dd></div>)}
            </dl>
            <p className="mt-6 text-sm text-primary-foreground/70">Outstanding balance</p>
            <p className="font-display text-5xl text-gold">{ksh(outstanding)}</p>
          </div>
          <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-6">
            <h1 className="flex items-center gap-2 text-3xl font-semibold"><Smartphone className="h-7 w-7 text-gold" />M-Pesa payment</h1>
            {outstanding <= 0 ? <p className="text-leaf font-medium">This charge is fully paid. Thank you!</p> : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {(["full", "partial"] as const).map((m) => (
                    <button type="button" key={m} onClick={() => setMode(m)} className={`rounded-xl border-2 p-4 text-left transition ${mode === m ? "border-primary bg-secondary" : "border-border"}`}>
                      <p className="font-semibold">{m === "full" ? "Full payment" : "Partial payment"}</p>
                      <p className="text-xs text-muted-foreground">{m === "full" ? ksh(outstanding) : "Pay any amount"}</p>
                    </button>
                  ))}
                </div>
                {mode === "partial" && (
                  <div className="space-y-1.5"><Label>Amount (KSh)</Label><Input type="number" min={1} max={outstanding / 100 - 1} value={amount} onChange={(e) => setAmount(e.target.value)} />
                    {payCents > 0 && payCents < outstanding && <p className="text-xs text-muted-foreground">Balance after payment: {ksh(outstanding - payCents)}</p>}
                  </div>
                )}
                <div className="space-y-1.5"><Label>M-Pesa phone number</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" /><p className="text-xs text-muted-foreground">Only for this payment — your profile number won't change. We never ask for your PIN.</p></div>
                <div className="rounded-lg bg-muted p-3 text-sm">You will pay <strong>{ksh(payCents > 0 ? payCents : 0)}</strong> via M-Pesa.</div>
                {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                {pending && <div className="flex gap-3 rounded-lg bg-accent p-4 text-sm"><Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" /><div><p className="font-medium">Waiting for confirmation…</p><p className="text-muted-foreground">{pending.text}</p></div></div>}
                {result === "success" && <p className="flex items-center gap-2 font-medium text-leaf"><CheckCircle2 />Payment confirmed. <Link to="/payments" className="underline">View receipt</Link></p>}
                {result === "failed" && <p className="flex items-center gap-2 text-destructive"><XCircle />Payment was not completed. Your balance is unchanged.</p>}
                <Button type="submit" size="lg" variant="gold" className="w-full" disabled={busy || !!pending}>{busy && <Loader2 className="animate-spin" />}Send M-Pesa request</Button>
              </>
            )}
          </form>
        </div>
      )}
    </AppShell>
  );
}
