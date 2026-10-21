import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { UserPlus, Upload, Info } from "lucide-react";
import building from "@/assets/building.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site/SiteHeader";

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

const selectCls = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  return (
    <div className="min-h-screen bg-muted">
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1fr_2fr]">
        <aside className="relative hidden overflow-hidden rounded-2xl lg:block">
          <img src={building.url} alt="Capital Home Residence" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-hero-overlay" />
          <div className="relative p-8 text-primary-foreground">
            <h1 className="text-5xl font-semibold leading-tight">Find your home <span className="text-gold">away from home</span></h1>
            <p className="mt-4 text-primary-foreground/80">Register today to secure your room for the semester.</p>
          </div>
        </aside>
        <form
          className="space-y-6 rounded-2xl border bg-card p-8 shadow-elegant"
          onSubmit={(e) => { e.preventDefault(); setMsg("Thanks! Online applications open shortly — please check back soon."); }}
        >
          <div>
            <h2 className="flex items-center gap-3 text-4xl font-semibold"><UserPlus className="h-8 w-8 text-gold" />Tenant Registration</h2>
            <p className="text-sm text-muted-foreground">Fill in your details to create your account and apply for a room.</p>
          </div>
          <Section n={1} title="Personal information">
            <Field label="Full name"><Input required /></Field>
            <Field label="Email"><Input type="email" required /></Field>
            <Field label="Phone number"><Input placeholder="+254 712 345 678" required pattern="^(\+?254|0)?[17]\d{8}$" /></Field>
            <Field label="Password"><Input type="password" minLength={8} required /></Field>
            <Field label="Confirm password"><Input type="password" minLength={8} required /></Field>
            <Field label="Current location"><Input placeholder="e.g. Nairobi" required /></Field>
          </Section>
          <Section n={2} title="Residence & room">
            <Field label="Residence / block">
              <select className={selectCls} required defaultValue=""><option value="" disabled>Select</option><option>Capital Home Residence</option><option>Old Rooms</option><option>New Block Wing</option><option>Duka Moja</option></select>
            </Field>
            <Field label="Room number"><select className={selectCls} required defaultValue=""><option value="" disabled>Select a block first</option></select></Field>
            <Field label="Occupants (incl. you)"><Input type="number" min={1} step={1} defaultValue={1} required /></Field>
          </Section>
          <Section n={3} title="Academic details">
            <Field label="Academic year"><select className={selectCls} required defaultValue=""><option value="" disabled>Select</option><option>2026/2027</option></select></Field>
            <Field label="Semester"><select className={selectCls} required defaultValue=""><option value="" disabled>Select</option><option>Semester 1</option><option>Semester 2</option></select></Field>
            <Field label="Gender"><select className={selectCls} required defaultValue=""><option value="" disabled>Select</option><option>Male</option><option>Female</option><option>Prefer not to say</option></select></Field>
          </Section>
          <div className="border-t pt-6">
            <p className="mb-4 flex items-center gap-3 font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">4</span>Profile picture</p>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex flex-1 cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-6 text-sm text-muted-foreground hover:bg-muted">
                <Upload className="mb-2 h-6 w-6 text-primary" />Click to upload (JPG, PNG, WebP · max 5MB)
                <input type="file" accept="image/jpeg,image/png,image/webp" required className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setPreview(URL.createObjectURL(f)); }} />
              </label>
              <div className="h-24 w-24 overflow-hidden rounded-full bg-secondary">{preview && <img src={preview} alt="Preview" className="h-full w-full object-cover" />}</div>
            </div>
          </div>
          <p className="flex gap-2 rounded-lg bg-secondary p-3 text-xs text-secondary-foreground"><Info className="h-4 w-4 shrink-0" />Each room has a maximum occupancy. Applications are reviewed by the landlord before access is granted.</p>
          <Button type="submit" size="lg" className="w-full">Register</Button>
          {msg && <p className="text-center text-sm text-primary">{msg}</p>}
          <p className="text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-medium text-primary underline">Login here</Link></p>
        </form>
      </div>
    </div>
  );
}
