import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements } from "@/hooks/useEntitlements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, ShoppingBag, TrendingUp, Users, Sparkles, Pencil, Bell, ExternalLink,
  Megaphone, BarChart3, ChevronDown, ChevronUp, Check, RefreshCw, Eye, Mail, Target,
  CreditCard, Store, Package, BookOpen, Repeat, GraduationCap, Briefcase, Calendar,
  Box, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ReferralBanner } from "@/components/wazeer/ReferralBanner";
import { IntegrationSetupBanner } from "@/components/wazeer/IntegrationSetupBanner";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

type Business = { id: string; name: string; type: string; created_at: string };
type Storefront = { business_id: string; slug: string; status: string };

type Counts = {
  visits: number;
  earnings: number;
  customers: number;
  hasOffer: boolean;
  hasPublishedStore: boolean;
  hasEmailCampaign: boolean;
  hasMetaAd: boolean;
  currency: string;
};

type LoadState = "loading" | "ok" | "error";

const PRODUCT_TYPES = [
  { id: "physical_product", label: "Physical product", icon: Box, desc: "Items you ship to customers" },
  { id: "digital_product", label: "Digital product", icon: Package, desc: "Files, downloads, templates" },
  { id: "service", label: "Service", icon: Briefcase, desc: "Done-for-you work" },
  { id: "subscription", label: "Subscription", icon: Repeat, desc: "Recurring access" },
  { id: "course", label: "Course", icon: BookOpen, desc: "Lessons & cohorts" },
  { id: "coaching", label: "Coaching", icon: GraduationCap, desc: "1:1 or group programs" },
  { id: "membership", label: "Membership", icon: Users, desc: "Private community" },
  { id: "event", label: "Event", icon: Calendar, desc: "In-person or virtual" },
] as const;

