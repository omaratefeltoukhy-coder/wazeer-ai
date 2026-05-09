import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeCredits, refundCredits, requireEntitlement, checkUsageCap, incrementUsage } from "@/lib/billing/guard.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAITool } from "@/lib/ai/gateway";
import { loadWorkspaceId, loadBrandContext } from "@/lib/server/context";

export const PLATFORMS = [
  "tiktok", "instagram_reels", "facebook_reels", "meta_ad",
  "testimonial", "founder_story", "problem_solution", "product_demo",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram_reels: "Instagram Reels",
  facebook_reels: "Facebook Reels",
  meta_ad: "Meta Ad",
  testimonial: "Testimonial",
  founder_story: "Founder Story",
  problem_solution: "Problem → Solution",
  product_demo: "Product Demo",
};

export const LENGTHS = [15, 30, 45, 60] as const;
export type Length = (typeof LENGTHS)[number];

const ScriptSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "target_customer", "hook_3s", "scenes", "spoken_script", "on_screen_text", "creator_direction", "cta", "performance_score", "score_reasoning", "why_it_could_work"],
  properties: {
    title: { type: "string" },
    target_customer: { type: "string" },
    hook_3s: { type: "string" },
    scenes: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["scene_no", "visual", "on_screen_text", "b_roll", "duration_s", "voiceover"],
        properties: {
          scene_no: { type: "integer" },
          visual: { type: "string" },
          on_screen_text: { type: "string" },
          b_roll: { type: "string" },
          duration_s: { type: "number" },
          voiceover: { type: "string" },
        },
      },
    },
    spoken_script: { type: "string" },
    on_screen_text: { type: "string" },
    creator_direction: { type: "string" },
    cta: { type: "string" },
    performance_score: { type: "integer", minimum: 0, maximum: 100 },
    score_reasoning: { type: "string" },
    why_it_could_work: { type: "string" },
  },
} as const;

const SAFETY_RAILS = `Hard rules:
- Do not invent customer testimonials, names, or quotes.
- Do not use medical, financial, or legal claims (no "cures", "guaranteed returns", "FDA approved", etc.).
- No fake before/after results or unverifiable statistics.
- Use empty-state friendly language; suggest the creator records authentic footage.
- Keep the brand's voice and product identity exactly as provided.`;

export const generateUgcScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    business_id: z.string().uuid(),
    platform: z.enum(PLATFORMS),
    length_s: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
    brief: z.string().max(800).optional().default(""),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const workspace_id = await loadWorkspaceId(context.supabase, data.business_id);
    await requireEntitlement(workspace_id, "ugc_scripts");
    await checkUsageCap(workspace_id, "ugc_scripts");
    await consumeCredits(workspace_id, "ugc_script", { business_id: data.business_id, platform: data.platform });

    try {
      const { biz, brand, offer } = await loadBrandContext(context.supabase, data.business_id);
      const benefits = (brand?.benefits_json ?? []) as any[];
      const pains = (brand?.pain_points_json ?? []) as any[];

      const tool = {
        type: "function" as const,
        function: {
          name: "write_ugc_script",
          description: "Write a structured UGC video script.",
          parameters: ScriptSchema as any,
        },
      };

      const sysPrompt = `You are Wazeer, a senior UGC creative director.
Write a ${data.length_s}-second UGC script for ${PLATFORM_LABEL[data.platform]}.
Reply ONLY through the provided tool.
${SAFETY_RAILS}`;

      const userPrompt = `Brand: ${brand?.brand_name ?? biz?.name}
Tone: ${brand?.tone ?? "confident, friendly"}
Positioning: ${brand?.positioning ?? ""}
Business: ${biz?.name} (${biz?.type}) — ${biz?.description ?? ""}
Audience: ${biz?.target_audience ?? ""}
Pain point: ${biz?.pain_point ?? ""}
Desired result: ${biz?.desired_result ?? ""}
Offer: ${offer?.name ?? "—"} — ${offer?.description ?? ""}
Top benefits: ${benefits.map((b: any) => b.title || b).slice(0, 6).join(", ") || "—"}
Top pain points: ${pains.slice(0, 4).join(", ") || "—"}
Platform: ${PLATFORM_LABEL[data.platform]}
Total length: ${data.length_s}s. Allocate scene durations so they sum to about ${data.length_s}s.
Extra direction: ${data.brief || "(none)"}`;

      const parsed = await callAITool(
        [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
        tool,
        "write_ugc_script",
      );

      const { data: row, error: insErr } = await context.supabase.from("ugc_scripts").insert({
        business_id: data.business_id,
        title: parsed.title,
        platform: data.platform,
        performance_score: parsed.performance_score,
        status: "draft",
        script_json: { ...parsed, length_s: data.length_s } as any,
      }).select("id").single();
      if (insErr || !row) throw new Error(insErr?.message || "Failed to save script");

      await incrementUsage(workspace_id, "ugc_scripts", 1);
      return { id: row.id, script: parsed };
    } catch (err) {
      await refundCredits(workspace_id, "ugc_script", { business_id: data.business_id });
      throw err;
    }
  });

