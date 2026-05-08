import { Store, Image as ImageIcon, Video, Mail, Megaphone, LineChart, Brain, CreditCard } from "lucide-react";

const features = [
  { icon: Store, title: "AI storefront builder", desc: "Beautiful, mobile-ready sales pages with checkout, subscriptions, and lead capture." },
  { icon: ImageIcon, title: "AI product images", desc: "Studio shots, lifestyle scenes, ad creatives, and email banners in any format." },
  { icon: Video, title: "AI UGC videos", desc: "Hook → script → storyboard → ready-to-post video. Built from your product." },
  { icon: Mail, title: "Email campaigns & flows", desc: "Welcome, abandoned cart, launch, win-back — written, segmented, scheduled." },
  { icon: Megaphone, title: "Meta posts & ads", desc: "Generate posts, target the right audience, and launch ads with safeguards." },
  { icon: LineChart, title: "Live performance dashboards", desc: "Sales, ROAS, email revenue, top creatives — all in one clean view." },
  { icon: Brain, title: "AI growth recommendations", desc: "Daily, prioritized actions that move the needle — with one-click execution." },
  { icon: CreditCard, title: "Built-in monetization", desc: "One-time, subscriptions, free trials, discounts — with secure checkout." },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-secondary/40 border-y">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-royal">Everything you need</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold">An entire growth team in one app</h2>
          <p className="mt-3 text-muted-foreground">Replace 8+ tools with one AI partner that ships work — not just suggestions.</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="group rounded-2xl border bg-card p-5 shadow-soft hover:-translate-y-0.5 hover:shadow-elevated transition-all">
              <div className="h-10 w-10 rounded-xl bg-secondary grid place-items-center text-foreground group-hover:bg-brand-gradient group-hover:text-primary-foreground transition-colors">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