function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: ent, loading: entLoading } = useEntitlements();

  const [business, setBusiness] = useState<Business | null>(null);
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [bizState, setBizState] = useState<LoadState>("loading");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [countsState, setCountsState] = useState<LoadState>("loading");

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(true);

  const loadBusiness = async () => {
    setBizState("loading");
    try {
      const { data: b, error } = await supabase
        .from("businesses")
        .select("id, name, type, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setBusiness((b as Business) ?? null);
      if (b?.id) {
        const { data: s } = await supabase
          .from("storefronts")
          .select("business_id, slug, status")
          .eq("business_id", b.id)
          .maybeSingle();
        setStorefront((s as Storefront) ?? null);
      } else {
        setStorefront(null);
      }
      setBizState("ok");
    } catch (e) {
      console.error("[dashboard] business load failed", e);
      setBizState("error");
      toast.error(e instanceof Error ? e.message : "Couldn't load your business. Refresh to retry.");
    }
  };

  const loadCounts = async (bid: string | null, currency: string) => {
    setCountsState("loading");
    try {
      if (!bid) {
        setCounts({ visits: 0, earnings: 0, customers: 0, hasOffer: false, hasPublishedStore: false, hasEmailCampaign: false, hasMetaAd: false, currency });
        setCountsState("ok");
        return;
      }
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const iso = monthStart.toISOString();

      const [contactsR, ordersR, snapshotsR, offersR, emailR, adR, storeR] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("business_id", bid),
        supabase.from("orders").select("amount, currency, payment_status, created_at").eq("business_id", bid).gte("created_at", iso),
        supabase.from("performance_snapshots").select("metrics_json, period_start").eq("business_id", bid).gte("period_start", iso),
        supabase.from("offers").select("id", { count: "exact", head: true }).eq("business_id", bid),
        supabase.from("email_campaigns").select("id", { count: "exact", head: true }).eq("business_id", bid),
        supabase.from("meta_ads").select("id", { count: "exact", head: true }).eq("business_id", bid),
        supabase.from("storefronts").select("status").eq("business_id", bid).eq("status", "published"),
      ]);

      const earnings = (ordersR.data ?? [])
        .filter((o) => o.payment_status === "paid")
        .reduce((sum, o) => sum + Number(o.amount ?? 0), 0);

      const visits = (snapshotsR.data ?? []).reduce((sum, s) => {
        const m = (s.metrics_json ?? {}) as Record<string, unknown>;
        const v = Number(m.visits ?? m.views ?? 0);
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0);

      setCounts({
        visits,
        earnings,
        customers: contactsR.count ?? 0,
        hasOffer: (offersR.count ?? 0) > 0,
        hasPublishedStore: (storeR.data ?? []).length > 0,
        hasEmailCampaign: (emailR.count ?? 0) > 0,
        hasMetaAd: (adR.count ?? 0) > 0,
        currency,
      });
      setCountsState("ok");
    } catch (e) {
      console.error("[dashboard] counts load failed", e);
      setCountsState("error");
      toast.error("Couldn't load your dashboard stats. Refresh to retry.");
    }
  };

  useEffect(() => { void loadBusiness(); }, []);
  useEffect(() => {
    const cur = ent?.plan_meta ? "USD" : "USD";
    void loadCounts(business?.id ?? null, cur);
  }, [business?.id, ent?.plan]);

  const saveName = async () => {
    if (!business || !editName.trim()) return;
    setSavingName(true);
    try {
      const { error } = await supabase.from("businesses").update({ name: editName.trim() }).eq("id", business.id);
      if (error) throw error;
      setBusiness({ ...business, name: editName.trim() });
      toast.success("Business name updated");
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update name");
    } finally {
      setSavingName(false);
    }
  };

  const openStorefront = () => {
    if (!storefront?.slug) {
      toast.error("Publish your storefront first to get a public link.");
      return;
    }
    window.open(`/s/${storefront.slug}`, "_blank");
  };

  const goNew = (_type?: string) => {
    setProductPickerOpen(false);
    navigate({ to: "/dashboard/new" });
  };

  // Empty state — no business yet
  if (bizState === "ok" && !business) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto min-h-[70vh] flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-2xl bg-brand-gradient grid place-items-center shadow-glow mb-6">
          <Sparkles className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome! Let's build your selling machine.</h1>
        <p className="text-muted-foreground mt-2 max-w-lg">
          Tell Wazeer about your offer and we'll generate your storefront, brand, emails and ads — ready to launch.
        </p>
        <Link to="/dashboard/new" className="mt-8">
          <Button size="lg" className="bg-brand-gradient text-primary-foreground shadow-glow">
            Create my first product <Plus className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  const checklistItems = [
    {
      key: "product",
      title: "Create your first product",
      desc: "Add an offer customers can buy.",
      done: !!counts?.hasOffer,
      cta: () => setProductPickerOpen(true),
    },
    {
      key: "storefront",
      title: "Set up your storefront",
      desc: "Publish a public page for your business.",
      done: !!counts?.hasPublishedStore,
      cta: () => business && navigate({ to: "/dashboard/storefront/$businessId", params: { businessId: business.id } }),
    },
    {
      key: "payment",
      title: "Connect payment method",
      desc: "Activate a paid plan to take real payments.",
      done: (ent?.plan ?? "trial") !== "trial",
      cta: () => navigate({ to: "/dashboard/billing" }),
    },
    {
      key: "email",
      title: "Create your first email campaign",
      desc: "Re-engage customers automatically.",
      done: !!counts?.hasEmailCampaign,
      cta: () => business && navigate({ to: "/dashboard/emails/$businessId", params: { businessId: business.id } }),
    },
    {
      key: "ad",
      title: "Launch your first ad",
      desc: "Drive traffic to your storefront.",
      done: !!counts?.hasMetaAd,
      cta: () => navigate({ to: "/dashboard/ads/new" }),
    },
  ];
  const doneCount = checklistItems.filter((s) => s.done).length;
  const allDone = doneCount === checklistItems.length;

  const currency = counts?.currency ?? "USD";
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  const kpiCards = [
    {
      label: "Credits remaining",
      value: entLoading ? null : (ent?.credits_balance ?? 0).toLocaleString(),
      sub: <Link to="/dashboard/billing" className="text-xs text-primary hover:underline">Top up →</Link>,
      icon: Sparkles,
      state: entLoading ? "loading" : "ok",
    },
    {
      label: "Visits this month",
      value: countsState === "ok" ? (counts?.visits ?? 0).toLocaleString() : null,
      sub: <span className="text-xs text-muted-foreground">Storefront traffic</span>,
      icon: TrendingUp,
      state: countsState,
    },
    {
      label: "Earnings this month",
      value: countsState === "ok" ? fmtMoney(counts?.earnings ?? 0) : null,
      sub: <span className="text-xs text-muted-foreground">Paid orders</span>,
      icon: ShoppingBag,
      state: countsState,
    },
    {
      label: "Total customers",
      value: countsState === "ok" ? (counts?.customers ?? 0).toLocaleString() : null,
      sub: <span className="text-xs text-muted-foreground">Across all channels</span>,
      icon: Users,
      state: countsState,
    },
  ] as const;

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-6xl">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(" ")[0]}` : ""}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {bizState === "loading" ? (
              <Skeleton className="h-9 w-64" />
            ) : (
              <>
                <h1 className="text-3xl font-semibold tracking-tight truncate">{business?.name ?? "Your business"}</h1>
                <button
                  onClick={() => { setEditName(business?.name ?? ""); setEditOpen(true); }}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
                  aria-label="Edit business name"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openStorefront} disabled={!storefront?.slug}>
            <Eye className="h-4 w-4" /> Preview my store <ExternalLink className="h-3.5 w-3.5 ml-0.5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
          </Button>
        </div>
      </header>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{k.label}</span>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-semibold min-h-[2rem] flex items-center gap-2">
              {k.state === "loading" ? (
                <Skeleton className="h-7 w-20" />
              ) : k.state === "error" ? (
                <>
                  <span className="text-muted-foreground">—</span>
                  <button
                    onClick={() => business && loadCounts(business.id, currency)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Retry"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </>
              ) : (
                k.value
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              {k.sub}
              <Sparkline />
            </div>
          </div>
        ))}
      </div>

      {/* Integration setup banner */}
      <IntegrationSetupBanner />

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Button
          size="lg"
          className="bg-brand-gradient text-primary-foreground shadow-glow justify-start h-auto py-4"
          onClick={() => setProductPickerOpen(true)}
        >
          <Plus className="h-5 w-5" />
          <div className="text-left">
            <div className="font-semibold">Create Product</div>
            <div className="text-xs opacity-90 font-normal">Add a new offer</div>
          </div>
        </Button>
        <Link to="/dashboard/posts" className="block">
          <Button variant="outline" size="lg" className="w-full justify-start h-auto py-4">
            <Megaphone className="h-5 w-5" />
            <div className="text-left">
              <div className="font-semibold">Run Marketing</div>
              <div className="text-xs text-muted-foreground font-normal">Posts & campaigns</div>
            </div>
          </Button>
        </Link>
        <Link to="/dashboard/analytics" className="block">
          <Button variant="outline" size="lg" className="w-full justify-start h-auto py-4">
            <BarChart3 className="h-5 w-5" />
            <div className="text-left">
              <div className="font-semibold">View Earnings</div>
              <div className="text-xs text-muted-foreground font-normal">Revenue & insights</div>
            </div>
          </Button>
        </Link>
      </div>

      {/* Referral */}
      <section className="rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="h-4 w-4 text-emerald-brand" />
          <span className="text-sm font-semibold">Give $15, Get $15</span>
        </div>
        <ReferralBanner />
      </section>

      {/* Action center checklist */}
      {!allDone && (
        <section className="rounded-2xl border bg-card overflow-hidden">
          <button
            onClick={() => setChecklistOpen((o) => !o)}
            className="w-full flex items-center justify-between p-5 hover:bg-secondary/40 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-brand-gradient grid place-items-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="text-left min-w-0">
                <div className="font-semibold">Get Started</div>
                <div className="text-xs text-muted-foreground">{doneCount} of {checklistItems.length} complete</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block w-32"><Progress value={(doneCount / checklistItems.length) * 100} /></div>
              {checklistOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>
          {checklistOpen && (
            <ul className="border-t divide-y">
              {checklistItems.map((s) => {
                const Icon = s.key === "product" ? Package
                  : s.key === "storefront" ? Store
                  : s.key === "payment" ? CreditCard
                  : s.key === "email" ? Mail
                  : Target;
                return (
                  <li key={s.key} className="flex items-center gap-4 p-4">
                    <div className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${s.done ? "bg-brand-gradient text-primary-foreground" : "border bg-background text-muted-foreground"}`}>
                      {s.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${s.done ? "line-through text-muted-foreground" : ""}`}>{s.title}</div>
                      <div className="text-xs text-muted-foreground">{s.desc}</div>
                    </div>
                    {!s.done && (
                      <Button variant="ghost" size="sm" onClick={s.cta}>Set up →</Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Edit name dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename business</DialogTitle></DialogHeader>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Business name" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveName} disabled={savingName || !editName.trim()}>
              {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product type picker */}
      <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>What are you creating?</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {PRODUCT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => goNew(t.id)}
                className="rounded-xl border bg-card p-4 text-left hover:border-foreground hover:shadow-soft transition-all"
              >
                <t.icon className="h-5 w-5 mb-2" />
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Sparkline() {
  // Lightweight decorative trend line (no real data yet)
  const points = "0,12 8,9 16,11 24,6 32,8 40,4 48,5 56,2";
  return (
    <svg width="56" height="14" viewBox="0 0 56 14" className="text-primary/60" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}
