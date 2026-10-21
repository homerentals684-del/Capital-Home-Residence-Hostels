import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ksh } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/receipt/$id")({
  head: () => ({
    meta: [
      { title: "Receipt — Capital Home Residence" },
      { name: "description", content: "Rent payment receipt." },
      { property: "og:title", content: "Receipt — Capital Home Residence" },
      { property: "og:description", content: "Rent payment receipt." },
    ],
  }),
  component: Receipt,
});

function Receipt() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["receipt", id],
    queryFn: async () => {
      const { data: p } = await supabase.from("payments")
        .select("*, rent_charges(reference, rooms(room_number, residences(name)), semesters(academic_year, name))").eq("id", id).maybeSingle();
      if (!p) return null;
      const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", p.user_id).single();
      return { p, prof };
    },
  });
  if (isLoading) return null;
  if (!data) return <p className="p-10 text-center">Receipt not found.</p>;
  const { p, prof } = data;
  const rows: [string, string][] = [
    ["Receipt number", p.receipt_number], ["Tenant", prof?.full_name ?? ""], ["Email", prof?.email ?? ""],
    ["Residence & room", `${p.rent_charges?.rooms?.residences?.name} · ${p.rent_charges?.rooms?.room_number}`],
    ["Academic year & semester", `${p.rent_charges?.semesters?.academic_year} ${p.rent_charges?.semesters?.name}`],
    ["Payment date", new Date(p.paid_at).toLocaleString("en-KE")], ["Method", p.method],
    ["Paystack reference", p.paystack_reference], ["Rent charge", p.rent_charges?.reference ?? ""],
    ["Balance after payment", ksh(p.balance_after_cents)],
  ];
  return (
    <div className="min-h-screen bg-muted py-10 print:bg-background print:py-0">
      <div className="mx-auto mb-4 flex max-w-2xl justify-between px-6 print:hidden">
        <Link to="/payments" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Back</Link>
        <Button onClick={() => window.print()}><Printer />Print / Save PDF</Button>
      </div>
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-10 shadow-elegant print:border-0 print:shadow-none">
        <div className="flex items-center justify-between border-b pb-6">
          <img src={logo.url} alt="Capital Home Residence" className="h-20 w-auto" />
          <div className="text-right"><p className="font-display text-3xl">Payment Receipt</p><p className="text-sm text-muted-foreground">Capital Home Residence Rentals</p></div>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Amount paid</p>
        <p className="font-display text-5xl text-primary">{ksh(p.amount_cents)}</p>
        <dl className="mt-6 divide-y text-sm">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between py-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
        </dl>
        <p className="mt-8 text-center text-xs text-muted-foreground">Verified M-Pesa payment via Paystack. Thank you.</p>
      </div>
    </div>
  );
}
