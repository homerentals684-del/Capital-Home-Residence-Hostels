import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Home, GraduationCap, Smartphone, BedDouble, Users } from "lucide-react";
import building from "@/assets/building.webp";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site/SiteHeader";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Rooms & Residences — Capital Home Residence" },
      { name: "description", content: "Safe, comfortable student rooms. Register, pick your room and pay rent via M-Pesa." },
      { property: "og:title", content: "Capital Home Residence Rentals" },
      { property: "og:description", content: "Safe, comfortable student rooms with easy M-Pesa rent payments." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: ShieldCheck, title: "Safe & Secure", text: "Gated, well-maintained premises." },
  { icon: Home, title: "Comfortable Living", text: "Clean, spacious rooms." },
  { icon: GraduationCap, title: "Student Friendly", text: "Semester-based rent." },
  { icon: Smartphone, title: "Pay via M-Pesa", text: "Partial or full payments." },
];

const blocks = [
  { name: "Old Rooms", price: "15,000", text: "Affordable, well-kept rooms in the original wing." },
  { name: "New Block Wing", price: "25,000", text: "Modern rooms with large windows and fresh finishes." },
  { name: "Duka Moja", price: "—", text: "Convenient rooms close to amenities. Ask for pricing." },
];

function Index() {
  return (
    <div className="min-h-screen">
      <SiteHeader signedIn />
      <section className="relative isolate overflow-hidden">
        <img src={building.url} alt="Capital Home Residence building" className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_30%]" />
        <div className="absolute inset-0 -z-10 bg-hero-overlay" />
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gold">Capital Home Residence</p>
          <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-[1.05] text-primary-foreground md:text-7xl">
            Your home away <span className="text-gold">from home.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-primary-foreground/80">
            Register online, choose your room, and manage semester rent with secure M-Pesa payments — all in one place.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild variant="gold" size="lg"><Link to="/dashboard">My dashboard</Link></Button>
            <Button asChild variant="heroOutline" size="lg"><a href="#rooms">View rooms</a></Button>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-12 grid max-w-7xl gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-6 shadow-elegant">
            <f.icon className="h-8 w-8 text-gold" />
            <p className="mt-4 font-semibold">{f.title}</p>
            <p className="text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <section id="rooms" className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="text-4xl font-semibold md:text-5xl">Residences & blocks</h2>
        <p className="mt-2 text-muted-foreground">Rent is charged per semester.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {blocks.map((b) => (
            <div key={b.name} className="group rounded-2xl border bg-card p-8 transition hover:-translate-y-1 hover:shadow-elegant">
              <BedDouble className="h-7 w-7 text-primary" />
              <h3 className="mt-4 text-2xl font-semibold">{b.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.text}</p>
              <p className="mt-6 text-3xl font-semibold text-primary">
                {b.price !== "—" ? <>KSh {b.price}<span className="text-sm font-normal text-muted-foreground"> / semester</span></> : "On request"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-navy">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-16 md:flex-row md:items-center">
          <div className="flex items-center gap-4 text-primary-foreground">
            <Users className="h-10 w-10 text-gold" />
            <p className="font-display text-3xl">Ready to secure your room this semester?</p>
          </div>
          <Button asChild variant="gold" size="lg"><Link to="/dashboard">Go to my dashboard</Link></Button>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
