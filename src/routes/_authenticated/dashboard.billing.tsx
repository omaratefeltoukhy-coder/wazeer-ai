import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useEntitlements } from "@/hooks/useEntitlements";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Loader2, Sparkles, Zap, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { upgradePlan, topUpCredits, listInvoices } from "@/lib/billing/checkout.functions";
import { CREDIT_PACKS } from "@/lib/billing/packs";

export const Route = createFileRoute("/_authenticated/dashboard/billing")({
  component: BillingPage,
});

const ORDER: PlanId[] = ["trial", "starter", "growth", "pro", "agency"];

type InvoiceRow = {
  id: string;
  amount_usd: number;
  currency: string;
  status: string;
  description: string | null;
  kind: string;
  created_at: string;
};

function BillingPage() {
  const { data, loading, refresh } = useEntitlements();
  const upgrade = useServerFn(upgradePlan);
  const topup = useServerFn(topUpCredits);
  const fetchInvoices = useServerFn(listInvoices);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase.from("workspace_members").select("workspace_id").limit(1).single();
      if (m?.workspace_id) {
        setWorkspaceId(m.workspace_id);
        const r = await fetchInvoices({ data: { workspace_id: m.workspace_id } });
        setInvoices(r.invoices as InvoiceRow[]);
      }
    })().catch(() => setInvoices([]));
  }, [fetchInvoices]);

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl space-y-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-80" /><Skeleton className="h-80" /><Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const current = data?.plan ?? "trial";
  const balance = data?.credits_balance ?? 0;
  const monthly = data?.plan_meta.credits_per_month ?? 100;
  const used = Math.max(0, monthly - balance);
  const usedPct = Math.min(100, Math.round((used / monthly) * 100));

  const handleUpgrade = async (plan: PlanId) => {
    if (!workspaceId || plan === "trial") return;
    setBusy(`plan:${plan}`);
    try {
      const r = await upgrade({ data: { workspace_id: workspaceId, plan: plan as "starter" | "growth" | "pro" | "agency" } });
      toast.success(`Switched to ${PLANS[plan].name} (demo mode)`);
      await refresh();
      const inv = await fetchInvoices({ data: { workspace_id: workspaceId } });
      setInvoices(inv.invoices as InvoiceRow[]);
      void r;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upgrade failed");
    } finally { setBusy(null); }
  };

  const handleTopUp = async (packId: string) => {
    if (!workspaceId) return;
    setBusy(`pack:${packId}`);
    try {
      const r = await topup({ data: { workspace_id: workspaceId, pack_id: packId } });
      toast.success(`+${r.credits_added.toLocaleString()} credits added (demo mode)`);
      await refresh();
      const inv = await fetchInvoices({ data: { workspace_id: workspaceId } });
      setInvoices(inv.invoices as InvoiceRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Top-up failed");
    } finally { setBusy(null); }
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Plans & credits</h1>
        <p className="text-muted-foreground mt-1">
          Choose the smallest plan that covers your usage — upgrade anytime. Payments run in demo mode until live billing is enabled.
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Current plan</div>
            <div className="mt-1 text-2xl font-semibold">{data?.plan_meta.name}</div>
            <div className="text-sm text-muted-foreground capitalize mt-1">Status: {data?.status}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Credits remaining</div>
            <div className="mt-1 text-2xl font-semibold">{balance.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">of {monthly.toLocaleString()} this period</div>
          </div>
        </div>
        <div className="mt-5 h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-brand-gradient" style={{ width: `${usedPct}%` }} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Choose your plan</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ORDER.filter((id) => id !== "trial").map((id) => {
            const p = PLANS[id];
            const isCurrent = current === id;
            return (
              <div key={id} className={`relative rounded-2xl border bg-card p-6 flex flex-col ${id === "growth" ? "ring-2 ring-emerald-500/50 shadow-glow" : ""}`}>
                {p.badge && (
                  <div className="absolute -top-3 left-6 rounded-full bg-brand-gradient px-3 py-1 text-xs font-medium text-primary-foreground">
                    {p.badge}
                  </div>
                )}
                <div className="text-sm uppercase tracking-wide text-muted-foreground">{p.name}</div>
                <div className="mt-2 text-3xl font-semibold">${p.price_usd}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                <div className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> {p.credits_per_month.toLocaleString()} credits / month
                </div>
                <ul className="mt-5 space-y-2 text-sm flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                      <span className="capitalize">{f.replace(/_/g, " ")}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`mt-6 ${isCurrent ? "" : "bg-brand-gradient text-primary-foreground shadow-glow"}`}
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || busy === `plan:${id}`}
                  onClick={() => handleUpgrade(id)}
                >
                  {busy === `plan:${id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : isCurrent ? "Current plan" : (
                    <><Sparkles className="h-4 w-4" /> Switch to {p.name}</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1">Need more credits?</h2>
        <p className="text-sm text-muted-foreground mb-4">One-time top-up packs that never expire.</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {CREDIT_PACKS.map((pack) => {
            const total = Math.round(pack.credits * (1 + (pack.bonus_pct ?? 0) / 100));
            return (
              <div key={pack.id} className="relative rounded-2xl border bg-card p-5 flex flex-col">
                {pack.badge && (
                  <div className="absolute -top-3 left-5 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-medium">
                    {pack.badge}
                  </div>
                )}
                <div className="text-2xl font-semibold">{total.toLocaleString()}<span className="text-sm font-normal text-muted-foreground"> credits</span></div>
                {pack.bonus_pct ? (
                  <div className="text-xs text-muted-foreground mt-0.5">{pack.credits.toLocaleString()} + {total - pack.credits} bonus</div>
                ) : null}
                <div className="mt-3 text-lg font-medium">${pack.price_usd}</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  disabled={busy === `pack:${pack.id}`}
                  onClick={() => handleTopUp(pack.id)}
                >
                  {busy === `pack:${pack.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Top up"}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Receipt className="h-5 w-5" /> Billing history</h2>
        <div className="rounded-2xl border bg-card overflow-hidden">
          {invoices === null ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No invoices yet. Upgrade a plan or top up credits to see your history here.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground">
                <tr><th className="text-left p-3">Date</th><th className="text-left p-3">Description</th><th className="text-left p-3">Type</th><th className="text-right p-3">Amount</th><th className="text-left p-3">Status</th></tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="p-3 whitespace-nowrap">{new Date(i.created_at).toLocaleDateString()}</td>
                    <td className="p-3">{i.description ?? "—"}</td>
                    <td className="p-3 capitalize text-muted-foreground">{i.kind}</td>
                    <td className="p-3 text-right">${Number(i.amount_usd).toFixed(2)} {i.currency}</td>
                    <td className="p-3"><span className="inline-flex rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-xs capitalize">{i.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
