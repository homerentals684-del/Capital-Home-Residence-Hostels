import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Send, History, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ksh } from "@/lib/format";
import { listSmsRecipients, sendSmsMessages, listSmsHistory, type SmsRecipient } from "@/lib/sms.functions";

const REMINDER_TEMPLATE =
  "Dear {name}, this is a rent reminder from Capital Home Residence. Your balance is {balance} ({status}). Kindly pay by {due}. Thank you.";

export function AdminSms() {
  const [tab, setTab] = useState<"compose" | "history">("compose");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={tab === "compose" ? "default" : "outline"} onClick={() => setTab("compose")}>
          <MessageSquare />Compose
        </Button>
        <Button size="sm" variant={tab === "history" ? "default" : "outline"} onClick={() => setTab("history")}>
          <History />History
        </Button>
      </div>
      {tab === "compose" ? <Compose /> : <SmsHistory />}
    </div>
  );
}

function Compose() {
  const qc = useQueryClient();
  const send = useServerFn(sendSmsMessages);
  const { data: recipients, isLoading } = useQuery({ queryKey: ["sms-recipients"], queryFn: () => listSmsRecipients({ data: {} }) });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [q, setQ] = useState("");
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);
  const [sending, setSending] = useState(false);

  const rows = useMemo(
    () =>
      (recipients ?? []).filter(
        (r) =>
          (!onlyWithBalance || r.balanceCents > 0) &&
          (!q || `${r.name} ${r.phone} ${r.room} ${r.residence}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [recipients, q, onlyWithBalance],
  );
  const selectedIds = rows.filter((r) => selected[r.userId]).map((r) => r.userId);
  const allChecked = rows.length > 0 && rows.every((r) => selected[r.userId]);

  function toggleAll() {
    const next = { ...selected };
    for (const r of rows) next[r.userId] = !allChecked;
    setSelected(next);
  }

  async function doSend() {
    if (selectedIds.length === 0) { toast.error("Select at least one tenant"); return; }
    if (message.trim().length < 5) { toast.error("Write a message first"); return; }
    const label = selectedIds.length === 1 ? "this tenant" : `${selectedIds.length} tenants`;
    if (!window.confirm(`Send this SMS to ${label}? This uses your live Africa's Talking account and real airtime.`)) return;
    setSending(true);
    try {
      const r = await send({ data: { recipientIds: selectedIds, message: message.trim(), kind: "custom" } });
      if (r.sent > 0) toast.success(`${r.sent} message${r.sent === 1 ? "" : "s"} sent`);
      if (r.skipped > 0) toast.message(`${r.skipped} skipped (duplicate or invalid number)`);
      if (r.failed > 0) toast.error(`${r.failed} failed — see History for details`);
      setSelected({});
      qc.invalidateQueries({ queryKey: ["sms-history"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-full sm:w-64" placeholder="Search tenant, room, phone" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={onlyWithBalance} onChange={(e) => setOnlyWithBalance(e.target.checked)} />
            With balance only
          </label>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                <th>Tenant</th><th>Room</th><th>Phone</th><th>Balance</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading tenants…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No tenants match.</td></tr>}
              {rows.map((r: SmsRecipient) => (
                <tr key={r.userId} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => setSelected({ ...selected, [r.userId]: !selected[r.userId] })}>
                  <td className="p-3"><input type="checkbox" checked={!!selected[r.userId]} onChange={() => setSelected({ ...selected, [r.userId]: !selected[r.userId] })} onClick={(e) => e.stopPropagation()} /></td>
                  <td className="font-medium">{r.name}</td>
                  <td className="whitespace-nowrap">{r.room}<span className="block text-xs text-muted-foreground">{r.residence}</span></td>
                  <td className="whitespace-nowrap">+{r.phone}</td>
                  <td className={`font-medium ${r.balanceCents > 0 ? "text-gold" : "text-leaf"}`}>{ksh(r.balanceCents)}</td>
                  <td><Badge variant={r.status === "paid" ? "default" : r.status === "partial" ? "secondary" : "destructive"} className="capitalize">{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">{selectedIds.length} of {rows.length} tenants selected.</p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setMessage(REMINDER_TEMPLATE)}>
              <Sparkles />Rent reminder template
            </Button>
            <span className="text-xs text-muted-foreground">Tokens: {"{name} {balance} {paid} {due} {status}"}</span>
          </div>
          <textarea
            className="min-h-40 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Type your message…"
            value={message}
            maxLength={900}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{message.length}/900 characters</span>
            <Button onClick={doSend} disabled={sending || selectedIds.length === 0}>
              <Send />{sending ? "Sending…" : `Send to ${selectedIds.length || ""} tenant${selectedIds.length === 1 ? "" : "s"}`}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Messages go through your live Africa's Talking account. Identical messages to the same number within 24 hours are skipped automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

function SmsHistory() {
  const { data, isLoading } = useQuery({ queryKey: ["sms-history"], queryFn: () => listSmsHistory({ data: {} }) });
  const totalCost = (data ?? []).reduce((s, m) => s + (m.cost_cents ?? 0), 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {(data ?? []).length} messages · Total cost reported by provider: {ksh(totalCost)}
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Date</th><th>Tenant</th><th>Phone</th><th>Message</th><th>Status</th><th>Cost</th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No messages sent yet.</td></tr>}
            {(data ?? []).map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{new Date(m.created_at).toLocaleString("en-KE")}</td>
                <td className="font-medium">{m.name || "—"}</td>
                <td className="whitespace-nowrap">+{m.phone}</td>
                <td className="max-w-xs"><p className="truncate" title={m.message}>{m.message}</p>{m.error && <p className="text-xs text-destructive">{m.error}</p>}</td>
                <td><Badge variant={m.status === "sent" ? "default" : m.status === "pending" ? "secondary" : "destructive"} className="capitalize">{m.status}</Badge></td>
                <td>{m.cost_cents != null ? ksh(m.cost_cents) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
