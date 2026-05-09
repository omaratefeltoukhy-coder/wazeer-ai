import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withBillingGuard } from "@/lib/server/billing";
import { callAITool } from "@/lib/ai/gateway";
import { loadBrandContext } from "@/lib/server/context";

export const POST_TYPES = ["feed", "reel", "story", "carousel", "announcement", "educational", "offer", "testimonial", "ugc", "founder_story"] as const;
export const PLATFORMS = ["facebook", "instagram"] as const;

export const GRAPH_API_VERSION = "v19.0";
export const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export const SAFETY = `Hard rules:
- No fake testimonials/quotes. No medical/financial/legal claims.
- Use the real brand voice; no hyperbole or guarantees.
- Hashtags: 3-8 relevant ones, no banned/spammy tags.`;

export const PostSchema = {
  type: "object",
  additionalProperties: false,
  required: ["caption", "hashtags", "cta", "platform", "recommended_publish_time_iso", "creative_recommendation"],
  properties: {
    caption: { type: "string" },
    hashtags: { type: "string" },
    cta: { type: "string" },
    platform: { type: "string", enum: ["facebook", "instagram"] },
    recommended_publish_time_iso: { type: "string" },
    creative_recommendation: { type: "string" },
  },
} as const;

export const generateMetaPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    business_id: z.string().uuid(),
    post_type: z.enum(POST_TYPES),
    platform: z.enum(PLATFORMS),
    media_asset_id: z.string().uuid().nullable().optional(),
    brief: z.string().max(500).optional().default(""),
  }).parse(i))
  .handler(async ({ data, context }) => {
    return withBillingGuard(context.supabase, data.business_id, { feature: "meta_posts", creditAction: "meta_post", metadata: { business_id: data.business_id, post_type: data.post_type } }, async () => {
      const { biz, brand, offer } = await loadBrandContext(context.supabase, data.business_id);
      const tool = { type: "function" as const, function: { name: "write_post", description: "Write one social post.", parameters: PostSchema as any } };
      const sys = `You are Wazeer. Write ONE ${data.platform} ${data.post_type} post. Reply via tool. ${SAFETY}`;
      const user = `Brand: ${brand?.brand_name ?? biz?.name} | Tone: ${brand?.tone ?? "warm"}
Positioning: ${brand?.positioning ?? ""}
Business: ${biz?.name} (${biz?.type}) — ${biz?.description ?? ""}
Audience: ${biz?.target_audience ?? ""}
Offer: ${offer?.name ?? "—"} — ${offer?.description ?? ""}
Brief: ${data.brief || "(none)"}`;
      const parsed = await callAITool([{ role: "system", content: sys }, { role: "user", content: user }], tool, "write_post");

      const { data: row, error } = await context.supabase.from("meta_posts").insert({
        business_id: data.business_id,
        platform: data.platform,
        caption: parsed.caption,
        hashtags: parsed.hashtags,
        cta_text: parsed.cta,
        post_type: data.post_type,
        media_asset_id: data.media_asset_id ?? null,
        scheduled_at: parsed.recommended_publish_time_iso ?? null,
        status: "draft",
        approval_status: "pending",
        insights_json: { creative_recommendation: parsed.creative_recommendation } as any,
      }).select("id").single();
      if (error || !row) throw new Error(error?.message || "Failed to save");

      return { ok: true, post_id: (row as any).id };
    });
  });
