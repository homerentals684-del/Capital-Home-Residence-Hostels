import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock, XCircle, ShieldAlert, Smartphone, LayoutDashboard, Wallet, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ksh } from "@/lib/format";
import { AppShell, Stat, useAvatarUrl, type NavItem } from "./AppShell";

export const tenantNav: NavItem[] = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { key: "pay", label: "Pay Rent", icon: Wallet, section: "Finance", to: "/pay" },
  { key: "payments", label: "Payments & Receipts", icon: Receipt, section: "Finance", to: "/payments" },
];

function useProfile(userId: string) {
  const sign = useAvatarUrl();
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      return data ? { ...data, avatarUrl: await sign(data.avatar_path) } : null;
    },
  });
}

export function TenantDashboard({ userId }: { userId: string }) {
  const { data: profile } = useProfile(userId);
  const { data } = useQuery({
    queryKey: ["tenant-home", userId],
    queryFn: async () => {
      const { data: t } = await supabase
        .from("tenancies")
        .select("id, occupants, status, rooms(room_number, room_type, residences(name)), semesters(academic_year, name)")
        .eq("user_id", userId).eq("status", "active").single();
      const { data: charges } = await supabase.from("rent_charges").select("*").eq("tenancy_id", t?.id ?? "").order("created_at");
      return { t, charges: charges ?? [] };
    },
  });
  const charge = data?.charges.at(-1);
  const t = data?.t;
  return (
    <AppShell title="Tenant Dashboard" name={profile?.full_name} nav={tenantNav} active="overview">
      <div className="flex flex-wrap items-center gap-5 rounded-2xl bg-gradient-navy p-6 text-primary-foreground shadow-elegant">
        <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-gold bg-secondary">
          {profile?.avatarUrl && <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div>
          <p className="text-sm text-primary-foreground/70">Welcome back</p>
          <h1 className="text-4xl font-semibold">{profile?.full_name}</h1>
          <p className="text-sm text-primary-foreground/80">
            {t?.rooms?.residences?.name} · Room {t?.rooms?.room_number} · {t?.semesters?.academic_year} {t?.semesters?.name}
          </p>
        </div>
        <Badge className="ml-auto bg-gradient-gold text-gold-foreground">Active tenancy</Badge>
      </div>
      {charge && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Semester rent" value={ksh(charge.amount_cents)} />
          <Stat label="Verified payments" value={ksh(charge.paid_cents)} />
          <Stat label="Outstanding balance" value={ksh(charge.amount_cents - charge.paid_cents)} tone="gold" />
          <Stat label="Due date" value={new Date(charge.due_date).toLocaleDateString("en-KE", { dateStyle: "medium" })} />
        </div>
      )}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <p className="font-semibold">Room details</p>
          <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
            <div>Room type: {t?.rooms?.room_type}</div>
            <div>Declared occupants: {t?.occupants}</div>
            <div>Charge reference: <span className="font-mono">{charge?.reference}</span></div>
            <div>Status: {charge?.status.replace("_", " ")}</div>
          </dl>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <p className="flex items-center gap-2 font-semibold"><Smartphone className="h-4 w-4 text-gold" />Pay rent via M-Pesa</p>
          <p className="mt-2 text-sm text-muted-foreground">Pay the full balance or in installments. Your balance updates once M-Pesa confirms.</p>
          <div className="mt-4 flex gap-2">
            <Button asChild variant="gold"><Link to="/pay">Pay rent</Link></Button>
            <Button asChild variant="outline"><Link to="/payments">Payments & receipts</Link></Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export function RegistrationStatus({ userId }: { userId: string }) {
  const { data: profile } = useProfile(userId);
  const { data: reg, isLoading } = useQuery({
    queryKey: ["my-reg", userId],
    queryFn: async () => {
      const { data } = await supabase.from("registrations")
        .select("reference, status, admin_note, created_at, occupants, rooms(room_number), residences(name), semesters(academic_year, name)")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });
  if (isLoading) return null;
  const Icon = !reg ? ShieldAlert : reg.status === "rejected" ? XCircle : reg.status === "approved" ? ShieldAlert : Clock;
  return (
    <AppShell title="Registration Status" name={profile?.full_name} nav={tenantNav} active="overview">
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center shadow-elegant">
        <Icon className="mx-auto h-12 w-12 text-gold" />
        {!reg ? (
          <>
            <h1 className="mt-4 text-3xl font-semibold">No application found</h1>
            <p className="mt-2 text-muted-foreground">You don't have an approved room yet. Please contact the landlord for help.</p>
          </>
        ) : reg.status === "pending" ? (
          <>
            <h1 className="mt-4 text-3xl font-semibold">Pending approval</h1>
            <p className="mt-2 text-muted-foreground">Your application is being reviewed by the landlord.</p>
          </>
        ) : reg.status === "rejected" ? (
          <>
            <h1 className="mt-4 text-3xl font-semibold">Application not approved</h1>
            {reg.admin_note && <p className="mt-2 text-muted-foreground">Reason: {reg.admin_note}</p>}
            <p className="mt-2 text-sm text-muted-foreground">Please contact the landlord for next steps.</p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-3xl font-semibold">Access restricted</h1>
            <p className="mt-2 text-muted-foreground">Your registration was approved but you have no active room. Please contact the landlord.</p>
          </>
        )}
        {reg && (
          <div className="mt-6 rounded-lg bg-muted p-4 text-left text-sm">
            <p>Reference: <span className="font-mono font-semibold">{reg.reference}</span></p>
            <p>Room: {reg.residences?.name} · {reg.rooms?.room_number}</p>
            <p>Semester: {reg.semesters?.academic_year} {reg.semesters?.name}</p>
            <p>Occupants: {reg.occupants}</p>
          </div>
        )}
        {!reg && <Button asChild className="mt-6" variant="outline"><Link to="/">Back to home</Link></Button>}
      </div>
    </AppShell>
  );
}
