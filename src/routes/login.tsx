import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock } from "lucide-react";
import building from "@/assets/building.png.asset.json";
import logo from "@/assets/logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Capital Home Residence Rentals" },
      { name: "description", content: "Sign in to your Capital Home Residence tenant or admin account." },
      { property: "og:title", content: "Login — Capital Home Residence" },
      { property: "og:description", content: "One login for tenants and the landlord." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [msg, setMsg] = useState("");
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={building.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="relative flex h-full flex-col justify-end p-12 text-primary-foreground">
          <p className="font-display text-5xl">Welcome home.</p>
          <p className="mt-3 text-primary-foreground/80">Manage your room, rent and receipts in one place.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form
          className="w-full max-w-sm space-y-6"
          onSubmit={(e) => { e.preventDefault(); setMsg("Accounts are being set up — sign-in opens soon."); }}
        >
          <Link to="/"><img src={logo.url} alt="Capital Home Residence" className="mx-auto h-24 w-auto" /></Link>
          <div className="text-center">
            <h1 className="text-4xl font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground">Tenants and landlord use the same login.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative"><Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="email" type="email" required className="pl-9" /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Password</Label>
            <div className="relative"><Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="pw" type="password" required className="pl-9" /></div>
          </div>
          <Button type="submit" className="w-full" size="lg">Sign in</Button>
          {msg && <p className="text-center text-sm text-muted-foreground">{msg}</p>}
          <p className="text-center text-sm text-muted-foreground">
            New tenant? <Link to="/register" className="font-medium text-primary underline">Register here</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
