import { expandRoomRange } from "@/lib/room-range";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, Plus, LayoutDashboard, UserPlus, Users, BedDouble, CalendarDays, Wallet, Trash2, ClipboardList, Bell, MessageSquare, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ksh } from "@/lib/format";
import { selectCls } from "@/lib/ui";
import { AppShell, Stat, useAvatarUrl, type NavItem } from "./AppShell";
import { AdminPayments } from "./AdminPayments";
import { TenancyRequests } from "./TenancyRequests";
import { AdminSms } from "./AdminSms";
import { RoomQrCodes } from "./RoomQrCodes";
import { usePropertyImages } from "@/lib/property-images";

const adminNav: NavItem[] = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard },
  { key: "registrations", label: "Registrations", icon: UserPlus, section: "Tenant Management" },
  { key: "tenants", label: "Active Tenants", icon: Users, section: "Tenant Management" },
  { key: "requests", label: "Tenancy Requests", icon: ClipboardList, section: "Tenant Management" },
  { key: "notifications", label: "Notifications", icon: Bell, section: "Tenant Management", to: "/notifications" },
  { key: "sms", label: "SMS", icon: MessageSquare, section: "Tenant Management" },
  { key: "rooms", label: "Rooms", icon: BedDouble, section: "Property Management" },
  { key: "qr", label: "Room QR Codes", icon: QrCode, section: "Property Management" },
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
      const billed = (c.data ?? []).reduce((s, x) => s + x.amount_cents, 0);
      const collected = (c.data ?? []).reduce((s, x) => s + x.paid_cents, 0);
      return { pending: p.count ?? 0, tenants: t.count ?? 0, rooms: r.data?.length ?? 0, available: (r.data ?? []).filter((x) => x.status === "available" || x.status === "vacant").length, billed, collected, outstanding: billed - collected };
    },
  });
  const [section, setSection] = useState("overview");
  const headings: Record<string, string> = {
    overview: "Overview", registrations: "Tenant Registrations", tenants: "Active Tenants",
    rooms: "Rooms", semesters: "Semesters", payments: "Payments", requests: "Tenancy Requests", sms: "SMS Messages", qr: "Room Payment QR Codes",
  };
  return (
    <AppShell title="Admin Dashboard" name="Administrator" nav={adminNav} active={section} onNavigate={setSection}>
      <h1 className="text-4xl font-semibold">{headings[section]}</h1>
      {section === "overview" && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pending registrations" value={counts?.pending ?? "–"} tone="gold" />
            <Stat label="Active tenants" value={counts?.tenants ?? "–"} />
            <Stat label="Rooms available" value={counts ? `${counts.available} / ${counts.rooms}` : "–"} />
            <Stat label="Outstanding rent" value={counts ? ksh(counts.outstanding) : "–"} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Stat label="Total rent billed" value={counts ? ksh(counts.billed) : "–"} />
            <Stat label="Total rent collected" value={counts ? ksh(counts.collected) : "–"} tone="gold" />
            <Stat label="Collection rate" value={counts ? `${counts.billed ? Math.round((counts.collected / counts.billed) * 100) : 0}%` : "–"} />
          </div>
          <div className="mt-8"><AdminPayments limit={8} /></div>
        </>
      )}
      {section === "registrations" && <div className="mt-6"><Registrations /></div>}
      {section === "tenants" && <div className="mt-6"><Tenants /></div>}
      {section === "requests" && <div className="mt-6"><TenancyRequests userId="admin" admin /></div>}
      {section === "rooms" && <div className="mt-6"><Rooms /></div>}
      {section === "semesters" && <div className="mt-6"><Semesters /></div>}
      {section === "payments" && <div className="mt-6"><AdminPayments /></div>}
      {section === "qr" && <div className="mt-6"><QrSection /></div>}
      {section === "sms" && <div className="mt-6"><AdminSms /></div>}
    </AppShell>
  );
}

