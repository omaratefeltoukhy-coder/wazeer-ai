import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/wazeer/Navbar";
import { Pricing } from "@/components/wazeer/Pricing";
import { Footer } from "@/components/wazeer/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Wazeer AI" },
      { name: "description", content: "Start free for 7 days. Simple, transparent pricing for creators, solopreneurs, and agencies." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-24 pb-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Simple pricing. <span className="text-gradient">Start free.</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            7-day free trial on every plan. No credit card required. Upgrade or cancel anytime.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-foreground text-background hover:opacity-90">
              <Link to="/signup">
                Start your free trial <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/faq" className="inline-flex items-center gap-2">
                <HelpCircle className="h-4 w-4" /> Have questions?
              </Link>
            </Button>
          </div>
        </div>
      </section>
      <Pricing />
      <section className="py-16 border-t">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h2 className="text-xl font-semibold">Need a custom plan?</h2>
          <p className="text-muted-foreground">
            Agencies and high-volume teams can request tailored credits, white-label options, and dedicated support.
          </p>
          <Button asChild variant="outline">
            <a href="mailto:sales@wazeer.ai?subject=Custom%20plan%20inquiry">Contact sales</a>
          </Button>
        </div>
      </section>
      <Footer />
    </main>
  );
}
