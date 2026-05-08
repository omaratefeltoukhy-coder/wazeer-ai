import { Lightbulb, Wand2, Rocket, TrendingUp } from "lucide-react";

const steps = [
  { icon: Lightbulb, title: "Share your idea", desc: "Upload a photo, paste a link, or write one sentence about what you sell." },
  { icon: Wand2, title: "AI builds your business", desc: "Offer, storefront, images, UGC videos, emails, posts, and ads — drafted for you." },
  { icon: Rocket, title: "Approve & launch", desc: "Review everything, connect Meta and email, then launch with one click." },
  { icon: TrendingUp, title: "Grow on autopilot", desc: "Live dashboards and AI recommendations tell you exactly what to do next." },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-emerald-brand">How it works</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold">From idea to income in minutes</h2>
          <p className="mt-3 text-muted-foreground">No marketing skills required. Wazeer AI handles copy, design, ads, and analytics for you.</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border bg-card p-6 shadow-soft hover:shadow-elevated transition-shadow">
              <div className="absolute -top-3 left-6 text-xs font-mono text-muted-foreground bg-background px-2">0{i + 1}</div>
              <div className="h-10 w-10 rounded-xl bg-brand-gradient grid place-items-center text-primary-foreground shadow-glow">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
