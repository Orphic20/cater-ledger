import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { CalendarDays, ChartColumn, ClipboardList, LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

function BrandLockup() {
  return (
    <Link href="/" className="brand-lockup">
      <span className="brand-mark"><img src="/lai-logo.webp" alt="" /></span>
      <span className="brand-name">
        <strong>LAi Catering</strong>
        <small>CLIENT, SOA, AND EVENT TRACKER</small>
      </span>
    </Link>
  );
}

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/soa", label: "SOA Tracker", icon: ClipboardList },
  { href: "/insights", label: "Insights", icon: ChartColumn },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const queryClient = useQueryClient();
  const activeFor = (href: string) => {
    if (href === "/") return path === "/" || path.startsWith("/clients/");
    if (href === "/soa") return path.startsWith("/soa");
    if (href === "/insights") return path.startsWith("/insights");
    return path.startsWith("/calendar");
  };
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Couldn’t sign out");
      return;
    }
    queryClient.clear();
  }
  return <div className="app-frame">
    <aside className="sidebar">
      <BrandLockup />
      <div className="nav-label">MAIN MENU</div>
      <nav className="side-nav" aria-label="Main navigation">{items.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={activeFor(item.href) ? "nav-link active" : "nav-link"}><Icon size={18} /><span>{item.label}</span></Link>; })}</nav>
      <div className="sidebar-note"><span className="note-dot" />A clear view of what’s billed and due.</div>
      <div className="sidebar-footer">Agency &amp; billing tracker<button type="button" className="sign-out" onClick={() => { void signOut(); }}>Sign out</button></div>
    </aside>
    <div className="main-column">
      <header className="mobile-header"><BrandLockup /><button type="button" className="sign-out" onClick={() => { void signOut(); }}>Sign out</button></header>
      <main className="main-content">{children}</main>
      <nav className="mobile-nav" aria-label="Main navigation">{items.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={activeFor(item.href) ? "mobile-nav-link active" : "mobile-nav-link"}><Icon size={20} /><span>{item.label}</span></Link>; })}</nav>
    </div>
  </div>;
}
