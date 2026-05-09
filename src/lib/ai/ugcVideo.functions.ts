import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeCredits, refundCredits, requireEntitlement } from "@/lib/billing/guard.server";
import { getVideoProvider, type VideoFormat } from "./videoProvider.server";
import { callAI } from "@/lib/ai/gateway";

const FORMATS: [VideoFormat, ...VideoFormat[]] = ["9_16", "1_1", "16_9"];

async function loadWorkspaceId(supabase: any, business_id: string): Promise<string> {
  const { data, error } = await supabase
    .from("businesses").select("workspace_id").eq("id", business_id).maybeSingle();
  if (error || !data) throw new Error(error?.message || "Business not found");
  return data.workspace_id as string;
}

async function callVideoAI(messages: any[], tool: any, toolName: string) {
  const aiRes = await callAI({
    messages,
    tools: [tool as any],
    toolChoice: { type: "function", function: { name: toolName } },
  });
  const args = aiRes.toolCalls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured output");
  return typeof args === "string" ? JSON.parse(args) : args;
}

const StoryboardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["scene_prompts", "voiceover", "on_screen_text", "captions", "hashtags"],
  properties: {
    scene_prompts: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["scene_no", "prompt", "duration_s", "voiceover", "on_screen_text"],
        properties: {
          scene_no: { type: "integer" },
          prompt: { type: "string" },
          duration_s: { type: "number" },
          voiceover: { type: "string" },
          on_screen_text: { type: "string" },
        },
      },
    },
    voiceover: { type: "string" },
    on_screen_text: { type: "string" },
    captions: { type: "string" },
    hashtags: { type: "array", items: { type: "string" }, maxItems: 12 },
  },
} as const;

const SAFETY = `Hard rules: No fabricated testimonials. No medical/financial/legal claims. Preserve product identity. Visual prompts must be concrete, brand-consistent.`;

export const generateStoryboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    script_id: z.string().uuid(),
    aspect_ratio: z.enum(FORMATS).optional().default("9_16"),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: script, error } = await context.supabase.from("ugc_scripts")
      .select("id, business_id, title, platform, script_json").eq("id", data.script_id).maybeSingle();
    if (error || !script) throw new Error("Script not found");
    const workspace_id = await loadWorkspaceId(context.supabase, script.business_id as string);
    await requireEntitlement(workspace_id, "ugc_videos");
    // Storyboard generation itself is free; we charge only for the video render.

    const sj = (script.script_json ?? {}) as any;
    const { data: brand } = await context.supabase.from("brand_profiles")
      .select("brand_name, tone, visual_style, positioning").eq("business_id", script.business_id).maybeSingle();

    const tool = {
      type: "function" as const,
      function: { name: "build_storyboard", description: "Build a text-to-video storyboard.", parameters: StoryboardSchema as any },
    };
    const sysPrompt = `You are Wazeer AI, a creative producer. Convert a UGC script into a text-to-video storyboard. Each scene_prompt is a self-contained text prompt for a video model. Reply ONLY through the tool. ${SAFETY}`;
    const userPrompt = `Brand: ${brand?.brand_name ?? "—"} | Tone: ${brand?.tone ?? "—"} | Visual style: ${brand?.visual_style ?? "—"}
Aspect ratio: ${data.aspect_ratio}
Title: ${sj.title}
Hook: ${sj.hook_3s}
Scenes: ${JSON.stringify(sj.scenes ?? [])}
CTA: ${sj.cta}`;

    const parsed = await callVideoAI(
      [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
      tool, "build_storyboard",
    );

    const storyboard_json = {
      ...parsed,
      aspect_ratio: data.aspect_ratio,
      script_title: sj.title,
      length_s: sj.length_s ?? null,
      generated_at: new Date().toISOString(),
    };

    const { data: existing } = await context.supabase.from("ugc_videos")
      .select("id").eq("script_id", data.script_id).eq("status", "draft").maybeSingle();

    if (existing?.id) {
      const { error: upErr } = await context.supabase.from("ugc_videos")
        .update({ storyboard_json: storyboard_json as any }).eq("id", existing.id);
      if (upErr) throw new Error(upErr.message);
      return { id: existing.id, storyboard: storyboard_json };
    }
    const { data: row, error: insErr } = await context.supabase.from("ugc_videos").insert({
      business_id: script.business_id,
      script_id: data.script_id,
      status: "draft",
      storyboard_json: storyboard_json as any,
    }).select("id").single();
    if (insErr) throw new Error(insErr.message);
    return { id: row!.id, storyboard: storyboard_json };
  });

