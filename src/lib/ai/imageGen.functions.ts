import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeCredits, refundCredits, requireEntitlement } from "@/lib/billing/guard.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadWorkspaceId, loadBrandContext } from "@/lib/server/context";
import { getImageProvider } from "./imageProvider.server";
import {
  composePrompt,
  type ImageType,
  type ImageStyle,
  type ImageFormat,
  type BrandContext as ImageBrandContext,
} from "./imagePrompt";

const TYPES: [ImageType, ...ImageType[]] = [
  "product", "lifestyle", "social_post", "ad_creative", "reel_cover", "email_banner", "storefront_hero",
];
const STYLES: [ImageStyle, ...ImageStyle[]] = [
  "premium_studio", "lifestyle", "minimal", "luxury", "local_market", "creator_led", "bold_ad", "clean_ecommerce",
];
const FORMATS: [ImageFormat, ...ImageFormat[]] = ["1_1", "9_16", "16_9", "ad", "email_banner"];

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

    const ctx = await loadBrandContext(context.supabase, data.business_id);
    const audienceJson = (ctx.brand?.audience_json ?? {}) as Record<string, string>;
    const audience = [audienceJson.persona, audienceJson.demographics].filter(Boolean).join(" — ") || ctx.biz?.target_audience || null;
    const brand: ImageBrandContext = {
      brand_name: ctx.brand?.brand_name ?? ctx.biz?.name ?? null,
      tone: ctx.brand?.tone ?? null,
      visual_style: ctx.brand?.visual_style ?? null,
      positioning: ctx.brand?.positioning ?? null,
      audience,
      product_name: ctx.offer?.name ?? null,
      product_description: ctx.offer?.description ?? ctx.biz?.description ?? null,
    };
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
    try {
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
    } catch (err: any) {
      console.error("[imageGen] Error:", err);
      throw err;
    }
  });

export const deleteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ image_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { error } = await context.supabase.from("media_assets").delete().eq("id", data.image_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err: any) {
      console.error("[imageGen] Error:", err);
      return { ok: false, error: err.message };
    }
  });

export const useImageAsStorefrontHero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ image_id: z.string().uuid(), business_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
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
    } catch (err: any) {
      console.error("[imageGen] Error:", err);
      return { ok: false, error: err.message };
    }
  });
