import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/wazeer/Logo";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Sparkles, ShoppingBag, Image as ImageIcon, Video, Mail, Megaphone,
  BarChart3, Lightbulb, Settings, LogOut, Plus, Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/dashboard/storefront", label: "Storefront", icon: ShoppingBag },
  { to: "/dashboard/images", label: "AI Images", icon: ImageIcon },
  { to: "/dashboard/ugc", label: "UGC Videos", icon: Video },
  { to: "/dashboard/emails", label: "Emails", icon: Mail },
  { to: "/dashboard/meta", label: "Meta", icon: Megaphone },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/recommendations", label: "Recommendations", icon: Lightbulb },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

function AuthenticatedLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    navigate({ to: "/login", search: { redirect: pathname } });
    return null;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card/50 p-4 sticky top-0 h-screen">
        <div className="px-2 py-2"><Logo /></div>
        <Link
          to="/dashboard/new"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient text-primary-foreground px-3 py-2 text-sm font-medium shadow-glow"
        >
          <Plus className="h-4 w-4" /> New business
        </Link>
        <nav className="mt-6 space-y-1">
          {nav.map((n) => {
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t pt-4 space-y-2">
          <div className="px-3 text-xs text-muted-foreground truncate">{user.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