export const updateStoryboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    video_id: z.string().uuid(),
    storyboard_json: z.record(z.string(), z.any()),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ugc_videos")
      .update({ storyboard_json: data.storyboard_json as any }).eq("id", data.video_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const regenerateStoryboardScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    video_id: z.string().uuid(),
    scene_no: z.number().int().min(1),
    brief: z.string().max(500).optional().default(""),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: vid, error } = await context.supabase.from("ugc_videos")
      .select("id, business_id, storyboard_json").eq("id", data.video_id).maybeSingle();
    if (error || !vid) throw new Error("Video not found");
    const workspace_id = await loadWorkspaceId(context.supabase, vid.business_id as string);
    await requireEntitlement(workspace_id, "ugc_videos");
    await consumeCredits(workspace_id, "ugc_video_scene", { video_id: data.video_id });

    try {
      const sb = (vid.storyboard_json ?? {}) as any;
      const scene = (sb.scene_prompts ?? []).find((s: any) => s.scene_no === data.scene_no);
      if (!scene) throw new Error("Scene not found");
      const tool = {
        type: "function" as const,
        function: {
          name: "rewrite_video_scene",
          description: "Rewrite a single text-to-video scene prompt.",
          parameters: { type: "object", properties: { scene: StoryboardSchema.properties.scene_prompts.items }, required: ["scene"], additionalProperties: false },
        },
      };
      const parsed = await callVideoAI(
        [
          { role: "system", content: `You are Wazeer AI. Rewrite ONE storyboard scene. Keep scene_no, similar duration. Reply via tool. ${SAFETY}` },
          { role: "user", content: `Existing: ${JSON.stringify(scene)}\nAspect: ${sb.aspect_ratio}\nBrief: ${data.brief || "(none)"}` },
        ],
        tool, "rewrite_video_scene",
      );
      const newScene = { ...parsed.scene, scene_no: data.scene_no };
      const next = { ...sb, scene_prompts: (sb.scene_prompts ?? []).map((s: any) => s.scene_no === data.scene_no ? newScene : s) };
      const { error: upErr } = await context.supabase.from("ugc_videos").update({ storyboard_json: next as any }).eq("id", vid.id);
      if (upErr) throw new Error(upErr.message);
      return { ok: true, scene: newScene };
    } catch (err) {
      await refundCredits(workspace_id, "ugc_video_scene", { video_id: data.video_id });
      throw err;
    }
  });

export const renderUgcVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ video_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: vid, error } = await context.supabase.from("ugc_videos")
      .select("id, business_id, storyboard_json, status").eq("id", data.video_id).maybeSingle();
    if (error || !vid) throw new Error("Video not found");
    if (vid.status === "rendering") throw new Error("Already rendering");
    const workspace_id = await loadWorkspaceId(context.supabase, vid.business_id as string);
    await requireEntitlement(workspace_id, "ugc_videos");
    await consumeCredits(workspace_id, "ugc_video", { video_id: vid.id });

    try {
      const sb = (vid.storyboard_json ?? {}) as any;
      const provider = getVideoProvider();
      const job = await provider.start({
        scene_prompts: (sb.scene_prompts ?? []).map((s: any) => ({ scene_no: s.scene_no, prompt: s.prompt, duration_s: s.duration_s })),
        format: (sb.aspect_ratio ?? "9_16") as VideoFormat,
        voiceover: sb.voiceover ?? null,
        seed: vid.id,
      });
      const nextSb = { ...sb, provider: job.provider, started_at: Date.now(), finishes_at: job.finishes_at ?? null };
      const { error: upErr } = await context.supabase.from("ugc_videos").update({
        status: "rendering",
        provider_job_id: job.job_id,
        storyboard_json: nextSb as any,
        error_message: null,
      }).eq("id", vid.id);
      if (upErr) throw new Error(upErr.message);
      return { ok: true, job_id: job.job_id, status: "rendering" };
    } catch (err) {
      await refundCredits(workspace_id, "ugc_video", { video_id: vid.id });
      await context.supabase.from("ugc_videos").update({ status: "failed", error_message: err instanceof Error ? err.message : String(err) }).eq("id", vid.id);
      throw err;
    }
  });

