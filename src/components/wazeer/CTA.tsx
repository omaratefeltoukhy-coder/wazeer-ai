import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function CTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border bg-card p-10 sm:p-16 text-center shadow-elevated">
          <div className="absolute inset-0 -z-10 bg-hero-glow opacity-70" />
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Your selling system, <span className="text-gradient">built faster.</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Launch your offer, storefront, content, and ads with AI — then grow with clear recommendations.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-brand-gradient text-primary-foreground shadow-glow">
              <Link to="/signup" search={{ redirect: "/dashboard", idea: "" }}>
                Start selling with AI <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/dashboard/new" search={{ idea: "" }}>Generate my business</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
