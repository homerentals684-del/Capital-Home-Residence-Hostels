import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ksh } from "@/lib/format";
import { adminReconcile } from "@/lib/payments-client";

const statuses = ["all", "pending", "success", "failed", "unmatched"] as const;

export function AdminPayments() {
  const qc = useQueryClient();
  const reconcile = adminReconcile;
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-attempts"],
    queryFn: async () => {
      const { data: a } = await supabase.from("payment_attempts")
        .select("id, reference, user_id, amount_cents, phone, status, provider_message, created_at, rent_charges(reference, rooms(room_number)), payments(receipt_number)")
        .order("created_at", { ascending: false }).limit(500);
      const ids = [...new Set((a ?? []).map((x) => x.user_id))];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      return (a ?? []).map((x) => ({ ...x, name: profs?.find((p) => p.id === x.user_id)?.full_name ?? "" }));
    },
  });
  const rows = useMemo(() => (data ?? []).filter((r) => (status === "all" || r.status === status) &&
    (!q || `${r.name} ${r.reference} ${r.phone} ${r.rent_charges?.rooms?.room_number}`.toLowerCase().includes(q.toLowerCase()))), [data, status, q]);

  function exportCsv() {
    const head = ["date", "tenant", "room", "amount_ksh", "phone", "reference", "status", "receipt"];
    const lines = rows.map((r) => {
      const pay = Array.isArray(r.payments) ? r.payments[0] : r.payments;
      return [r.created_at, r.name, r.rent_charges?.rooms?.room_number ?? "", r.amount_cents / 100, r.phone, r.reference, r.status, pay?.receipt_number ?? ""]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",");
    });
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
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Date</th><th>Tenant</th><th>Room</th><th>Amount</th><th>Reference</th><th>Status</th><th>Receipt</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No transactions.</td></tr>}
            {rows.map((r) => {
              const pay = Array.isArray(r.payments) ? r.payments[0] : r.payments;
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{new Date(r.created_at).toLocaleString("en-KE")}</td>
                  <td>{r.name}</td><td>{r.rent_charges?.rooms?.room_number}</td>
                  <td className="font-medium">{ksh(r.amount_cents)}</td>
                  <td className="font-mono text-xs">{r.reference}</td>
                  <td><Badge variant={r.status === "success" ? "default" : r.status === "pending" ? "secondary" : "destructive"} className="capitalize" title={r.provider_message ?? ""}>{r.status}</Badge></td>
                  <td>{pay?.receipt_number ?? "—"}</td>
                  <td>{(r.status === "pending" || r.status === "failed") && <Button size="sm" variant="ghost" onClick={() => recheck(r.reference)}><RefreshCw />Re-check</Button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
