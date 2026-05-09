import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/wazeer/Navbar";
import { FAQ } from "@/components/wazeer/FAQ";
import { Footer } from "@/components/wazeer/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Wazeer AI" },
      { name: "description", content: "Answers to common questions about Wazeer AI, pricing, trials, and how it works." },
    ],
  }),
  component: FAQPage,
});

function FAQPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-24 pb-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Frequently asked <span className="text-gradient">questions</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know before starting your free trial.
          </p>
        </div>
      </section>
      <FAQ />
      <section className="py-16 border-t">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h2 className="text-xl font-semibold">Still have questions?</h2>
          <p className="text-muted-foreground">
            Reach out and we'll get back to you within 24 hours.
          </p>
          <Button asChild variant="outline">
            <Link to="/contact">Contact us</Link>
          </Button>
        </div>
      </section>
      <Footer />
    </main>
  );
}
