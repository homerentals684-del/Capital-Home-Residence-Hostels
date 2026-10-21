import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import logo from "@/assets/logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ title, name, children }: { title: string; name?: string | undefined; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <img src={logo.url} alt="Capital Home Residence" className="h-11 w-auto" />
            <span className="hidden border-l pl-4 text-sm font-medium text-muted-foreground sm:block">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm"><Link to="/home">Home</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard">Dashboard</Link></Button>
            {name && <span className="hidden text-sm sm:block">{name}</span>}
            <Button variant="outline" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/", replace: true }); }}>
              <LogOut />Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "gold" | "primary" }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone === "gold" ? "text-gold" : "text-primary"}`}>{value}</p>
    </div>
  );
}

export function useAvatarUrl() {
  return async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };
}
