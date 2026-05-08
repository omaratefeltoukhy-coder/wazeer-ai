import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { consumeCredits, refundCredits, requireEntitlement } from "@/lib/billing/guard.server";

export const POST_TYPES = ["feed", "reel", "story", "carousel", "announcement", "educational", "offer", "testimonial", "ugc", "founder_story"] as const;
export const PLATFORMS = ["facebook", "instagram"] as const;

const SAFETY = `Hard rules:
- No fake testimonials/quotes. No medical/financial/legal claims.
- Use the real brand voice; no hyperbole or guarantees.
- Hashtags: 3-8 relevant ones, no banned/spammy tags.`;

const PostSchema = {
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

async function loadWs(supabase: any, business_id: string): Promise<string> {
  const { data } = await supabase.from("businesses").select("workspace_id").eq("id", business_id).maybeSingle();
  if (!data) throw new Error("Business not found");
  return (data as any).workspace_id;
}

async function loadCtx(supabase: any, business_id: string) {
  const [{ data: biz }, { data: brand }, { data: offer }] = await Promise.all([
    supabase.from("businesses").select("name, type, description, target_audience, desired_result, pain_point, currency").eq("id", business_id).maybeSingle(),
    supabase.from("brand_profiles").select("brand_name, tone, positioning, audience_json, benefits_json").eq("business_id", business_id).maybeSingle(),
    supabase.from("offers").select("name, description, price, currency").eq("business_id", business_id).maybeSingle(),
  ]);
  return { biz, brand, offer };
}

async function callAI(messages: any[], tool: any, toolName: string) {
  const KEY = process.env.LOVABLE_API_KEY;
  if (!KEY) throw new Error("AI gateway not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, tools: [tool], tool_choice: { type: "function", function: { name: toolName } } }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limit hit. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    throw new Error(`AI failed (${res.status})`);
  }
  const json = await res.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured output");
  return typeof args === "string" ? JSON.parse(args) : args;
}

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
    const ws_id = await loadWs(context.supabase, data.business_id);
    await requireEntitlement(ws_id, "meta_posts");
    await consumeCredits(ws_id, "meta_post", { business_id: data.business_id, post_type: data.post_type });
    try {
      const { biz, brand, offer } = await loadCtx(context.supabase, data.business_id);
      const tool = { type: "function" as const, function: { name: "write_post", description: "Write one social post.", parameters: PostSchema as any } };
      const sys = `You are Wazeer AI. Write ONE ${data.platform} ${data.post_type} post. Reply via tool. ${SAFETY}`;
      const user = `Brand: ${brand?.brand_name ?? biz?.name} | Tone: ${brand?.tone ?? "warm"}
Positioning: ${brand?.positioning ?? ""}
Business: ${biz?.name} (${biz?.type}) — ${biz?.description ?? ""}
Audience: ${biz?.target_audience ?? ""}
Offer: ${offer?.name ?? "—"} — ${offer?.description ?? ""}
Brief: ${data.brief || "(none)"}`;
      const parsed = await callAI([{ role: "system", content: sys }, { role: "user", content: user }], tool, "write_post");

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
    } catch (err) {
      await refundCredits(ws_id, "meta_post", { business_id: data.business_id });
      throw err;
    }
  });

export const listMetaPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ business_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("meta_posts")
      .select("id, platform, caption, hashtags, cta_text, post_type, media_asset_id, status, approval_status, scheduled_at, published_at, external_post_id, insights_json, error_message, created_at, updated_at")
      .eq("business_id", data.business_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { posts: rows ?? [] };
  });

export const updateMetaPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    post_id: z.string().uuid(),
    patch: z.object({
      caption: z.string().max(8000).optional(),
      hashtags: z.string().max(2000).optional(),
      cta_text: z.string().max(200).optional(),
      media_asset_id: z.string().uuid().nullable().optional(),
      scheduled_at: z.string().datetime().nullable().optional(),
      platform: z.enum(PLATFORMS).optional(),
    }),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("meta_posts").update(data.patch as any).eq("id", data.post_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const approveMetaPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: post } = await context.supabase.from("meta_posts").select("id, business_id").eq("id", data.post_id).maybeSingle();
    if (!post) throw new Error("Post not found");
    const ws_id = await loadWs(context.supabase, (post as any).business_id);
    const { error } = await context.supabase.from("meta_posts").update({
      approval_status: "approved", approved_at: new Date().toISOString(), approved_by: context.userId,
    } as any).eq("id", data.post_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: ws_id, business_id: (post as any).business_id, user_id: context.userId,
      action: "approve_meta_post", entity: "meta_post", entity_id: data.post_id, metadata_json: {} as never,
    });
    return { ok: true };
  });

export const scheduleMetaPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ post_id: z.string().uuid(), scheduled_at: z.string().datetime() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: post } = await context.supabase.from("meta_posts").select("id, business_id, approval_status").eq("id", data.post_id).maybeSingle();
    if (!post) throw new Error("Post not found");
    if ((post as any).approval_status !== "approved") throw new Error("Approve the post before scheduling.");
    const { error } = await context.supabase.from("meta_posts").update({
      scheduled_at: data.scheduled_at, status: "scheduled",
    } as any).eq("id", data.post_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishMetaPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: post } = await context.supabase.from("meta_posts")
      .select("id, business_id, approval_status, platform").eq("id", data.post_id).maybeSingle();
    if (!post) throw new Error("Post not found");
    if ((post as any).approval_status !== "approved") {
      throw new Error("Approval required. Approve the post before publishing.");
    }
    const ws_id = await loadWs(context.supabase, (post as any).business_id);

    const isDemo = (process.env.META_MODE ?? "demo") === "demo";
    const ext_id = isDemo ? `demo_post_${Math.random().toString(36).slice(2, 10)}` : null;

    const { error } = await context.supabase.from("meta_posts").update({
      status: "published",
      external_post_id: ext_id,
      published_at: new Date().toISOString(),
    } as any).eq("id", data.post_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: ws_id, business_id: (post as any).business_id, user_id: context.userId,
      action: "publish_meta_post", entity: "meta_post", entity_id: data.post_id,
      metadata_json: { platform: (post as any).platform, mode: isDemo ? "demo" : "live" } as never,
    });
    return { ok: true, mode: isDemo ? "demo" : "live", external_post_id: ext_id };
  });

export const deleteMetaPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("meta_posts").delete().eq("id", data.post_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
