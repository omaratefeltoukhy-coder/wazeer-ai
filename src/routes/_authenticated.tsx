import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";
import { Logo } from "@/components/wazeer/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard, ShoppingBag, Image as ImageIcon, Video, Mail, Megaphone, Target, Link2,
  BarChart3, Settings, LogOut, Plus, Loader2, CreditCard, Sparkles, FileVideo, Workflow, Users, Menu, Package,
  DollarSign, Receipt, Wallet, Wand2, Link as LinkIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };
type NavSection = { heading?: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/dashboard/products", label: "Products", icon: Package },
      { to: "/dashboard/storefront", label: "Storefront", icon: ShoppingBag },
    ],
  },
  {
    heading: "Money",
    items: [
      { to: "/dashboard/earnings", label: "Earnings", icon: DollarSign },
      { to: "/dashboard/transactions", label: "Transactions", icon: Receipt },
      { to: "/dashboard/payment-links", label: "Payment Links", icon: LinkIcon },
      { to: "/dashboard/payouts", label: "Payouts", icon: Wallet },
    ],
  },
  {
    heading: "Marketing",
    items: [
      { to: "/dashboard/content", label: "Content Studio", icon: Wand2 },
      { to: "/dashboard/images", label: "AI Images", icon: ImageIcon },
      { to: "/dashboard/ugc", label: "UGC Scripts", icon: FileVideo },
      { to: "/dashboard/videos", label: "AI Videos", icon: Video },
      { to: "/dashboard/emails", label: "Emails", icon: Mail },
      { to: "/dashboard/email/campaigns", label: "Email Marketing", icon: Mail },
      { to: "/dashboard/automations", label: "Automations", icon: Workflow },
      { to: "/dashboard/contacts", label: "Contacts", icon: Users },
      { to: "/dashboard/posts", label: "Meta Posts", icon: Megaphone },
      { to: "/dashboard/ads", label: "Meta Ads", icon: Target },
    ],
  },
  {
    items: [
      { to: "/dashboard/integrations/meta", label: "Integrations", icon: Link2 },
      { to: "/dashboard/integrations/pixels", label: "Tracking Pixels", icon: Target },
      { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/dashboard/billing", label: "Plans & Credits", icon: CreditCard },
      { to: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

function NavList({
  pathname,
  onNavigate,
  ent,
  email,
  onSignOut,
}: {
  pathname: string;
  onNavigate?: () => void;
  ent: ReturnType<typeof useEntitlements>["data"];
  email: string;
  onSignOut: () => void;
}) {
  return (
    <>
      <div className="px-2 py-2"><Logo /></div>
      <Link
        to="/dashboard/new"
        onClick={onNavigate}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient text-primary-foreground px-3 py-2 text-sm font-medium shadow-glow"
      >
        <Plus className="h-4 w-4" /> New business
      </Link>
      <nav className="mt-6 space-y-4 overflow-y-auto">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.heading && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{section.heading}</div>
            )}
            {section.items.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-auto border-t pt-4 space-y-2">
        {ent && (
          <Link to="/dashboard/billing" onClick={onNavigate} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs hover:bg-secondary/60">
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> {ent.plan_meta.name}</span>
            <span className="text-muted-foreground">{ent.credits_balance} credits</span>
          </Link>
        )}
        <div className="px-3 text-xs text-muted-foreground truncate">{email}</div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onSignOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );
}

function AuthenticatedLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: ent } = useEntitlements();
  const [open, setOpen] = useState(false);

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

  const handleSignOut = async () => { await signOut(); navigate({ to: "/" }); };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card/50 p-4 sticky top-0 h-screen">
        <NavList pathname={pathname} ent={ent} email={user.email ?? ""} onSignOut={handleSignOut} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-2 border-b bg-card/80 backdrop-blur px-4 py-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4 flex flex-col">
              <NavList
                pathname={pathname}
                onNavigate={() => setOpen(false)}
                ent={ent}
                email={user.email ?? ""}
                onSignOut={handleSignOut}
              />
            </SheetContent>
          </Sheet>
          <Logo />
          {ent && (
            <Link to="/dashboard/billing" className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> {ent.credits_balance}
            </Link>
          )}
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
