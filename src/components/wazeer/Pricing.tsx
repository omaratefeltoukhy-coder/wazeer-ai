import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Starter", price: "$19", tagline: "For getting your first sale",
    features: ["1 business", "50 AI credits / mo", "20 AI images", "5 UGC videos", "5 email campaigns", "Meta post scheduling"],
    cta: "Start free trial",
  },
  {
    name: "Growth", price: "$49", tagline: "For scaling content & ads", highlight: true,
    features: ["3 businesses", "200 AI credits", "100 AI images", "20 UGC videos", "Email automation", "Meta ads launch", "AI recommendations"],
    cta: "Start free trial",
  },
  {
    name: "Pro", price: "$99", tagline: "For serious operators",
    features: ["10 businesses", "600 AI credits", "300 AI images", "60 UGC videos", "Advanced Meta ads", "Subscription analytics", "Priority recs"],
    cta: "Start free trial",
  },
  {
    name: "Agency", price: "$249", tagline: "For teams & client work",
    features: ["Unlimited businesses", "2,000 AI credits", "White-label", "Team members", "Client dashboards", "Priority support"],
    cta: "Talk to sales",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-medium text-emerald-brand">Pricing</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold">Start free. Grow on your terms.</h2>
          <p className="mt-3 text-muted-foreground">7-day free trial on every plan. Cancel anytime.</p>
        </div>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-2xl border bg-card p-6 flex flex-col ${
                t.highlight ? "shadow-glow border-royal/40" : "shadow-soft"
              }`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground bg-brand-gradient px-2.5 py-1 rounded-full">
                  Most popular
                </div>
              )}
              <h3 className="font-semibold">{t.name}</h3>
              <p className="text-sm text-muted-foreground">{t.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{t.price}</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <ul className="mt-5 space-y-2.5 text-sm flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-brand mt-0.5 shrink-0" />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`mt-6 w-full ${
                  t.highlight ? "bg-brand-gradient text-primary-foreground shadow-glow" : "bg-foreground text-background"
                }`}
              >
                {t.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
