import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, X, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { selectCls } from '@/lib/ui';

export function TenancyRequests({ userId, admin = false }: { userId: string; admin?: boolean }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<'move_out' | 'next_semester'>('next_semester');
  const [date, setDate] = useState('');
  const [semester, setSemester] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('pending');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
  const { data: options } = useQuery({ queryKey: ['request-options', userId], enabled: !admin, queryFn: async () => {
    const [t, s] = await Promise.all([
      supabase.from('tenancies').select('id,semester_id,semesters(start_date)').eq('user_id', userId).eq('status','active').maybeSingle(),
      supabase.from('semesters').select('id,name,academic_year,start_date').neq('status','closed').order('start_date'),
    ]);
    if (t.error) throw t.error;
    if (s.error) throw s.error;
    return { tenancy: t.data, semesters: (s.data ?? []).filter(x => x.start_date > (t.data?.semesters?.start_date ?? '9999')) };
  }});
  const { data: requests, isLoading, error } = useQuery({ queryKey: ['tenancy-requests', userId, admin], queryFn: async () => {
    let q = supabase.from('tenancy_requests').select('*, profiles(full_name,phone), tenancies(rooms(room_number,residences(name))), semesters(name,academic_year)').order('created_at', { ascending: false }).limit(200);
    if (!admin) q = q.eq('user_id',userId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }});
  async function refresh() { await qc.invalidateQueries(); }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!options?.tenancy) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('submit_tenancy_request', { _tenancy_id: options.tenancy.id, _kind: kind, _note: note, ...(kind === 'move_out' ? { _requested_date: date } : { _semester_id: semester }) });
      if (error) throw error;
      toast.success('Request submitted'); setNote(''); setDate(''); setSemester(''); await refresh();
    } catch(e) { toast.error(e instanceof Error ? e.message : (e as {message?:string}).message ?? 'Could not submit request'); }
    finally { setBusy(false); }
  }
  async function review(id: string, approve: boolean) {
    setReviewing(id);
    const { error } = await supabase.rpc('review_tenancy_request',{ _request_id:id, _approve:approve, _note: notes[id] ?? '' });
    if (error) toast.error(error.message); else { toast.success(approve ? 'Request approved' : 'Request rejected'); await refresh(); }
    setReviewing(null);
  }
  async function cancel(id: string) {
    setReviewing(id);
    const { error } = await supabase.rpc('cancel_tenancy_request',{_request_id:id});
    if (error) toast.error(error.message); else { toast.success('Request cancelled'); await refresh(); }
    setReviewing(null);
  }
  const rows = (requests ?? []).filter(r => !admin || filter === 'all' || r.status === filter);
  return <div className="space-y-8">
    {!admin && (options?.tenancy ? <form onSubmit={submit} className="max-w-2xl space-y-4 border-b pb-6">
      <div className="flex flex-wrap gap-2">{(['next_semester','move_out'] as const).map(k => <Button key={k} type="button" variant={kind===k?'default':'outline'} onClick={()=>setKind(k)}>{k==='move_out'?'Move-out':'Next semester'}</Button>)}</div>
      {kind==='move_out' ? <div className="space-y-2"><Label htmlFor="move-date">Requested move-out date</Label><Input id="move-date" type="date" min={today} required value={date} onChange={e=>setDate(e.target.value)} /><p className="text-xs text-muted-foreground">The administrator confirms departure on or after this date. Existing balances remain payable.</p></div> : <div className="space-y-2"><Label htmlFor="request-semester">Semester</Label><select id="request-semester" required className={selectCls} value={semester} onChange={e=>setSemester(e.target.value)}><option value="">Select semester</option>{options.semesters.map(s=><option key={s.id} value={s.id}>{s.academic_year} · {s.name}</option>)}</select>{!options.semesters.length && <p className="text-sm text-muted-foreground">No later semesters are available yet.</p>}</div>}
      <div className="space-y-2"><Label htmlFor="request-note">Note (optional)</Label><Input id="request-note" maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} /></div>
      <Button type="submit" disabled={busy || (kind==='next_semester' && !semester) || (kind==='move_out' && !date)}>{busy?<Loader2 className="animate-spin"/>:<Send/>}Submit request</Button>
    </form> : <p className="text-muted-foreground">Requests require an active tenancy.</p>)}
    {admin && <div className="flex flex-wrap gap-2">{['pending','approved','rejected','cancelled','all'].map(f=><Button key={f} variant={filter===f?'default':'outline'} size="sm" className="capitalize" onClick={()=>setFilter(f)}>{f}</Button>)}</div>}
    {isLoading && <Loader2 className="animate-spin text-primary"/>}{error && <p className="text-destructive">Could not load requests. Please try again.</p>}
    {!isLoading && !error && rows.length===0 && <p className="py-6 text-muted-foreground">No requests found.</p>}
    <div className="space-y-4">{rows.map(r=><article key={r.id} className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{r.kind==='move_out'?'Move-out':'Next semester'}{admin && ` · ${r.profiles?.full_name ?? 'Tenant'}`}</h2><Badge variant={r.status==='rejected'?'destructive':'secondary'} className="capitalize">{r.status}</Badge></div>
      <p className="mt-2 text-sm text-muted-foreground">{r.tenancies?.rooms?.residences?.name} · Room {r.tenancies?.rooms?.room_number}</p>
      <p className="text-sm">{r.kind==='move_out'?`Requested date: ${r.requested_date}`:`Semester: ${r.semesters?.academic_year} · ${r.semesters?.name}`}</p>
      {r.note && <p className="mt-2 break-words text-sm">{r.note}</p>}{r.admin_note && <p className="mt-2 break-words text-sm text-muted-foreground">Administrator: {r.admin_note}</p>}
      <p className="mt-2 text-xs text-muted-foreground">Submitted {new Date(r.created_at).toLocaleDateString('en-KE')}</p>
      {r.status==='pending' && (admin ? <div className="mt-4 flex flex-wrap gap-2"><Input aria-label={`Review note for ${r.profiles?.full_name}`} placeholder="Note / rejection reason" className="w-full sm:w-80" value={notes[r.id] ?? ''} onChange={e=>setNotes({...notes,[r.id]:e.target.value})}/><Button size="sm" disabled={Boolean(reviewing) || (r.kind==='move_out' && (r.requested_date ?? '')>today)} onClick={()=>review(r.id,true)}><Check/>{r.kind==='move_out'?'Confirm departure':'Approve renewal'}</Button><Button size="sm" variant="outline" disabled={Boolean(reviewing) || !notes[r.id]?.trim()} onClick={()=>review(r.id,false)}><X/>Reject</Button>{r.kind==='move_out' && (r.requested_date ?? '')>today && <p className="w-full text-xs text-muted-foreground">Departure can be confirmed from {r.requested_date}.</p>}</div> : <Button className="mt-3" variant="outline" size="sm" disabled={Boolean(reviewing)} onClick={()=>cancel(r.id)}><X/>Cancel request</Button>)}
    </article>)}</div>
  </div>;
}
