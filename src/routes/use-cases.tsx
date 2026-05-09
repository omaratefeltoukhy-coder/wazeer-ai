import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/wazeer/Navbar";
import { Footer } from "@/components/wazeer/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag, GraduationCap, Calendar, Users, Gem, Briefcase, Sparkles } from "lucide-react";

export const Route = createFileRoute("/use-cases")({
  head: () => ({
    meta: [
      { title: "Use Cases â€” Wazeer" },
      { name: "description", content: "See how creators, coaches, product sellers, and agencies use Wazeer to launch faster." },
    ],
  }),
  component: UseCasesPage,
});

const cases = [
  {
    icon: ShoppingBag,
    title: "Product sellers",
    desc: "Turn a product photo into a complete storefront, ad creatives, and email launch sequence â€” in one afternoon.",
    results: ["Storefront + checkout", "AI product images", "Meta ad drafts", "Launch emails"],
  },
  {
    icon: GraduationCap,
    title: "Course creators",
    desc: "Build a sales page, write nurture emails, and generate UGC-style promo videos without a marketing team.",
    results: ["Course landing page", "Email funnel", "UGC video scripts", "Social content"],
  },
  {
    icon: Calendar,
    title: "Event hosts",
    desc: "Promote webinars, workshops, and live events with automated reminder sequences and targeted ad campaigns.",
    results: ["Event page", "Reminder automations", "Meta ads", "Registration tracking"],
  },
  {
    icon: Users,
    title: "Coaches & consultants",
    desc: "Book more calls with a polished offer page, testimonial-style videos, and follow-up email flows.",
    results: ["Booking page", "Testimonial scripts", "Lead nurture emails", "Retargeting ads"],
  },
  {
    icon: Gem,
    title: "Membership communities",
    desc: "Launch subscription tiers with recurring billing, onboarding emails, and retention analytics.",
    results: ["Subscription checkout", "Onboarding flow", "Churn alerts", "MRR dashboard"],
  },
  {
    icon: Briefcase,
    title: "Agencies",
    desc: "Manage multiple client businesses, white-label dashboards, and deliver AI-generated assets at scale.",
    results: ["Multi-business workspace", "Client dashboards", "White-label ready", "Priority support"],
  },
];

function UseCasesPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-24 pb-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/80 backdrop-blur px-3 py-1 text-xs text-muted-foreground shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-emerald-brand" />
            Built for every business type
          </div>
          <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight">
            How people use <span className="text-gradient">Wazeer</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            From first product to scaling agency â€” see how Wazeer helps you sell more with less effort.
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((c) => (
            <div key={c.title} className="rounded-2xl border bg-card p-6 shadow-soft hover:shadow-elevated transition-shadow">
              <div className="h-10 w-10 rounded-xl bg-secondary grid place-items-center mb-4">
                <c.icon className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.desc}</p>
              <ul className="mt-4 space-y-1.5">
                {c.results.map((r) => (
                  <li key={r} className="text-xs inline-flex items-center gap-1.5 mr-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-brand" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 border-t">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h2 className="text-xl font-semibold">Ready to see it for yourself?</h2>
          <Button asChild size="lg" className="bg-foreground text-background hover:opacity-90">
            <Link to="/signup" search={{ redirect: "/dashboard", idea: "" }}>
              Start your free trial <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
      <Footer />
    </main>
  );
}
