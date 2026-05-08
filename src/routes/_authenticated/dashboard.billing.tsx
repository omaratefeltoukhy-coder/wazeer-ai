import { createFileRoute } from "@tanstack/react-router";
import { useEntitlements } from "@/hooks/useEntitlements";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/billing")({
  component: BillingPage,
});

const ORDER: PlanId[] = ["trial", "starter", "growth", "pro", "agency"];

function BillingPage() {
  const { data, loading } = useEntitlements();

  if (loading) {
    return (
      <div className="p-10 grid place-items-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const current = data?.plan ?? "trial";
  const balance = data?.credits_balance ?? 0;
  const monthly = data?.plan_meta.credits_per_month ?? 100;
  const used = Math.max(0, monthly - balance);
  const usedPct = Math.min(100, Math.round((used / monthly) * 100));

  return (
    <div className="p-6 lg:p-10 max-w-6xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Plans & credits</h1>
        <p className="text-muted-foreground mt-1">Wazeer AI recommends choosing the smallest plan that covers your monthly usage — you can upgrade anytime.</p>
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
              <div
                key={id}
                className={`relative rounded-2xl border bg-card p-6 flex flex-col ${id === "growth" ? "ring-2 ring-emerald-500/50 shadow-glow" : ""}`}
              >
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
                  disabled={isCurrent}
                  onClick={() => toast.info("Payments will be enabled in the next step. Your plan stays on Free Trial for now.")}
                >
                  {isCurrent ? "Current plan" : (
                    <>
                      <Sparkles className="h-4 w-4" /> Upgrade
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
