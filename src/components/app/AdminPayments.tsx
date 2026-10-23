import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ksh } from "@/lib/format";
import { adminReconcile } from "@/lib/payments-client";

const statuses = ["all", "pending", "success", "failed", "unmatched"] as const;

type Attempt = {
  id: string; reference: string; user_id: string; amount_cents: number; phone: string;
  status: string; provider_message: string | null; created_at: string; name: string;
  rent_charges?: { reference: string; rooms?: { room_number: string } | null } | null;
  payments?: { receipt_number: string }[] | { receipt_number: string } | null;
};

export function AdminPayments({ limit }: { limit?: number }) {
  const qc = useQueryClient();
  const reconcile = adminReconcile;
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { data } = useQuery({
    queryKey: ["admin-attempts"],
    queryFn: async () => {
      const { data: a } = await supabase.from("payment_attempts")
        .select("id, reference, user_id, amount_cents, phone, status, provider_message, created_at, rent_charges(reference, rooms(room_number)), payments(receipt_number)")
        .order("created_at", { ascending: false }).limit(500);
      const ids = [...new Set((a ?? []).map((x) => x.user_id))];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      return (a ?? []).map((x) => ({ ...x, name: profs?.find((p) => p.id === x.user_id)?.full_name ?? "" })) as Attempt[];
    },
  });
  const rows = useMemo(() => (data ?? []).filter((r) => (status === "all" || r.status === status) &&
    (!q || `${r.name} ${r.reference} ${r.phone} ${r.rent_charges?.rooms?.room_number}`.toLowerCase().includes(q.toLowerCase()))), [data, status, q]);

  const groups = useMemo(() => {
    const map = new Map<string, { userId: string; name: string; room: string; attempts: Attempt[] }>();
    for (const r of rows) {
      let g = map.get(r.user_id);
      if (!g) { g = { userId: r.user_id, name: r.name, room: r.rent_charges?.rooms?.room_number ?? "", attempts: [] }; map.set(r.user_id, g); }
      g.attempts.push(r);
      if (!g.room && r.rent_charges?.rooms?.room_number) g.room = r.rent_charges.rooms.room_number;
    }
    const all = [...map.values()].sort((a, b) => b.attempts[0].created_at.localeCompare(a.attempts[0].created_at));
    return limit ? all.slice(0, limit) : all;
  }, [rows, limit]);

  function exportCsv() {
    const head = ["tenant", "room", "date", "amount_ksh", "phone", "reference", "status", "receipt"];
    const lines = groups.flatMap((g) => g.attempts.map((r) => {
      const pay = Array.isArray(r.payments) ? r.payments[0] : r.payments;
      return [g.name, g.room, r.created_at, r.amount_cents / 100, r.phone, r.reference, r.status, pay?.receipt_number ?? ""]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",");
    }));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "payments.csv"; a.click(); URL.revokeObjectURL(url);
  }

  async function recheck(reference: string) {
    try {
      const r = await reconcile({ data: { reference } });
      toast.success(`Status: ${r.status}`);
      qc.invalidateQueries();
    } catch { toast.error("Could not check with Paystack"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {statuses.map((s) => <Button key={s} size="sm" variant={status === s ? "default" : "outline"} className="capitalize" onClick={() => setStatus(s)}>{s}</Button>)}
        <Input className="ml-auto w-64" placeholder="Search tenant, room, reference" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button size="sm" variant="outline" onClick={exportCsv}><Download />Export CSV</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Tenant</th><th>Room</th><th>Transactions</th><th>Paid</th><th>Last attempt</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {groups.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No transactions.</td></tr>}
            {groups.map((g) => {
              const paid = g.attempts.filter((a) => a.status === "success").reduce((s, a) => s + a.amount_cents, 0);
              const last = g.attempts[0];
              const isOpen = open[g.userId] ?? false;
              return (
                <Fragment key={g.userId}>
                  <tr className="cursor-pointer border-t hover:bg-muted/50" onClick={() => setOpen({ ...open, [g.userId]: !isOpen })}>
                    <td className="p-3">
                      <span className="flex items-center gap-2 font-medium">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        {g.name || "Unknown tenant"}
                      </span>
                    </td>
                    <td>{g.room || "—"}</td>
                    <td>{g.attempts.length}</td>
                    <td className="font-medium">{ksh(paid)}</td>
                    <td>{new Date(last.created_at).toLocaleString("en-KE")}</td>
                    <td><Badge variant={last.status === "success" ? "default" : last.status === "pending" ? "secondary" : "destructive"} className="capitalize">{last.status}</Badge></td>
                    <td></td>
                  </tr>
                  {isOpen && g.attempts.map((r) => {
                    const pay = Array.isArray(r.payments) ? r.payments[0] : r.payments;
                    return (
                      <tr key={r.id} className="border-t bg-muted/30 text-muted-foreground">
                        <td className="p-3 pl-10">{new Date(r.created_at).toLocaleString("en-KE")}</td>
                        <td>{r.rent_charges?.rooms?.room_number}</td>
                        <td className="font-mono text-xs">{r.reference}</td>
                        <td className="font-medium text-foreground">{ksh(r.amount_cents)}</td>
                        <td>{pay?.receipt_number ?? "—"}</td>
                        <td><Badge variant={r.status === "success" ? "default" : r.status === "pending" ? "secondary" : "destructive"} className="capitalize" title={r.provider_message ?? ""}>{r.status}</Badge></td>
                        <td>{(r.status === "pending" || r.status === "failed") && <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); recheck(r.reference); }}><RefreshCw />Re-check</Button>}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {limit && <p className="text-xs text-muted-foreground">Showing the {limit} tenants with the most recent activity — open Payments for the full list.</p>}
    </div>
  );
}
