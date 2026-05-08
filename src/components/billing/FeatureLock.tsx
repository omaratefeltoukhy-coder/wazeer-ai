import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import type { Feature } from "@/lib/billing/plans";
import { useEntitlements } from "@/hooks/useEntitlements";

type Props = {
  feature: Feature;
  children: ReactNode;
  className?: string;
};

export function FeatureLock({ feature, children, className }: Props) {
  const { data, loading, has } = useEntitlements();
  if (loading) return <div className={className}>{children}</div>;
  if (has(feature)) return <div className={className}>{children}</div>;

  return (
    <div className={`relative rounded-2xl border bg-card overflow-hidden ${className ?? ""}`}>
      <div className="pointer-events-none opacity-30 blur-[1px] select-none">{children}</div>
      <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm p-6 text-center">
        <div className="max-w-sm space-y-3">
          <div className="mx-auto h-10 w-10 rounded-xl bg-brand-gradient grid place-items-center">
            <Lock className="h-4 w-4 text-primary-foreground" />
          </div>
          <h3 className="text-base font-semibold">{labelFor(feature)} is a paid feature</h3>
          <p className="text-sm text-muted-foreground">
            You're on the {data?.plan_meta.name ?? "Free Trial"} plan. Upgrade to unlock {labelFor(feature).toLowerCase()}.
          </p>
          <Link
            to="/dashboard/billing"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient text-primary-foreground px-4 py-2 text-sm font-medium shadow-glow"
          >
            <Sparkles className="h-4 w-4" /> Upgrade plan
          </Link>
        </div>
      </div>
    </div>
  );
}

function labelFor(f: Feature) {
  const map: Record<Feature, string> = {
    storefront: "Storefront",
    ai_images: "AI Images",
    ugc_scripts: "UGC Scripts",
    ugc_videos: "AI UGC Videos",
    email_campaigns: "Email Campaigns",
    email_automations: "Email Automations",
    meta_posts: "Meta Posts",
    meta_ads: "Meta Ads",
    analytics: "Analytics",
    recommendations: "AI Recommendations",
    agency_dashboard: "Agency Dashboard",
  };
  return map[f] ?? f;
}
