import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";
import building from "@/assets/building.webp";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { SIGN_IN_DESTINATION } from "@/lib/account-navigation";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Login — Capital Home Residence Rentals" },
      { name: "description", content: "Sign in to your Capital Home Residence tenant or admin account." },
      { property: "og:title", content: "Login — Capital Home Residence" },
      { property: "og:description", content: "One login for tenants and the landlord." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError("Incorrect email or password.");
    navigate({ to: SIGN_IN_DESTINATION, replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={building} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="relative flex h-full flex-col justify-end p-12 text-primary-foreground">
          <p className="font-display text-5xl">Welcome home.</p>
          <p className="mt-3 text-primary-foreground/80">Manage your room, rent and receipts in one place.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form className="w-full max-w-sm space-y-6" onSubmit={submit}>
          <Link to="/"><img src={logo} alt="Capital Home Residence" className="mx-auto h-24 w-auto" /></Link>
          <div className="text-center">
            <h1 className="text-4xl font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground">Tenants and landlord use the same login.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative"><Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Password</Label>
            <div className="relative"><Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" /></div>
          </div>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}Sign in
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            New tenant? <Link to="/register" className="font-medium text-primary underline">Register here</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
