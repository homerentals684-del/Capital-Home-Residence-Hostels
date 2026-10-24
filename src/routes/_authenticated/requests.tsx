import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app/AppShell';
import { TenancyRequests } from '@/components/app/TenancyRequests';
import { tenantNav } from '@/lib/account-navigation';
export const Route = createFileRoute('/_authenticated/requests')({
  head: () => ({ meta: [
    { title: 'My Requests — Capital Home Residence' },
    { name: 'description', content: 'Manage your move-out and next-semester requests.' },
    { property: 'og:title', content: 'My Requests — Capital Home Residence' },
    { property: 'og:description', content: 'Your tenancy requests and administrator decisions.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Requests,
});
function Requests() {
  const { user } = Route.useRouteContext();
  return <AppShell title="My Requests" nav={tenantNav} active="requests"><h1 className="mb-6 text-4xl font-semibold">My requests</h1><TenancyRequests userId={user.id}/></AppShell>;
}