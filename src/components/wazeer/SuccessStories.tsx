import { Quote, Star } from "lucide-react";

const stories = [
  {
    name: "Jyan Yoga",
    location: "Singapore",
    business: "Online yoga classes & wellness coaching",
    result: "First sale in 1 week",
    detail: "I had zero tech skills. Wazeer built my storefront, drafted my email sequence, and created my Meta ads. I just described what I teach and uploaded a photo of my studio.",
    metric: "$12,000",
    metricLabel: "in first 6 months",
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=200&h=200&fit=crop&crop=face",
  },
  {
    name: "Humberto Moro",
    location: "Mexico",
    business: "Sustainable farming academy",
    result: "3,000 community members",
    detail: "I turned 20 years of farming knowledge into an online course. Wazeer generated the curriculum outline, wrote the sales page, and even created UGC video scripts I filmed on my phone.",
    metric: "$20,000",
    metricLabel: "in 4 months",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
  },
  {
    name: "Melissa Krumbein",
    location: "Texas, USA",
    business: "Handmade Jewish crafts & jewelry",
    result: "Global customer base",
    detail: "I was selling at local markets only. Wazeer gave me a professional storefront, automated email campaigns for holidays, and ad copy that actually converts. Now I ship worldwide.",
    metric: "$8,500",
    metricLabel: "in first 3 months",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",
  },
];

export function SuccessStories() {
  return (
    <section className="py-20 border-t">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Real people. <span className="text-gradient">Real results.</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Join creators, coaches, and makers who turned their skills into income — without hiring a team.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {stories.map((s) => (
            <div key={s.name} className="rounded-2xl border bg-card p-6 shadow-soft flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <img src={s.image} alt={s.name} className="h-12 w-12 rounded-full object-cover" loading="lazy" />
                <div>
                  <div className="font-medium text-sm">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.location}</div>
                </div>
              </div>

              <div className="flex items-center gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{s.detail}"</p>

              <div className="mt-5 pt-4 border-t">
                <div className="text-2xl font-bold text-gradient">{s.metric}</div>
                <div className="text-xs text-muted-foreground">{s.metricLabel}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground">
            Trusted by creators in <span className="font-medium text-foreground">150+ countries</span>
          </p>
        </div>
      </div>
    </section>
  );
}
