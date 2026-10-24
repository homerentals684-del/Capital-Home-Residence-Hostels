import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app/AppShell';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { tenantNav } from '@/lib/account-navigation';
export const Route = createFileRoute('/_authenticated/notifications')({
  head: () => ({ meta: [
    { title: 'Notifications — Capital Home Residence' },
    { name: 'description', content: 'Registration decisions, payments and tenancy request updates.' },
    { property: 'og:title', content: 'Notifications — Capital Home Residence' },
    { property: 'og:description', content: 'Your latest account and tenancy updates.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }), component: Notifications,
});
function Notifications() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data: roles } = useQuery({ queryKey: ['whoami',user.id], queryFn: async () => {
    const { data, error } = await supabase.from('user_roles').select('role').eq('user_id',user.id);
    if(error) throw error;
    return { isAdmin: data.some(r=>r.role==='admin') };
  }});
  const { data, isLoading, error } = useQuery({ queryKey: ['notifications',user.id], queryFn: async () => {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
    if(error) throw error; return data ?? [];
  }, refetchInterval: 60_000 });
  async function markRead(id?: string) {
    let q = supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);
    if(id) q=q.eq('id',id);
    const {error}=await q;
    if(error) return toast.error('Could not update notification');
    await qc.invalidateQueries({queryKey:['notifications']});
    await qc.invalidateQueries({queryKey:['notifications-unread']});
  }
  const nav = roles?.isAdmin ? [{...tenantNav[0], label:'Admin Dashboard'}, {key:'notifications',label:'Notifications',icon:Bell,to:'/notifications'}] : tenantNav;
  return <AppShell title="Notifications" nav={nav} active="notifications"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-4xl font-semibold">Notifications</h1><Button variant="outline" disabled={!data?.some(n=>!n.read_at)} onClick={()=>markRead()}><Check/>Mark all read</Button></div>
    {isLoading && <Loader2 className="animate-spin text-primary"/>}{error && <p className="text-destructive">Could not load notifications.</p>}
    {data?.length===0 && <p className="py-8 text-muted-foreground">No notifications yet.</p>}
    <div className="divide-y border-y">{data?.map(n=><article key={n.id} className={`flex flex-wrap items-start justify-between gap-3 p-4 ${!n.read_at?'bg-secondary':''}`}><div className="min-w-0 flex-1"><h2 className="font-semibold">{n.title}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{n.message}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString('en-KE')}</p></div>{!n.read_at && <Button size="sm" variant="ghost" onClick={()=>markRead(n.id)}><Check/>Mark read</Button>}</article>)}</div>
  </AppShell>;
}