import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Smartphone, BedDouble, ArrowRight } from "lucide-react";
import building from "@/assets/building.webp";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Capital Home Residence Rentals — Welcome" },
      { name: "description", content: "Register or sign in to view rooms, apply and pay rent via M-Pesa at Capital Home Residence." },
      { property: "og:title", content: "Capital Home Residence Rentals" },
      { property: "og:description", content: "Safe, comfortable student rooms. Register or sign in to get started." },
    ],
  }),
  component: Landing,
});

const points = [
  { icon: BedDouble, text: "Choose your residence and room" },
  { icon: ShieldCheck, text: "Secure, landlord-approved tenancy" },
  { icon: Smartphone, text: "Pay rent in full or installments via M-Pesa" },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)); }, []);

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
      <img src={building.url} alt="Capital Home Residence building" className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_30%]" />
      <div className="absolute inset-0 -z-10 bg-hero-overlay" />
      <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-6 py-12 lg:grid-cols-[1.2fr_1fr]">
        <div className="text-primary-foreground">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gold">Welcome to</p>
          <h1 className="mt-3 text-5xl font-semibold leading-[1.05] md:text-7xl">Capital Home <span className="text-gold">Residence</span></h1>
          <p className="mt-6 max-w-lg text-lg text-primary-foreground/80">Your home away from home. Sign in or create an account to explore rooms and manage your stay.</p>
          <ul className="mt-8 space-y-3">
            {points.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-primary-foreground/90">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10"><p.icon className="h-4 w-4 text-gold" /></span>{p.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border bg-card/95 p-8 shadow-elegant backdrop-blur md:p-10">
          <img src={logo.url} alt="Capital Home Residence logo" className="mx-auto h-28 w-auto" />
          {signedIn ? (
            <div className="mt-8 space-y-3">
              <p className="text-center text-muted-foreground">You're signed in.</p>
              <Button asChild size="lg" variant="gold" className="w-full"><Link to="/home">Continue to homepage <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline" className="w-full"><Link to="/dashboard">My dashboard</Link></Button>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <div className="text-center">
                <h2 className="text-3xl font-semibold">Get started</h2>
                <p className="text-sm text-muted-foreground">New tenants register first. Returning tenants and the landlord sign in.</p>
              </div>
              <Button asChild size="lg" variant="gold" className="w-full"><Link to="/register">Register as a new tenant</Link></Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />already have an account?<span className="h-px flex-1 bg-border" /></div>
              <Button asChild size="lg" className="w-full"><Link to="/login">Sign in</Link></Button>
            </div>
          )}
        </div>
      </main>
      <footer className="pb-6 text-center text-xs text-primary-foreground/60">© {new Date().getFullYear()} Capital Home Residence Rentals</footer>
    </div>
  );
}
