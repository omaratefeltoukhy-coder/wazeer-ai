import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/wazeer/Navbar";
import { Footer } from "@/components/wazeer/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Target, Shield, Zap } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Wazeer AI" },
      { name: "description", content: "Wazeer AI is an all-in-one AI business platform that helps creators and founders turn ideas into selling systems." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-24 pb-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Built for <span className="text-gradient">makers and sellers.</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Wazeer AI was created to solve a simple problem: launching and growing a business online takes too many tools, too much time, and too much money.
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-8">
          <div className="rounded-2xl border bg-card p-6 shadow-soft text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-secondary grid place-items-center mb-4">
              <Zap className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Speed</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Go from idea to live storefront, ads, and emails in hours — not weeks.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-soft text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-secondary grid place-items-center mb-4">
              <Target className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Simplicity</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              One workspace. One subscription. One place to create, sell, and analyze.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-soft text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-secondary grid place-items-center mb-4">
              <Shield className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Control</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              AI drafts everything. You review, edit, and approve before anything goes live.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 border-t">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h2 className="text-xl font-semibold">Start building your selling system today.</h2>
          <Button asChild size="lg" className="bg-foreground text-background hover:opacity-90">
            <Link to="/signup">
              Start selling with AI <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
      <Footer />
    </main>
  );
}