function Tenants() {
  const qc = useQueryClient();
  const sign = useAvatarUrl();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => {
      const { data: ts } = await supabase.from("tenancies")
        .select("id, user_id, occupants, status, started_at, ended_at, rooms(room_number, room_type, residences(name)), semesters(academic_year, name), rent_charges(amount_cents, paid_cents, status, due_date)")
        .order("started_at", { ascending: false });
      const ids = [...new Set((ts ?? []).map((t) => t.user_id))];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("*").in("id", ids) : { data: [] };
      return Promise.all((ts ?? []).map(async (t) => {
        const p = profs?.find((x) => x.id === t.user_id);
        const charges = t.rent_charges ?? [];
        return {
          ...t, profile: p, avatar: await sign(p?.avatar_path ?? null),
          totalCents: charges.reduce((s, c) => s + c.amount_cents, 0),
          paidCents: charges.reduce((s, c) => s + c.paid_cents, 0),
        };
      }));
    },
  });
  const rows = (data ?? []).filter((t) =>
    !q || `${t.profile?.full_name} ${t.profile?.email} ${t.rooms?.room_number} ${t.rooms?.residences?.name}`.toLowerCase().includes(q.toLowerCase()));

  async function remove(t: { id: string; profile?: { full_name?: string } | null | undefined }) {
    if (!window.confirm(`Remove ${t.profile?.full_name ?? "this tenant"}? Their tenancy ends and the room is freed. Payment records are kept.`)) return;
    const { error } = await supabase.rpc("end_tenancy", { _tenancy_id: t.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Tenancy ended and room freed");
    qc.invalidateQueries({ queryKey: ["admin-tenants"] });
    qc.invalidateQueries({ queryKey: ["admin-counts"] });
    qc.invalidateQueries({ queryKey: ["admin-rooms"] });
  }

  async function del(t: { user_id: string; profile?: { full_name?: string } | null | undefined }) {
    if (!window.confirm(`Permanently delete ${t.profile?.full_name ?? "this tenant"}? If they have made payments, their account is kept for records but their tenancy is ended.`)) return;
    const { data: res, error } = await supabase.rpc("delete_tenant", { _user_id: t.user_id });
    if (error) { toast.error(error.message); return; }
    toast.success(res === "deleted" ? "Tenant deleted" : "Tenant has payment records, so they were removed from the room and their history kept");
    qc.invalidateQueries({ queryKey: ["admin-tenants"] });
    qc.invalidateQueries({ queryKey: ["admin-counts"] });
    qc.invalidateQueries({ queryKey: ["admin-rooms"] });
  }

  return (
    <div className="space-y-4">
      <Input className="w-full sm:w-72" placeholder="Search tenant, room, hostel" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Tenant</th><th>Hostel</th><th>Room</th><th>Semester</th><th>Total rent</th><th>Paid</th><th>Outstanding</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No tenants found.</td></tr>}
            {rows.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-secondary">
                      {t.avatar && <img src={t.avatar} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div>
                      <p className="font-medium">{t.profile?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{t.profile?.phone}</p>
                    </div>
                  </div>
                </td>
                <td>{t.rooms?.residences?.name}</td>
                <td>{t.rooms?.room_number} <span className="text-xs text-muted-foreground">({t.occupants} pax)</span></td>
                <td className="whitespace-nowrap">{t.semesters?.academic_year} {t.semesters?.name}</td>
                <td className="font-medium">{ksh(t.totalCents)}</td>
                <td className="text-leaf">{ksh(t.paidCents)}</td>
                <td className="font-medium text-gold">{ksh(t.totalCents - t.paidCents)}</td>
                <td><Badge variant={t.status === "active" ? "default" : "secondary"} className="capitalize">{t.status}</Badge></td>
                <td className="whitespace-nowrap">{t.status === "active" && <Button size="sm" variant="ghost" onClick={() => remove(t)}>End tenancy</Button>}<Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(t)}><Trash2 />Delete</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
        <p className="text-muted-foreground">{r.profile?.email} · {r.profile?.phone} · {r.profile?.gender?.replaceAll("_", " ")}</p>
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
  const [prop, setProp] = useState({ target: "new", name: "", location: "", start: "", end: "", rent: "", max: "1" });
  const imgUrls = usePropertyImages(residences);
  const [saving, setSaving] = useState(false);
  let preview: string[] = []; let previewErr = "";
  if (prop.start.trim() && prop.end.trim()) { try { preview = expandRoomRange(prop.start, prop.end); } catch (e) { previewErr = (e as Error).message; } }
  const existing = new Set((rooms ?? []).filter((r) => r.residence_id === prop.target && r.active).map((r) => r.room_number.trim().toLowerCase()));
  const skipped = prop.target === "new" ? [] : preview.filter((n) => existing.has(n.toLowerCase()));
  const toAdd = prop.target === "new" ? preview : preview.filter((n) => !existing.has(n.toLowerCase()));
  const [propFilter, setPropFilter] = useState("");
  const shownRooms = rooms?.filter((r) => !propFilter || r.residence_id === propFilter);
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
  async function addProperty() {
    const rent = Math.round(Number(prop.rent) * 100);
    const max = parseInt(prop.max);
    if (prop.target !== "new") {
      if (!prop.start.trim() || !prop.end.trim() || !prop.rent || !(rent >= 0) || !(max >= 1)) { toast.error("Fill in the room range, rent and tenants per room"); return; }
      if (previewErr) { toast.error(previewErr); return; }
      if (toAdd.length === 0) { toast.info("All rooms in this range already exist"); return; }
      setSaving(true);
      const { data: n, error } = await supabase.rpc("add_rooms_to_property", { _residence_id: prop.target, _room_numbers: toAdd, _price_cents: rent, _max_occupancy: max });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success(`Added ${n ?? toAdd.length} new rooms${skipped.length ? `, skipped ${skipped.length} that already exist` : ""}`);
      setProp({ ...prop, start: "", end: "" });
      refresh();
      return;
    }
    if (!prop.name.trim() || !prop.start.trim() || !prop.end.trim() || !prop.rent || !(rent >= 0) || !(max >= 1)) { toast.error("Fill in all property fields"); return; }
    if (previewErr) { toast.error(previewErr); return; }
    if (residences?.some((r) => r.name.trim().toLowerCase() === prop.name.trim().toLowerCase())) { toast.error("A property with this name already exists"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("create_property_with_rooms", { _name: prop.name, _location: prop.location, _room_numbers: preview, _price_cents: rent, _max_occupancy: max });
    setSaving(false);
    if (error) { toast.error(error.message.includes("duplicate") ? "Duplicate room numbers in this property" : error.message); return; }
    toast.success(`Property saved with ${preview.length} rooms`);
    setProp({ target: "new", name: "", location: "", start: "", end: "", rent: "", max: "1" });
    refresh();
  }
  async function deleteRoom(id: string, label: string) {
    if (!window.confirm(`Delete room ${label}?`)) return;
    const { data: res, error } = await supabase.rpc("delete_room", { _room_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success(res === "deleted" ? "Room deleted" : "Room has past records, so it was hidden instead");
    refresh();
  }
  async function deleteProperty(id: string, name: string) {
    if (!window.confirm(`Delete property "${name}" and all its rooms?`)) return;
    const { data: res, error } = await supabase.rpc("delete_property", { _residence_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success(res === "deleted" ? "Property deleted" : "Property has past records, so it was hidden instead");
    if (propFilter === id) setPropFilter("");
    refresh();
  }
  async function uploadImage(id: string, file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Use a JPG, PNG or WebP photo"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5MB"); return; }
    const path = `${id}/${Date.now()}.${file.name.split(".").pop()?.toLowerCase() || "jpg"}`;
    const up = await supabase.storage.from("property-images").upload(path, file, { contentType: file.type });
    if (up.error) { toast.error(up.error.message); return; }
    const { error } = await supabase.from("residences").update({ image_path: path, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Property photo saved");
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
      </div>
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <h3 className="font-semibold">Add property or room range</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <L label="Property">
            <select className={selectCls} value={prop.target} onChange={(e) => setProp({ ...prop, target: e.target.value })}>
              <option value="new">+ New property</option>
              {residences?.filter((r) => r.active).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </L>
          {prop.target === "new" && <L label="Property name"><Input placeholder="e.g. Sunrise Hostel" value={prop.name} onChange={(e) => setProp({ ...prop, name: e.target.value })} /></L>}
          {prop.target === "new" && <L label="Location"><Input placeholder="e.g. Near Main Gate" value={prop.location} onChange={(e) => setProp({ ...prop, location: e.target.value })} /></L>}
          <L label="Starting room number"><Input placeholder="e.g. 1 or A-01" value={prop.start} onChange={(e) => setProp({ ...prop, start: e.target.value })} /></L>
          <L label="Ending room number"><Input placeholder="e.g. 50 or A-50" value={prop.end} onChange={(e) => setProp({ ...prop, end: e.target.value })} /></L>
          <L label="Semester rent (KES)"><Input type="number" min={0} value={prop.rent} onChange={(e) => setProp({ ...prop, rent: e.target.value })} /></L>
          <L label="Tenants per room"><Input type="number" min={1} value={prop.max} onChange={(e) => setProp({ ...prop, max: e.target.value })} /></L>
        </div>
        {previewErr ? <p className="text-sm text-destructive">{previewErr}</p> : preview.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {preview.length} rooms in range{skipped.length > 0 && <> · <span className="text-gold">{skipped.length} already exist and will be skipped</span></>} · <span className="font-medium text-foreground">{toAdd.length} new rooms will be added as Vacant</span>
            {toAdd.length > 0 && `: ${toAdd.slice(0, 8).join(", ")}${toAdd.length > 8 ? ` … ${toAdd[toAdd.length - 1]}` : ""}`}
          </p>
        )}
        <Button onClick={addProperty} disabled={saving}><Plus />{saving ? "Saving…" : prop.target === "new" ? "Save property & rooms" : "Add missing rooms"}</Button>
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="font-semibold">Properties</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {residences?.filter((r) => r.active).map((r) => (
            <div key={r.id} className="overflow-hidden rounded-lg border">
              <div className="flex h-32 items-center justify-center bg-secondary text-xs text-muted-foreground">
                {imgUrls[r.id] ? <img src={imgUrls[r.id]} alt={r.name} className="h-full w-full object-cover" /> : "No photo yet"}
              </div>
              <div className="space-y-2 p-3">
                <p className="font-medium">{r.name}</p>
                {r.location && <p className="text-xs text-muted-foreground">{r.location}</p>}
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                    {r.image_path ? "Change photo" : "Upload photo"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => uploadImage(r.id, e.target.files?.[0])} />
                  </label>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteProperty(r.id, r.name)}><Trash2 />Delete</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Filter by property" className={selectCls + " max-w-xs"} value={propFilter} onChange={(e) => setPropFilter(e.target.value)}>
          <option value="">All properties</option>
          {residences?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">Showing {shownRooms?.length ?? 0} of {rooms?.length ?? 0} rooms</span>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Room</th><th>Residence</th><th>Type</th><th>Price (KSh)</th><th>Occupancy</th><th>Status</th><th>Active</th><th></th></tr>
          </thead>
          <tbody>
            {shownRooms?.map((r) => (
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
                <td><Button size="sm" variant="ghost" className="text-destructive" aria-label={`Delete ${r.room_number}`} onClick={() => deleteRoom(r.id, r.room_number)}><Trash2 /></Button></td>
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
  const [makeCurrent, setMakeCurrent] = useState(true);
  const [carry, setCarry] = useState(false);
  const refreshAll = () => ["admin-semesters", "admin-tenants", "admin-rooms", "admin-counts"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  async function start(id: string, carryOver: boolean) {
    const { data: n, error } = await supabase.rpc("start_semester", { _semester_id: id, _carry_over: carryOver });
    if (error) { toast.error(error.message); return false; }
    toast.success(`Semester is now current. ${n ?? 0} previous tenancies closed${carryOver ? " and renewed" : ""}; past records kept.`);
    return true;
  }
  async function add() {
    if (Object.values(f).some((v) => !v)) { toast.error("Fill in all semester fields"); return; }
    if (f.end_date <= f.start_date) { toast.error("End date must be after start date"); return; }
    if (makeCurrent && !window.confirm(`Start ${f.academic_year} ${f.name} now? All current tenancies move to the previous semester's records and rooms are reset${carry ? ", with current tenants renewed" : ""}.`)) return;
    const { data: sem, error } = await supabase.from("semesters").insert({ ...f, status: "upcoming" }).select("id").single();
    if (error) { toast.error(error.message); return; }
    if (makeCurrent) await start(sem.id, carry); else toast.success("Semester added");
    setF({ academic_year: "", name: "", start_date: "", end_date: "", rent_due_date: "" });
    refreshAll();
  }
  async function makeCurrentNow(id: string, label: string) {
    const c = window.confirm(`Renew current tenants into ${label}? Press OK to renew them, or Cancel to choose whether to start without renewing.`);
    if (!c && !window.confirm(`Start ${label} without renewing? All current tenancies end and rooms become vacant (records kept).`)) return;
    if (await start(id, c)) refreshAll();
  }
  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("semesters").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-semesters"] });
  }
  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-5">
          <L label="Academic year"><Input placeholder="e.g. 2027/2028" value={f.academic_year} onChange={(e) => setF({ ...f, academic_year: e.target.value })} /></L>
          <L label="Semester name"><Input placeholder="e.g. Semester 1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></L>
          <L label="Semester start date"><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></L>
          <L label="Semester end date"><Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></L>
          <L label="Rent due date"><Input type="date" value={f.rent_due_date} onChange={(e) => setF({ ...f, rent_due_date: e.target.value })} /></L>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} />Make this the current semester when saved</label>
          {makeCurrent && <label className="flex items-center gap-2"><input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} />Keep current tenants in their rooms (new rent charge)</label>}
          <Button onClick={add}><Plus />Save semester</Button>
        </div>
      </div>
      <div className="rounded-xl border bg-card">
        {data?.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-4 border-b p-4 text-sm last:border-0">
            <p className="flex-1 font-medium">{s.academic_year} · {s.name}</p>
            <p className="text-muted-foreground">{s.start_date} → {s.end_date} · Rent due {s.rent_due_date}</p>
            <select className={`${selectCls} h-8 w-32`} value={s.status} onChange={(e) => setStatus(s.id, e.target.value)}>
              <option value="upcoming">Upcoming</option><option value="open">Open</option><option value="closed">Closed</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => makeCurrentNow(s.id, `${s.academic_year} ${s.name}`)}>Make current</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function QrSection() {
  const { data: rooms } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: async () => (await supabase.from("rooms").select("*, residences(name)").order("room_number")).data ?? [],
  });
  if (!rooms) return <p className="text-muted-foreground">Loading rooms…</p>;
  return <RoomQrCodes rooms={rooms.filter((r) => r.active)} />;
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5 text-sm"><span className="block font-medium">{label}</span>{children}</label>;
}
