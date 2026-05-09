import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BrandContext = {
  biz: {
    name: string | null;
    type: string | null;
    description: string | null;
    target_audience: string | null;
    desired_result: string | null;
    pain_point: string | null;
    currency: string | null;
    country: string | null;
    language: string | null;
    status: string | null;
  } | null;
  brand: {
    brand_name: string | null;
    tone: string | null;
    visual_style: string | null;
    positioning: string | null;
    audience_json: unknown | null;
    benefits_json: unknown | null;
    pain_points_json: unknown | null;
    objections_json: unknown | null;
  } | null;
  offer: {
    id: string | null;
    name: string | null;
    description: string | null;
    price: number | null;
    currency: string | null;
    billing_interval: string | null;
    free_trial_days: number | null;
  } | null;
  storefront: { slug: string | null; status: string | null } | null;
};

export async function loadWorkspaceId(
  supabase: SupabaseClient<Database>,
  business_id: string
): Promise<string> {
  const { data, error } = await supabase
    .from("businesses")
    .select("workspace_id")
    .eq("id", business_id)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Business not found");
  return data.workspace_id;
}

export async function loadBrandContext(
  supabase: SupabaseClient<Database>,
  business_id: string
): Promise<BrandContext> {
  const [{ data: biz }, { data: brand }, { data: offer }, { data: storefront }] = await Promise.all([
    supabase
      .from("businesses")
      .select("name, type, description, target_audience, desired_result, pain_point, currency, country, language, status")
      .eq("id", business_id)
      .maybeSingle(),
    supabase
      .from("brand_profiles")
      .select("brand_name, tone, visual_style, positioning, audience_json, benefits_json, pain_points_json, objections_json")
      .eq("business_id", business_id)
      .maybeSingle(),
    supabase
      .from("offers")
      .select("id, name, description, price, currency, billing_interval, free_trial_days")
      .eq("business_id", business_id)
      .maybeSingle(),
    supabase
      .from("storefronts")
      .select("slug, status")
      .eq("business_id", business_id)
      .maybeSingle(),
  ]);

  return {
    biz: biz ?? null,
    brand: brand ?? null,
    offer: offer ?? null,
    storefront: storefront ?? null,
  };
}
