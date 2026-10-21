import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/app/AppShell";
import { ksh } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payment History — Capital Home Residence" },
      { name: "description", content: "Your rent payments and receipts." },
      { property: "og:title", content: "Payment History — Capital Home Residence" },
      { property: "og:description", content: "Rent payments and receipts." },
    ],
  }),
  component: Payments,
});

function Payments() {
  const { user } = Route.useRouteContext();
  const { data } = useQuery({
    queryKey: ["history", user.id],
    queryFn: async () => {
      const { data: attempts } = await supabase.from("payment_attempts")
        .select("id, reference, amount_cents, status, created_at, rent_charges(reference, semesters(academic_year, name)), payments(id, receipt_number, paid_at)")
        .eq("user_id", user.id).order("created_at", { ascending: false });
      return attempts ?? [];
    },
  });
  return (
    <AppShell title="Payment History">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Back to dashboard</Link>
      <h1 className="mb-4 text-4xl font-semibold">Payment history</h1>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Date</th><th>Amount</th><th>Semester</th><th>Method</th><th>Reference</th><th>Status</th><th>Receipt</th></tr></thead>
          <tbody>
            {data?.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No payments yet.</td></tr>}
            {data?.map((a) => {
              const pay = Array.isArray(a.payments) ? a.payments[0] : a.payments;
              return (
                <tr key={a.id} className="border-t">
                  <td className="p-3">{new Date(pay?.paid_at ?? a.created_at).toLocaleString("en-KE")}</td>
                  <td className="font-medium">{ksh(a.amount_cents)}</td>
                  <td>{a.rent_charges?.semesters?.academic_year} {a.rent_charges?.semesters?.name}</td>
                  <td>M-Pesa</td>
                  <td className="font-mono text-xs">{a.reference}</td>
                  <td><Badge variant={a.status === "success" ? "default" : a.status === "pending" ? "secondary" : "destructive"} className="capitalize">{a.status}</Badge></td>
                  <td>{pay ? <Link to="/receipt/$id" params={{ id: pay.id }} className="text-primary underline">{pay.receipt_number}</Link> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
