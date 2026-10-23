import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, Plus, LayoutDashboard, UserPlus, Users, BedDouble, CalendarDays, Wallet, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ksh } from "@/lib/format";
import { selectCls } from "@/lib/ui";
import { AppShell, Stat, useAvatarUrl, type NavItem } from "./AppShell";
import { AdminPayments } from "./AdminPayments";

const adminNav: NavItem[] = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard },
  { key: "registrations", label: "Registrations", icon: UserPlus, section: "Tenant Management" },
  { key: "tenants", label: "Active Tenants", icon: Users, section: "Tenant Management" },
  { key: "rooms", label: "Rooms", icon: BedDouble, section: "Property Management" },
  { key: "semesters", label: "Semesters", icon: CalendarDays, section: "Property Management" },
  { key: "payments", label: "Payments", icon: Wallet, section: "Finance" },
];

export function AdminDashboard() {
  const { data: counts } = useQuery({
    queryKey: ["admin-counts"],
    queryFn: async () => {
      const [p, t, r, c] = await Promise.all([
        supabase.from("registrations").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("tenancies").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("rooms").select("id,status"),
        supabase.from("rent_charges").select("amount_cents,paid_cents"),
      ]);
      const outstanding = (c.data ?? []).reduce((s, x) => s + x.amount_cents - x.paid_cents, 0);
      return { pending: p.count ?? 0, tenants: t.count ?? 0, rooms: r.data?.length ?? 0, available: (r.data ?? []).filter((x) => x.status === "available").length, outstanding };
    },
  });
  return (
    <AppShell title="Admin Dashboard" name="Administrator">
      <h1 className="text-4xl font-semibold">Overview</h1>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending registrations" value={counts?.pending ?? "–"} tone="gold" />
        <Stat label="Active tenants" value={counts?.tenants ?? "–"} />
        <Stat label="Rooms available" value={counts ? `${counts.available} / ${counts.rooms}` : "–"} />
        <Stat label="Outstanding rent" value={counts ? ksh(counts.outstanding) : "–"} />
      </div>
      <Tabs defaultValue="registrations" className="mt-8">
        <TabsList>
          <TabsTrigger value="registrations">Tenant Registrations</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="semesters">Semesters</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="registrations"><Registrations /></TabsContent>
        <TabsContent value="rooms"><Rooms /></TabsContent>
        <TabsContent value="semesters"><Semesters /></TabsContent>
        <TabsContent value="payments"><AdminPayments /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Registrations() {
  const qc = useQueryClient();
  const sign = useAvatarUrl();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const { data } = useQuery({
    queryKey: ["admin-regs", filter],
    queryFn: async () => {
      const { data: regs } = await supabase.from("registrations")
        .select("id, reference, user_id, occupants, status, admin_note, created_at, room_id, rooms(room_number, max_occupancy, current_occupants), residences(name), semesters(academic_year, name)")
        .eq("status", filter).order("created_at", { ascending: false });
      const ids = (regs ?? []).map((r) => r.user_id);
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("*").in("id", ids) : { data: [] };
      return Promise.all((regs ?? []).map(async (r) => {
        const p = profiles?.find((x) => x.id === r.user_id);
        return { ...r, profile: p, avatar: await sign(p?.avatar_path ?? null) };
      }));
    },
  });
  const { data: rooms } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: async () => (await supabase.from("rooms").select("*, residences(name)").order("room_number")).data ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-regs"] }); qc.invalidateQueries({ queryKey: ["admin-counts"] }); qc.invalidateQueries({ queryKey: ["admin-rooms"] }); };

  async function approve(id: string, roomId: string, note: string) {
    const { error } = await supabase.rpc("approve_registration", { _reg_id: id, _room_id: roomId, _note: note });
    if (error) { toast.error(error.message); return; }
    toast.success("Tenant approved and rent charge created");
    refresh();
  }
  async function reject(id: string, note: string) {
    if (!note.trim()) { toast.error("Add a rejection reason"); return; }
    const { error } = await supabase.rpc("reject_registration", { _reg_id: id, _note: note });
    if (error) { toast.error(error.message); return; }
    toast.success("Application rejected");
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending", "approved", "rejected"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
      </div>
      {data?.length === 0 && <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">No {filter} registrations.</p>}
      {data?.map((r) => <RegCard key={r.id} r={r} rooms={rooms ?? []} onApprove={approve} onReject={reject} />)}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RegCard({ r, rooms, onApprove, onReject }: { r: any; rooms: any[]; onApprove: (id: string, room: string, note: string) => void; onReject: (id: string, note: string) => void }) {
  const [roomId, setRoomId] = useState<string>(r.room_id);
  const [note, setNote] = useState("");
  const room = rooms.find((x) => x.id === roomId);
  const over = room && room.current_occupants + r.occupants > room.max_occupancy;
  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 md:flex-row">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary">{r.avatar && <a href={r.avatar} target="_blank" rel="noreferrer"><img src={r.avatar} alt="" className="h-full w-full object-cover" /></a>}</div>
      <div className="flex-1 space-y-1 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold">{r.profile?.full_name}</p>
          <Badge variant="secondary" className="font-mono">{r.reference}</Badge>
          {over && <Badge variant="destructive">Over capacity</Badge>}
        </div>
        <p className="text-muted-foreground">{r.profile?.email} · {r.profile?.phone} · {r.profile?.location} · {r.profile?.gender?.replaceAll("_", " ")}</p>
        <p>Requested: {r.residences?.name} · {r.rooms?.room_number} · {r.semesters?.academic_year} {r.semesters?.name}</p>
        <p>Occupants: {r.occupants} · Room capacity {r.rooms?.current_occupants}/{r.rooms?.max_occupancy} · Submitted {new Date(r.created_at).toLocaleDateString("en-KE")}</p>
        {r.admin_note && <p className="text-muted-foreground">Note: {r.admin_note}</p>}
      </div>
      {r.status === "pending" && (
        <div className="w-full space-y-2 md:w-64">
          <select className={selectCls} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {rooms.map((x) => <option key={x.id} value={x.id}>{x.room_number} ({x.current_occupants}/{x.max_occupancy})</option>)}
          </select>
          <Input placeholder="Note / rejection reason" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => onApprove(r.id, roomId, note)}><Check />Approve</Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onReject(r.id, note)}><X />Reject</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Rooms() {
  const qc = useQueryClient();
  const { data: rooms } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: async () => (await supabase.from("rooms").select("*, residences(name)").order("room_number")).data ?? [],
  });
  const { data: residences } = useQuery({
    queryKey: ["admin-residences"],
    queryFn: async () => (await supabase.from("residences").select("*").order("name")).data ?? [],
  });
  const [form, setForm] = useState({ residence_id: "", room_number: "", room_type: "Single", price: "", max: "1" });
  const [newRes, setNewRes] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-rooms"] }); qc.invalidateQueries({ queryKey: ["admin-residences"] }); qc.invalidateQueries({ queryKey: ["admin-counts"] }); };

  async function addRoom() {
    const price = Math.round(Number(form.price) * 100);
    const max = parseInt(form.max);
    if (!form.residence_id || !form.room_number.trim() || !(price >= 0) || !(max >= 1)) { toast.error("Fill in all room fields"); return; }
    const { error } = await supabase.from("rooms").insert({ residence_id: form.residence_id, room_number: form.room_number.trim(), room_type: form.room_type, semester_price_cents: price, max_occupancy: max });
    if (error) { toast.error(error.message.includes("duplicate") ? "Room number already exists" : error.message); return; }
    toast.success("Room added");
    setForm({ ...form, room_number: "" });
    refresh();
  }
  async function addResidence() {
    if (!newRes.trim()) return;
    const { error } = await supabase.from("residences").insert({ name: newRes.trim() });
    if (error) { toast.error(error.message); return; }
    setNewRes("");
    refresh();
  }
  async function update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("rooms").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-6">
        <select className={selectCls} value={form.residence_id} onChange={(e) => setForm({ ...form, residence_id: e.target.value })}>
          <option value="">Residence</option>
          {residences?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <Input placeholder="Room no. e.g. Old Room-07" value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
        <Input placeholder="Type" value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })} />
        <Input placeholder="Price KSh" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <Input placeholder="Max occupancy" type="number" min={1} value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />
        <Button onClick={addRoom}><Plus />Add room</Button>
        <Input className="md:col-span-2" placeholder="New residence / block name" value={newRes} onChange={(e) => setNewRes(e.target.value)} />
        <Button variant="outline" onClick={addResidence}><Plus />Add residence</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Room</th><th>Residence</th><th>Type</th><th>Price (KSh)</th><th>Occupancy</th><th>Status</th><th>Active</th></tr>
          </thead>
          <tbody>
            {rooms?.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-medium">{r.room_number}</td>
                <td>{r.residences?.name}</td>
                <td>{r.room_type}</td>
                <td><Input className="h-8 w-28" type="number" defaultValue={r.semester_price_cents / 100} onBlur={(e) => { const v = Math.round(Number(e.target.value) * 100); if (v !== r.semester_price_cents && v >= 0) update(r.id, { semester_price_cents: v }); }} /></td>
                <td className="whitespace-nowrap">{r.current_occupants} / <Input className="inline-flex h-8 w-16" type="number" min={1} defaultValue={r.max_occupancy} onBlur={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v !== r.max_occupancy) update(r.id, { max_occupancy: v }); }} /></td>
                <td>
                  <select className={`${selectCls} h-8 w-32`} value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}>
                    <option value="available">Available</option><option value="occupied">Occupied</option><option value="vacant">Vacant</option><option value="maintenance">Maintenance</option>
                  </select>
                </td>
                <td><input type="checkbox" checked={r.active} onChange={(e) => update(r.id, { active: e.target.checked })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Semesters() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-semesters"],
    queryFn: async () => (await supabase.from("semesters").select("*").order("start_date")).data ?? [],
  });
  const [f, setF] = useState({ academic_year: "", name: "", start_date: "", end_date: "", rent_due_date: "" });
  async function add() {
    if (Object.values(f).some((v) => !v)) { toast.error("Fill in all semester fields"); return; }
    if (f.end_date <= f.start_date) { toast.error("End date must be after start date"); return; }
    const { error } = await supabase.from("semesters").insert({ ...f, status: "upcoming" });
    if (error) { toast.error(error.message); return; }
    toast.success("Semester added");
    qc.invalidateQueries({ queryKey: ["admin-semesters"] });
  }
  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("semesters").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-semesters"] });
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-xl border bg-card p-5 md:grid-cols-6">
        <Input placeholder="Year e.g. 2027/2028" value={f.academic_year} onChange={(e) => setF({ ...f, academic_year: e.target.value })} />
        <Input placeholder="Semester name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input type="date" title="Start" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
        <Input type="date" title="End" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
        <Input type="date" title="Rent due" value={f.rent_due_date} onChange={(e) => setF({ ...f, rent_due_date: e.target.value })} />
        <Button onClick={add}><Plus />Add semester</Button>
      </div>
      <div className="rounded-xl border bg-card">
        {data?.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-4 border-b p-4 text-sm last:border-0">
            <p className="flex-1 font-medium">{s.academic_year} · {s.name}</p>
            <p className="text-muted-foreground">{s.start_date} → {s.end_date} · Rent due {s.rent_due_date}</p>
            <select className={`${selectCls} h-8 w-32`} value={s.status} onChange={(e) => setStatus(s.id, e.target.value)}>
              <option value="upcoming">Upcoming</option><option value="open">Open</option><option value="closed">Closed</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