export const pollUgcVideoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ video_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: vid, error } = await context.supabase.from("ugc_videos")
      .select("id, business_id, status, provider_job_id, storyboard_json, video_url").eq("id", data.video_id).maybeSingle();
    if (error || !vid) throw new Error("Video not found");
    if (vid.status !== "rendering" || !vid.provider_job_id) {
      return { status: vid.status, video_url: vid.video_url };
    }
    try {
      const provider = getVideoProvider();
      const sb = (vid.storyboard_json ?? {}) as any;
      const started_at = Number(sb.started_at ?? Date.now());
      const job = await provider.poll(vid.provider_job_id, started_at);
      if (job.status === "ready" && job.video_url) {
        await context.supabase.from("ugc_videos").update({
          status: "ready", video_url: job.video_url, error_message: null,
        }).eq("id", vid.id);
        return { status: "ready", video_url: job.video_url };
      }
      if (job.status === "failed") {
        await context.supabase.from("ugc_videos").update({
          status: "failed", error_message: job.error ?? "Render failed",
        }).eq("id", vid.id);
        return { status: "failed", video_url: null };
      }
      return { status: "rendering", video_url: null };
    } catch (err) {
      await context.supabase.from("ugc_videos").update({
        status: "failed", error_message: err instanceof Error ? err.message : String(err),
      }).eq("id", vid.id);
      return { status: "failed", video_url: null };
    }
  });

export const listUgcVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    business_id: z.string().uuid().nullable().optional(),
    status: z.string().nullable().optional(),
    limit: z.number().int().min(1).max(100).optional().default(50),
  }).parse(input))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("ugc_videos")
      .select("id, business_id, script_id, status, video_url, storyboard_json, error_message, created_at")
      .order("created_at", { ascending: false }).limit(data.limit);
    if (data.business_id) q = q.eq("business_id", data.business_id);
    if (data.status) q = q.eq("status", data.status as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const getUgcVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ video_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: vid, error } = await context.supabase.from("ugc_videos")
      .select("id, business_id, script_id, status, video_url, storyboard_json, error_message, provider_job_id, created_at, updated_at").eq("id", data.video_id).maybeSingle();
    if (error || !vid) throw new Error("Video not found");
    const { data: biz } = await context.supabase.from("businesses").select("name").eq("id", vid.business_id).maybeSingle();
    const { data: script } = vid.script_id
      ? await context.supabase.from("ugc_scripts").select("id, title, platform").eq("id", vid.script_id).maybeSingle()
      : { data: null } as any;
    return { video: vid, business: biz, script };
  });

export const useVideoForMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    video_id: z.string().uuid(),
    target: z.enum(["post", "ad"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: vid, error } = await context.supabase.from("ugc_videos")
      .select("id, storyboard_json, status").eq("id", data.video_id).maybeSingle();
    if (error || !vid) throw new Error("Video not found");
    if (vid.status !== "ready") throw new Error("Video not ready yet");
    const sb = (vid.storyboard_json ?? {}) as any;
    // Mark as posted + record where it was queued. Stage 7 (Meta) will pick this up.
    const next = { ...sb, used_for: data.target, queued_at: new Date().toISOString() };
    const { error: upErr } = await context.supabase.from("ugc_videos").update({
      status: "posted", storyboard_json: next as any,
    }).eq("id", vid.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, target: data.target };
  });

export const deleteUgcVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ video_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ugc_videos").delete().eq("id", data.video_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
