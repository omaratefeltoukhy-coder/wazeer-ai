import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { confirmDialog } from "@/components/ui/confirm";
import { getPublicStorefront } from "@/lib/storefront/public.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Check, Mail, Phone, ArrowRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
    const title = sf?.title || sf?.content_json?.hero?.headline || "Wazeer Storefront";
    const desc = sf?.content_json?.hero?.sub || "Built with Wazeer.";
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
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  const checkout = async () => {
    if (!offer) {
      await confirmDialog({ title: "Checkout not configured", description: "This storefront has no offer attached yet.", confirmText: "OK", cancelText: "Close" });
      return;
    }
    const ok = await confirmDialog({
      title: "Complete your purchase?",
      description: `${offer.name} — ${fmtPrice(offer.price, offer.currency, offer.billing_interval)}. You will be redirected to secure checkout.`,
      confirmText: "Proceed to checkout",
    });
    if (!ok) return;
    toast.success("Demo: checkout would open here.");
  };

  const handleLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail) return;
    setLeadSubmitted(true);
    toast.success("You're on the list! We'll reach out soon.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 border-b flex items-center justify-between max-w-6xl mx-auto">
        <div className="font-semibold text-lg">{brand?.brand_name || storefront.title || "Storefront"}</div>
        <Button size="sm" variant="outline" onClick={checkout}>
          {sf.hero?.cta || "Get started"}
        </Button>
      </header>

      {/* Hero */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground mb-6">
          <Sparkles className="h-3 w-3" /> {brand?.tone || "Premium experience"}
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight">{sf.hero?.headline || storefront.title}</h1>
        {sf.hero?.sub && <p className="text-base sm:text-lg text-muted-foreground mt-5 max-w-2xl mx-auto">{sf.hero.sub}</p>}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" className="bg-brand-gradient text-primary-foreground shadow-glow w-full sm:w-auto" onClick={checkout}>
            {sf.hero?.cta || "Get started"}
          </Button>
          {offer && (
            <div className="text-sm text-muted-foreground">
              {fmtPrice(offer.price, offer.currency, offer.billing_interval)}
              {offer.free_trial_days ? <span className="ml-2 text-emerald-600 font-medium">· {offer.free_trial_days}-day free trial</span> : null}
            </div>
          )}
        </div>
        {sf.hero?.image_url && (
          <img src={sf.hero.image_url} alt="" className="mt-12 rounded-2xl border w-full max-w-3xl mx-auto" loading="lazy" />
        )}
      </section>

      {/* Product description */}
      {sf.product_description && (
        <section className="px-4 sm:px-6 py-12 max-w-3xl mx-auto text-center">
          <p className="text-lg text-muted-foreground leading-relaxed">{sf.product_description}</p>
        </section>
      )}

      {/* Benefits */}
      {Array.isArray(sf.benefits) && sf.benefits.length > 0 && (
        <section className="px-4 sm:px-6 py-16 max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-10">What you get</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sf.benefits.map((b: any, i: number) => (
              <div key={i} className="rounded-2xl border bg-card p-6 shadow-soft">
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

      {/* What's included */}
      {Array.isArray(sf.included) && sf.included.length > 0 && (
        <section className="px-4 sm:px-6 py-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-10">What's included</h2>
          <ul className="space-y-3">
            {sf.included.map((item: string, i: number) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <Check className="h-5 w-5 text-emerald-brand shrink-0 mt-0.5" />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* How it works */}
      {Array.isArray(sf.how_it_works) && sf.how_it_works.length > 0 && (
        <section className="px-4 sm:px-6 py-16 max-w-4xl mx-auto">
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

      {/* Testimonials - placeholder only */}
      {Array.isArray(sf.testimonials) && sf.testimonials.length > 0 ? (
        <section className="px-4 sm:px-6 py-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-10">What people say</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {sf.testimonials.map((t: any, i: number) => (
              <div key={i} className="rounded-2xl border bg-card p-6 shadow-soft">
                <p className="text-sm italic text-muted-foreground">"{t.quote}"</p>
                <p className="text-xs font-medium mt-3">— {t.author}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="px-4 sm:px-6 py-16 max-w-3xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">Testimonials will appear here once you add real customer feedback.</p>
        </section>
      )}

      {/* Pricing card */}
      {offer && (
        <section className="px-4 sm:px-6 py-16 max-w-md mx-auto">
          <div className="rounded-2xl border bg-card p-6 shadow-elevated text-center space-y-4">
            <h2 className="text-xl font-semibold">{offer.name}</h2>
            <div className="text-3xl font-bold">{fmtPrice(offer.price, offer.currency, offer.billing_interval)}</div>
            {offer.free_trial_days ? (
              <div className="text-sm text-emerald-600 font-medium">{offer.free_trial_days}-day free trial · Cancel anytime</div>
            ) : null}
            {offer.discount && <div className="text-sm text-muted-foreground">{offer.discount}</div>}
            <Button size="lg" className="w-full bg-brand-gradient text-primary-foreground shadow-glow" onClick={checkout}>
              {sf.hero?.cta || "Get started"}
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure checkout
            </div>
          </div>
        </section>
      )}

      {/* Lead capture / waitlist */}
      <section className="px-4 sm:px-6 py-16 max-w-md mx-auto">
        <div className="rounded-2xl border bg-secondary/40 p-6 text-center space-y-3">
          <h3 className="font-semibold">Not ready to buy?</h3>
          <p className="text-sm text-muted-foreground">Join the list and we'll send you updates and early access offers.</p>
          {leadSubmitted ? (
            <div className="text-sm text-emerald-600 font-medium">Thanks! We'll be in touch.</div>
          ) : (
            <form onSubmit={handleLead} className="flex gap-2">
              <Input type="email" required placeholder="you@example.com" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
              <Button type="submit"><ArrowRight className="h-4 w-4" /></Button>
            </form>
          )}
        </div>
      </section>

      {/* Book a call */}
      {sf.book_call && (
        <section className="px-4 sm:px-6 py-16 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-semibold">{sf.book_call.headline || "Want to talk first?"}</h2>
          <p className="text-muted-foreground mt-2">{sf.book_call.sub || "Book a free 15-minute call and we'll help you decide."}</p>
          <Button variant="outline" size="lg" className="mt-4" asChild>
            <a href={sf.book_call.url || "#"} target="_blank" rel="noreferrer">
              <Phone className="h-4 w-4 mr-1" /> Book a call
            </a>
          </Button>
        </section>
      )}

      {/* FAQ */}
      {Array.isArray(sf.faq) && sf.faq.length > 0 && (
        <section className="px-4 sm:px-6 py-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-10">Frequently asked questions</h2>
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
      <section className="px-4 sm:px-6 py-20 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-semibold tracking-tight">{sf.final_cta?.headline || "Ready when you are"}</h2>
        {sf.final_cta?.sub && <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">{sf.final_cta.sub}</p>}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" className="bg-brand-gradient text-primary-foreground shadow-glow w-full sm:w-auto" onClick={checkout}>
            {sf.final_cta?.cta || sf.hero?.cta || "Get started"}
          </Button>
          {offer && (
            <span className="text-sm text-muted-foreground">{fmtPrice(offer.price, offer.currency, offer.billing_interval)}</span>
          )}
        </div>
      </section>

      {/* Contact / Support */}
      <section className="px-4 sm:px-6 py-12 border-t max-w-3xl mx-auto text-center">
        <p className="text-sm text-muted-foreground">
          Questions? Reach us at <a href="mailto:support@wazeer.io" className="text-foreground hover:underline">support@wazeer.io</a>
        </p>
      </section>

      <footer className="px-4 sm:px-6 py-10 border-t">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {brand?.brand_name || sf.brand?.brand_name || "This business"}
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <Sparkles className="h-3 w-3 text-emerald-brand" />
            Made with Wazeer — Launch yours free
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
