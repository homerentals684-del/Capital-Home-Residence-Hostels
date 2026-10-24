import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
const AdminDashboard = lazy(() => import("@/components/app/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const TenantDashboard = lazy(() => import("@/components/app/TenantDashboard").then(m => ({ default: m.TenantDashboard })));
const RegistrationStatus = lazy(() => import("@/components/app/TenantDashboard").then(m => ({ default: m.RegistrationStatus })));

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Dashboard — Capital Home Residence" },
      { name: "description", content: "Your Capital Home Residence account." },
      { property: "og:title", content: "Dashboard — Capital Home Residence" },
      { property: "og:description", content: "Manage rooms, tenants and rent." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const { data, isLoading } = useQuery({
    queryKey: ["whoami", user.id],
    queryFn: async () => {
      const [roles, tenancy] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("tenancies").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
      ]);
      return { isAdmin: (roles.data ?? []).some((r) => r.role === "admin"), tenancyId: tenancy.data?.id ?? null };
    },
  });
  if (isLoading || !data) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>}>
    {data.isAdmin ? <AdminDashboard /> : data.tenancyId ? <TenantDashboard userId={user.id} /> : <RegistrationStatus userId={user.id} />}
  </Suspense>;
}
