import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { UserPlus, Upload, Info, Loader2, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import building from "@/assets/building.webp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { ksh, normalizeKePhone } from "@/lib/format";
import { selectCls } from "@/lib/ui";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Tenant Registration — Capital Home Residence" },
      { name: "description", content: "Apply for a room at Capital Home Residence Rentals." },
      { property: "og:title", content: "Tenant Registration — Capital Home Residence" },
      { property: "og:description", content: "Create your account and apply for a room." },
    ],
  }),
  component: RegisterPage,
});

const MAX_MB = 5;

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().refine((v) => normalizeKePhone(v) !== null, "Enter a valid Kenyan phone number"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  confirm: z.string(),
  location: z.string().trim().min(2, "Enter your location").max(120),
  room_id: z.string().uuid("Select a room"),
  semester_id: z.string().uuid("Select a semester"),
  gender: z.enum(["male", "female", "prefer_not_to_say"]),
  occupants: z.coerce.number().int().min(1, "At least 1 occupant"),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="border-t pt-6">
      <p className="mb-4 flex items-center gap-3 font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>
        {title}
      </p>
      <div className="grid gap-4 md:grid-cols-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label} <span className="text-destructive">*</span></Label>{children}</div>;
}

function RegisterPage() {
  const { data: options } = useQuery({
    queryKey: ["reg-options"],
    queryFn: async () => {
      const [res, rooms, sems] = await Promise.all([
        supabase.from("residences").select("id,name").eq("active", true).order("name"),
        supabase.from("rooms").select("id,residence_id,room_number,semester_price_cents,max_occupancy,current_occupants,status").eq("active", true).order("room_number"),
        supabase.from("semesters").select("id,academic_year,name,status").neq("status", "closed").order("start_date"),
      ]);
      return { residences: res.data ?? [], rooms: rooms.data ?? [], semesters: sems.data ?? [] };
    },
  });
  const [residenceId, setResidenceId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [occupants, setOccupants] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const rooms = useMemo(() => (options?.rooms ?? []).filter((r) => r.residence_id === residenceId && r.status !== "maintenance"), [options, residenceId]);
  const room = rooms.find((r) => r.id === roomId);
  const spaceLeft = room ? room.max_occupancy - room.current_occupants : 0;
  const overCapacity = room ? occupants > spaceLeft : false;

  function pickFile(f?: File) {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setError("Profile picture must be JPG, PNG or WebP.");
    if (f.size > MAX_MB * 1024 * 1024) return setError(`Profile picture must be under ${MAX_MB}MB.`);
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = schema.safeParse(fd);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form");
    if (!file) return setError("Please upload a profile picture.");
    if (overCapacity) return setError(`This room has space for ${spaceLeft} more person(s).`);
    const d = parsed.data;
    setBusy(true);
    setError("");
    try {
      const { data: su, error: suErr } = await supabase.auth.signUp({
        email: d.email,
        password: d.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: d.full_name, phone: normalizeKePhone(d.phone), location: d.location, gender: d.gender },
        },
      });
      if (suErr) throw new Error(suErr.message.includes("registered") ? "An account with this email already exists." : suErr.message);
      const uid = su.user?.id;
      if (!uid || !su.session) throw new Error("Could not create your account. Please try again.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
      if (up.error) throw new Error("Profile picture upload failed.");
      await supabase.from("profiles").update({ avatar_path: path }).eq("id", uid);
      const { data: reg, error: regErr } = await supabase.from("registrations").insert({
        user_id: uid, residence_id: residenceId, room_id: d.room_id, semester_id: d.semester_id, occupants: d.occupants,
      }).select("reference").single();
      if (regErr) throw new Error("Could not save your application.");
      setDone(reg.reference);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted">
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1fr_2fr]">
        <aside className="relative hidden overflow-hidden rounded-2xl lg:block">
          <img src={building} alt="Capital Home Residence" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-hero-overlay" />
          <div className="relative p-8 text-primary-foreground">
            <h1 className="text-5xl font-semibold leading-tight">Find your home <span className="text-gold">away from home</span></h1>
            <p className="mt-4 text-primary-foreground/80">Register today to secure your room for the semester.</p>
          </div>
        </aside>
        {done ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border bg-card p-10 text-center shadow-elegant">
            <CheckCircle2 className="h-14 w-14 text-leaf" />
            <h2 className="mt-4 text-4xl font-semibold">Application submitted</h2>
            <p className="mt-2 text-muted-foreground">Your registration reference is</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-primary">{done}</p>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">Status: Pending approval. The landlord will review your application — sign in any time to check its status.</p>
            <Button asChild className="mt-6"><Link to="/dashboard">Go to my account</Link></Button>
          </div>
        ) : (
          <form className="space-y-6 rounded-2xl border bg-card p-8 shadow-elegant" onSubmit={submit} noValidate>
            <div>
              <h2 className="flex items-center gap-3 text-4xl font-semibold"><UserPlus className="h-8 w-8 text-gold" />Tenant Registration</h2>
              <p className="text-sm text-muted-foreground">Fill in your details to create your account and apply for a room.</p>
            </div>
            <Section n={1} title="Personal information">
              <Field label="Full name"><Input name="full_name" /></Field>
              <Field label="Email"><Input name="email" type="email" /></Field>
              <Field label="Phone number"><Input name="phone" placeholder="0712 345 678" /></Field>
              <Field label="Password"><Input name="password" type="password" /></Field>
              <Field label="Confirm password"><Input name="confirm" type="password" /></Field>
              <Field label="Current location"><Input name="location" placeholder="e.g. Nairobi" /></Field>
            </Section>
            <Section n={2} title="Residence & room">
              <Field label="Residence / block">
                <select className={selectCls} value={residenceId} onChange={(e) => { setResidenceId(e.target.value); setRoomId(""); }}>
                  <option value="">Select</option>
                  {options?.residences.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Room number">
                <select name="room_id" className={selectCls} value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={!residenceId}>
                  <option value="">{residenceId ? (rooms.length ? "Select room" : "No rooms available") : "Select a block first"}</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number} — {ksh(r.semester_price_cents)}</option>)}
                </select>
              </Field>
              <Field label="Occupants (incl. you)"><Input name="occupants" type="number" min={1} step={1} value={occupants} onChange={(e) => setOccupants(Number(e.target.value))} /></Field>
            </Section>
            {room && (
              <p className={`flex gap-2 rounded-lg p-3 text-xs ${overCapacity ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}`}>
                <Info className="h-4 w-4 shrink-0" />
                {room.room_number}: max {room.max_occupancy} people, {spaceLeft} space(s) left. Rent {ksh(room.semester_price_cents)} per semester.
              </p>
            )}
            <Section n={3} title="Academic details">
              <Field label="Semester">
                <select name="semester_id" className={selectCls} defaultValue="">
                  <option value="">Select</option>
                  {options?.semesters.map((s) => <option key={s.id} value={s.id}>{s.academic_year} · {s.name}</option>)}
                </select>
              </Field>
              <Field label="Gender">
                <select name="gender" className={selectCls} defaultValue="">
                  <option value="" disabled>Select</option>
                  <option value="male">Male</option><option value="female">Female</option><option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </Field>
            </Section>
            <div className="border-t pt-6">
              <p className="mb-4 flex items-center gap-3 font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">4</span>Profile picture</p>
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex flex-1 cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-6 text-sm text-muted-foreground hover:bg-muted">
                  <Upload className="mb-2 h-6 w-6 text-primary" />{file ? "Click to replace photo" : `Click to upload (JPG, PNG, WebP · max ${MAX_MB}MB)`}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
                </label>
                <div className="h-24 w-24 overflow-hidden rounded-full bg-secondary">{preview && <img src={preview} alt="Preview" className="h-full w-full object-cover" />}</div>
              </div>
            </div>
            {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Register</Button>
            <p className="text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-medium text-primary underline">Login here</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}
