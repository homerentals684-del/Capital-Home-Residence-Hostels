import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { LogOut, PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "./NotificationBell";
import { supabase } from "@/integrations/supabase/client";

export type NavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  section?: string;
  to?: string;
};

export function AppShell({ title, name, nav, active, onNavigate, children }: {
  title: string;
  name?: string | undefined;
  nav?: NavItem[];
  active?: string;
  onNavigate?: (key: string) => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections = (nav ?? []).reduce<{ name: string; items: NavItem[] }[]>((acc, item) => {
    const sec = item.section ?? "";
    const last = acc.at(-1);
    if (last && last.name === sec) last.items.push(item);
    else acc.push({ name: sec, items: [item] });
    return acc;
  }, []);

  const sidebar = (
    <aside className={`flex h-full flex-col bg-sidebar text-sidebar-foreground transition-all ${collapsed ? "w-16" : "w-64"}`}>
      <div className={`flex items-center gap-3 border-b border-sidebar-border p-4 ${collapsed ? "justify-center" : ""}`}>
        <img src={logo} alt="Capital Home Residence" className="h-10 w-auto shrink-0" />
        {!collapsed && (
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold tracking-wide">CAPITAL</p>
            <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Home Residence Hostels</p>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {sections.map((sec, i) => (
          <div key={i}>
            {sec.name && !collapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">{sec.name}</p>
            )}
            <div className="space-y-1">
              {sec.items.map((item) => {
                const cls = `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${collapsed ? "justify-center px-0" : ""} ${
                  active === item.key
                    ? "bg-gradient-gold font-semibold text-gold-foreground shadow-gold"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`;
                const inner = (<><item.icon className="h-4 w-4 shrink-0" />{!collapsed && <span className="truncate">{item.label}</span>}</>);
                return item.to ? (
                  <Link key={item.key} to={item.to} className={cls} title={item.label} onClick={() => setMobileOpen(false)}>{inner}</Link>
                ) : (
                  <button key={item.key} type="button" className={cls} title={item.label} onClick={() => { onNavigate?.(item.key); setMobileOpen(false); }}>{inner}</button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={async () => { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: "/login", replace: true }); }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent ${collapsed ? "justify-center px-0" : ""}`}
        >
          <LogOut className="h-4 w-4 shrink-0" />{!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-muted">
      <div className={`sticky top-0 hidden h-screen shrink-0 md:block`}>{sidebar}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 z-50">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-card">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setMobileOpen(true)}><PanelLeftOpen /></Button>
              <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => setCollapsed(!collapsed)}>
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
              <span className="text-sm font-medium text-muted-foreground">{title}</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <Button asChild variant="ghost" size="sm"><Link to="/home">Home</Link></Button>
              {name && <span className="hidden text-sm sm:block">{name}</span>}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
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
