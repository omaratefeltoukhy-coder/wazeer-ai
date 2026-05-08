export type PlanId = "trial" | "starter" | "growth" | "pro" | "agency";

export type Feature =
  | "storefront"
  | "ai_images"
  | "ugc_scripts"
  | "ugc_videos"
  | "email_campaigns"
  | "email_automations"
  | "meta_posts"
  | "meta_ads"
  | "analytics"
  | "recommendations"
  | "agency_dashboard";

export type Plan = {
  id: PlanId;
  name: string;
  price_usd: number;
  credits_per_month: number;
  badge?: string;
  features: Feature[];
  caps: Partial<Record<Feature, number>>; // per month soft caps
};

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "Free Trial",
    price_usd: 0,
    credits_per_month: 100,
    badge: "14 days",
    features: ["storefront", "ai_images", "ugc_scripts", "email_campaigns", "analytics", "recommendations"],
    caps: { ai_images: 20, ugc_scripts: 5, email_campaigns: 2 },
  },
  starter: {
    id: "starter",
    name: "Starter",
    price_usd: 19,
    credits_per_month: 800,
    features: ["storefront", "ai_images", "ugc_scripts", "email_campaigns", "email_automations", "meta_posts", "analytics", "recommendations"],
    caps: { email_campaigns: 8 },
  },
  growth: {
    id: "growth",
    name: "Growth",
    price_usd: 49,
    credits_per_month: 3000,
    badge: "Most popular",
    features: ["storefront", "ai_images", "ugc_scripts", "ugc_videos", "email_campaigns", "email_automations", "meta_posts", "meta_ads", "analytics", "recommendations"],
    caps: {},
  },
  pro: {
    id: "pro",
    name: "Pro",
    price_usd: 99,
    credits_per_month: 8000,
    features: ["storefront", "ai_images", "ugc_scripts", "ugc_videos", "email_campaigns", "email_automations", "meta_posts", "meta_ads", "analytics", "recommendations"],
    caps: {},
  },
  agency: {
    id: "agency",
    name: "Agency",
    price_usd: 249,
    credits_per_month: 25000,
    features: ["storefront", "ai_images", "ugc_scripts", "ugc_videos", "email_campaigns", "email_automations", "meta_posts", "meta_ads", "analytics", "recommendations", "agency_dashboard"],
    caps: {},
  },
};

// Per-action credit cost (single source of truth)
export const CREDIT_COST: Record<string, number> = {
  business_generation: 15,
  storefront_section_regenerate: 2,
  storefront_publish: 0,
  ai_image: 1,
  ugc_script: 3,
  ugc_video: 25,
  email_campaign: 4,
  email_send: 0,
  meta_post_draft: 2,
  meta_ad_draft: 4,
  analytics_refresh: 1,
};

export function planHas(plan: PlanId, feature: Feature): boolean {
  return PLANS[plan].features.includes(feature);
}

export function planCap(plan: PlanId, feature: Feature): number | null {
  const c = PLANS[plan].caps[feature];
  return typeof c === "number" ? c : null;
}