export const regenerateUgcScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    script_id: z.string().uuid(),
    scene_no: z.number().int().min(1),
    brief: z.string().max(500).optional().default(""),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: script, error } = await context.supabase.from("ugc_scripts")
      .select("id, business_id, platform, script_json").eq("id", data.script_id).maybeSingle();
    if (error || !script) throw new Error("Script not found");
    const workspace_id = await loadWorkspaceId(context.supabase, script.business_id as string);
    await requireEntitlement(workspace_id, "ugc_scripts");
    await consumeCredits(workspace_id, "ugc_script_scene", { script_id: data.script_id });

    try {
      const sj = (script.script_json ?? {}) as any;
      const scene = (sj.scenes ?? []).find((s: any) => s.scene_no === data.scene_no);
      if (!scene) throw new Error("Scene not found");
      const { biz, brand } = await loadBrandContext(context.supabase, script.business_id as string);

      const SceneSchema = ScriptSchema.properties.scenes.items;
      const tool = {
        type: "function" as const,
        function: {
          name: "rewrite_scene",
          description: "Rewrite a single UGC scene.",
          parameters: { type: "object", properties: { scene: SceneSchema }, required: ["scene"], additionalProperties: false },
        },
      };
      const parsed = await callAITool(
        [
          { role: "system", content: `You are Wazeer. Rewrite ONE UGC scene only. Keep the same scene_no and similar duration. Reply via tool. ${SAFETY_RAILS}` },
          {
            role: "user",
            content: `Brand: ${brand?.brand_name ?? biz?.name} | Tone: ${brand?.tone ?? "confident"}
Platform: ${PLATFORM_LABEL[script.platform as Platform]}
Existing scene: ${JSON.stringify(scene)}
Script title: ${sj.title}
Hook: ${sj.hook_3s}
CTA: ${sj.cta}
Brief: ${data.brief || "(none)"}`,
          },
        ],
        tool,
        "rewrite_scene",
      );
      const newScene = { ...parsed.scene, scene_no: data.scene_no };
      const next = { ...sj, scenes: (sj.scenes ?? []).map((s: any) => s.scene_no === data.scene_no ? newScene : s) };
      const { error: upErr } = await context.supabase.from("ugc_scripts").update({ script_json: next as any }).eq("id", script.id);
      if (upErr) throw new Error(upErr.message);
      return { ok: true, scene: newScene };
    } catch (err) {
      await refundCredits(workspace_id, "ugc_script_scene", { script_id: data.script_id });
      throw err;
    }
  });

export const updateUgcScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    script_id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    script_json: z.record(z.string(), z.any()).optional(),
    status: z.string().max(40).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const patch: any = {};
      if (data.title !== undefined) patch.title = data.title;
      if (data.script_json !== undefined) patch.script_json = data.script_json;
      if (data.status !== undefined) patch.status = data.status;
      const { error } = await context.supabase.from("ugc_scripts").update(patch).eq("id", data.script_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err: any) {
      console.error("[ugcScript] Error:", err);
      return { ok: false, error: err.message };
    }
  });

export const duplicateUgcScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ script_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { data: src, error } = await context.supabase.from("ugc_scripts")
        .select("business_id, title, platform, performance_score, script_json").eq("id", data.script_id).maybeSingle();
      if (error || !src) throw new Error("Script not found");
      const { data: row, error: insErr } = await context.supabase.from("ugc_scripts").insert({
        business_id: src.business_id,
        title: `${src.title ?? "Untitled"} (copy)`,
        platform: src.platform,
        performance_score: src.performance_score,
        status: "draft",
        script_json: src.script_json as any,
      }).select("id").single();
      if (insErr) throw new Error(insErr.message);
      return { id: row!.id };
    } catch (err: any) {
      console.error("[ugcScript] Error:", err);
      throw err;
    }
  });

export const deleteUgcScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ script_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { error } = await context.supabase.from("ugc_scripts").delete().eq("id", data.script_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err: any) {
      console.error("[ugcScript] Error:", err);
      return { ok: false, error: err.message };
    }
  });

export const listUgcScripts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    business_id: z.string().uuid().nullable().optional(),
    platform: z.enum(PLATFORMS).nullable().optional(),
    search: z.string().max(120).optional(),
    sort: z.enum(["recent", "score"]).optional().default("recent"),
    limit: z.number().int().min(1).max(100).optional().default(50),
  }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      let q = context.supabase.from("ugc_scripts")
        .select("id, business_id, title, platform, performance_score, status, script_json, created_at, updated_at")
        .limit(data.limit);
      if (data.business_id) q = q.eq("business_id", data.business_id);
      if (data.platform) q = q.eq("platform", data.platform);
      if (data.search) q = q.ilike("title", `%${data.search}%`);
      q = data.sort === "score"
        ? q.order("performance_score", { ascending: false, nullsFirst: false })
        : q.order("created_at", { ascending: false });
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      return { items: rows ?? [] };
    } catch (err: any) {
      console.error("[ugcScript] Error:", err);
      throw err;
    }
  });

export const getUgcScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ script_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { data: row, error } = await context.supabase.from("ugc_scripts")
        .select("id, business_id, title, platform, performance_score, status, script_json, created_at, updated_at").eq("id", data.script_id).maybeSingle();
      if (error || !row) throw new Error("Script not found");
      const { data: biz } = await context.supabase.from("businesses").select("name, workspace_id").eq("id", row.business_id).maybeSingle();
      return { script: row, business: biz };
    } catch (err: any) {
      console.error("[ugcScript] Error:", err);
      throw err;
    }
  });
