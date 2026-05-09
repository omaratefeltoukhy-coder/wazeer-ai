import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/wazeer/Navbar";
import { Features } from "@/components/wazeer/Features";
import { Footer } from "@/components/wazeer/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Wazeer AI" },
      { name: "description", content: "Discover everything Wazeer AI can build for your business: storefronts, AI images, UGC videos, email campaigns, Meta ads, and live dashboards." },
    ],
  }),
  component: FeaturesPage,
});

function FeaturesPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-24 pb-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/80 backdrop-blur px-3 py-1 text-xs text-muted-foreground shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-emerald-brand" />
            All-in-one AI business platform
          </div>
          <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight">
            Everything you need to <span className="text-gradient">launch and grow.</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Wazeer AI replaces a stack of tools with one simple workspace. Build your offer, create content, run ads, and track results — without hiring a team.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-foreground text-background hover:opacity-90">
              <Link to="/signup">
                Start selling with AI <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>
      <Features />
      <Footer />
    </main>
  );
}
