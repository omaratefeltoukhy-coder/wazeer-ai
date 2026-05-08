import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeCredits, refundCredits, requireEntitlement } from "@/lib/billing/guard.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getImageProvider } from "./imageProvider.server";
import {
  composePrompt,
  type ImageType,
  type ImageStyle,
  type ImageFormat,
} from "./imagePrompt";

const TYPES: [ImageType, ...ImageType[]] = [
  "product", "lifestyle", "social_post", "ad_creative", "reel_cover", "email_banner", "storefront_hero",
];
const STYLES: [ImageStyle, ...ImageStyle[]] = [
  "premium_studio", "lifestyle", "minimal", "luxury", "local_market", "creator_led", "bold_ad", "clean_ecommerce",
];
const FORMATS: [ImageFormat, ...ImageFormat[]] = ["1_1", "9_16", "16_9", "ad", "email_banner"];

async function loadWorkspaceId(supabase: any, business_id: string): Promise<string> {
  const { data, error } = await supabase
    .from("businesses")
    .select("workspace_id")
    .eq("id", business_id)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Business not found");
  return data.workspace_id as string;
}

async function loadBrandContext(supabase: any, business_id: string) {
  const [{ data: biz }, { data: brand }, { data: offer }] = await Promise.all([
    supabase.from("businesses").select("name, target_audience, description").eq("id", business_id).maybeSingle(),
    supabase.from("brand_profiles").select("brand_name, tone, visual_style, positioning, audience_json").eq("business_id", business_id).maybeSingle(),
    supabase.from("offers").select("name, description").eq("business_id", business_id).maybeSingle(),
  ]);
  const audienceJson = (brand?.audience_json ?? {}) as Record<string, string>;
  const audience = [audienceJson.persona, audienceJson.demographics].filter(Boolean).join(" — ") || biz?.target_audience || null;
  return {
    brand_name: brand?.brand_name ?? biz?.name ?? null,
    tone: brand?.tone ?? null,
    visual_style: brand?.visual_style ?? null,
    positioning: brand?.positioning ?? null,
    audience,
    product_name: offer?.name ?? null,
    product_description: offer?.description ?? biz?.description ?? null,
  };
}

export const generateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
const GenSchema = z.object({
  business_id: z.string().uuid(),
  type: z.enum(TYPES),
  style: z.enum(STYLES),
  format: z.enum(FORMATS),
  brief: z.string().max(800).optional().default(""),
  reference_url: z.string().url().nullable().optional(),
});

export const generateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenSchema.parse(input))
  .handler(async ({ data, context }) => {
    const workspace_id = await loadWorkspaceId(context.supabase, data.business_id);
    await requireEntitlement(workspace_id, "ai_images");
    await consumeCredits(workspace_id, "ai_image", { business_id: data.business_id, type: data.type });

    const brand = await loadBrandContext(context.supabase, data.business_id);
    const prompt = composePrompt({
      type: data.type,
      style: data.style,
      format: data.format,
      brand,
      user_brief: data.brief,
      reference_url: data.reference_url ?? null,
    });

    // Insert as `generating` so the gallery can show pending state.
    const { data: row, error: insErr } = await context.supabase
      .from("media_assets")
      .insert({
        business_id: data.business_id,
        type: "image",
        source: "ai_generated",
        prompt,
        status: "generating",
        metadata_json: {
          type: data.type,
          style: data.style,
          format: data.format,
          reference_url: data.reference_url ?? null,
          brief: data.brief ?? "",
        } as never,
      })
      .select("id")
      .single();
    if (insErr || !row) {
      await refundCredits(workspace_id, "ai_image", { business_id: data.business_id });
      throw new Error(insErr?.message || "Failed to queue image");
    }

    try {
      const provider = getImageProvider();
      const result = await provider.generate({
        prompt,
        format: data.format,
        reference_url: data.reference_url ?? null,
        seed: row.id,
      });

      await context.supabase
        .from("media_assets")
        .update({
          file_url: result.file_url,
          status: result.status,
          metadata_json: {
            type: data.type,
            style: data.style,
            format: data.format,
            reference_url: data.reference_url ?? null,
            brief: data.brief ?? "",
            provider: result.provider,
          } as never,
        })
        .eq("id", row.id);

      return { id: row.id, file_url: result.file_url, status: result.status, prompt };
    } catch (err) {
      await refundCredits(workspace_id, "ai_image", { business_id: data.business_id });
      await supabaseAdmin
        .from("media_assets")
        .update({ status: "failed", metadata_json: { error: err instanceof Error ? err.message : String(err) } as never })
        .eq("id", row.id);
      throw err;
    }
  });

export const regenerateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      image_id: z.string().uuid(),
      prompt_override: z.string().max(2000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: img, error } = await context.supabase
      .from("media_assets")
      .select("id, business_id, prompt, metadata_json")
      .eq("id", data.image_id)
      .maybeSingle();
    if (error || !img) throw new Error("Image not found");
    const meta = (img.metadata_json ?? {}) as any;
    const format = (meta.format ?? "1_1") as ImageFormat;
    const workspace_id = await loadWorkspaceId(context.supabase, img.business_id as string);
    await requireEntitlement(workspace_id, "ai_images");
    await consumeCredits(workspace_id, "ai_image", { image_id: img.id, regenerate: true });

    const prompt = data.prompt_override || (img.prompt as string);
    await context.supabase.from("media_assets").update({ status: "generating", prompt }).eq("id", img.id);

    try {
      const provider = getImageProvider();
      const result = await provider.generate({ prompt, format, seed: `${img.id}-${Date.now()}` });
      await context.supabase
        .from("media_assets")
        .update({ file_url: result.file_url, status: result.status })
        .eq("id", img.id);
      return { id: img.id, file_url: result.file_url, status: result.status };
    } catch (err) {
      await refundCredits(workspace_id, "ai_image", { image_id: img.id });
      await context.supabase.from("media_assets").update({ status: "failed" }).eq("id", img.id);
      throw err;
    }
  });

export const listImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      business_id: z.string().uuid(),
      cursor: z.string().nullable().optional(),
      limit: z.number().int().min(1).max(60).optional().default(24),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("media_assets")
      .select("id, file_url, prompt, status, metadata_json, created_at")
      .eq("business_id", data.business_id)
      .eq("type", "image")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const next = rows && rows.length === data.limit ? (rows[rows.length - 1] as any).created_at : null;
    return { items: rows ?? [], next_cursor: next };
  });

export const deleteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ image_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("media_assets").delete().eq("id", data.image_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const useImageAsStorefrontHero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ image_id: z.string().uuid(), business_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: img } = await context.supabase
      .from("media_assets")
      .select("file_url, business_id")
      .eq("id", data.image_id)
      .maybeSingle();
    if (!img?.file_url) throw new Error("Image not ready");
    const { data: sf } = await context.supabase
      .from("storefronts")
      .select("id, content_json")
      .eq("business_id", data.business_id)
      .maybeSingle();
    if (!sf) throw new Error("Storefront not found");
    const content = { ...((sf.content_json ?? {}) as any) };
    content.hero = { ...(content.hero ?? {}), image_url: img.file_url };
    const { error } = await context.supabase
      .from("storefronts")
      .update({ content_json: content as any })
      .eq("id", sf.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
