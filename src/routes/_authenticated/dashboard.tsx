import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminDashboard } from "@/components/app/AdminDashboard";
import { TenantDashboard, RegistrationStatus } from "@/components/app/TenantDashboard";

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
  if (data.isAdmin) return <AdminDashboard />;
  if (data.tenancyId) return <TenantDashboard userId={user.id} />;
  return <RegistrationStatus userId={user.id} />;
}
