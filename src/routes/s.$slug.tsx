import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { getPublicStorefront } from "@/lib/storefront/public.functions";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ params }) => {
    const res = await getPublicStorefront({ data: { slug: params.slug } });
    if (!res.storefront) throw notFound();
    return res;
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Storefront not found</h1>
        <p className="text-muted-foreground mt-2">This page may have been unpublished.</p>
        <Link to="/" className="text-sm underline mt-4 inline-block">Back home</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => {
    if (typeof console !== "undefined") console.error("Storefront load error:", error);
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground mt-2 text-sm">We couldn't load this page. Please try again later.</p>
        </div>
      </div>
    );
  },
  head: ({ loaderData }) => {
    const sf = loaderData?.storefront as any;
    const title = sf?.title || sf?.content_json?.hero?.headline || "Wazeer AI Storefront";
    const desc = sf?.content_json?.hero?.sub || "Built with Wazeer AI.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: PublicStorefront,
});

function fmtPrice(amount: number, currency: string, interval: string | null) {
  const sym = currency === "USD" ? "$" : `${currency} `;
  const base = `${sym}${Number(amount).toFixed(2)}`;
  if (!interval || interval === "one_time") return base;
  return `${base} / ${interval}`;
}

function PublicStorefront() {
  const { storefront, offer, brand } = Route.useLoaderData() as any;
  const sf = storefront.content_json ?? {};

  const checkout = async () => {
    if (!offer) {
      await confirmDialog({ title: "Checkout not configured", description: "This storefront has no offer attached yet.", confirmText: "OK", cancelText: "Close" });
      return;
    }
    await confirmDialog({
      title: "Demo checkout",
      description: `${offer.name} — ${fmtPrice(offer.price, offer.currency, offer.billing_interval)}. Real payments will be wired via the billing integration.`,
      confirmText: "OK",
      cancelText: "Close",
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-6 py-4 border-b flex items-center justify-between">
        <div className="font-semibold">{brand?.brand_name || storefront.title || "Storefront"}</div>
        <Button size="sm" variant="outline" onClick={checkout}>{sf.hero?.cta || "Get started"}</Button>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 sm:py-28 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground mb-6">
          <Sparkles className="h-3 w-3" /> {brand?.tone || "Premium experience"}
        </div>
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight">{sf.hero?.headline || storefront.title}</h1>
        {sf.hero?.sub && <p className="text-lg text-muted-foreground mt-5 max-w-2xl mx-auto">{sf.hero.sub}</p>}
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Button size="lg" className="bg-brand-gradient text-primary-foreground shadow-glow" onClick={checkout}>
            {sf.hero?.cta || "Get started"}
          </Button>
          {offer && (
            <span className="text-sm text-muted-foreground">{fmtPrice(offer.price, offer.currency, offer.billing_interval)}</span>
          )}
        </div>
        {sf.hero?.image_url && (
          <img src={sf.hero.image_url} alt="" className="mt-12 rounded-2xl border w-full max-w-3xl mx-auto" loading="lazy" />
        )}
      </section>

      {/* Benefits */}
      {Array.isArray(sf.benefits) && sf.benefits.length > 0 && (
        <section className="px-6 py-16 max-w-5xl mx-auto">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sf.benefits.map((b: any, i: number) => (
              <div key={i} className="rounded-2xl border bg-card p-6">
                <div className="h-8 w-8 rounded-xl bg-brand-gradient grid place-items-center mb-3">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="font-semibold">{b.title}</div>
                <p className="mt-2 text-sm text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      {Array.isArray(sf.how_it_works) && sf.how_it_works.length > 0 && (
        <section className="px-6 py-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-10">How it works</h2>
          <ol className="space-y-6">
            {sf.how_it_works.map((s: any, i: number) => (
              <li key={i} className="flex gap-4">
                <span className="h-8 w-8 shrink-0 rounded-full bg-brand-gradient text-primary-foreground grid place-items-center text-sm font-semibold">{i + 1}</span>
                <div>
                  <div className="font-semibold">{s.step}</div>
                  <p className="text-sm text-muted-foreground mt-1">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* FAQ */}
      {Array.isArray(sf.faq) && sf.faq.length > 0 && (
        <section className="px-6 py-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-10">Questions</h2>
          <div className="space-y-3">
            {sf.faq.map((f: any, i: number) => (
              <details key={i} className="rounded-xl border bg-card p-4">
                <summary className="cursor-pointer font-medium">{f.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-semibold tracking-tight">{sf.final_cta?.headline || "Ready when you are"}</h2>
        {sf.final_cta?.sub && <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">{sf.final_cta.sub}</p>}
        <div className="mt-6">
          <Button size="lg" className="bg-brand-gradient text-primary-foreground shadow-glow" onClick={checkout}>
            {sf.final_cta?.cta || sf.hero?.cta || "Get started"}
          </Button>
        </div>
      </section>

      <footer className="px-6 py-10 border-t text-center text-xs text-muted-foreground">
        Powered by Wazeer AI
      </footer>
    </div>
  );
}
