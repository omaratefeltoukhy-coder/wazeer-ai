import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getPublicStorefront = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { data: sf } = await supabaseAdmin
      .from("storefronts")
      .select("id, slug, title, status, content_json, business_id")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!sf) return { storefront: null, offer: null, brand: null } as const;

    const [{ data: offer }, { data: brand }, { data: biz }] = await Promise.all([
      supabaseAdmin
        .from("offers")
        .select("id, name, description, price, currency, billing_interval, free_trial_days")
        .eq("business_id", sf.business_id)
        .eq("status", "active")
        .maybeSingle(),
      supabaseAdmin
        .from("brand_profiles")
        .select("brand_name, colors_json, tone")
        .eq("business_id", sf.business_id)
        .maybeSingle(),
      supabaseAdmin
        .from("businesses")
        .select("name, currency")
        .eq("id", sf.business_id)
        .maybeSingle(),
    ]);

    return { storefront: sf, offer, brand, business: biz };
  });
