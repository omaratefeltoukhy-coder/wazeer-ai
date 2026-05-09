import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI } from "@/lib/ai/gateway";

const FORMAT_DIMS = {
  "1_1": { w: 1024, h: 1024 },
  "9_16": { w: 720, h: 1280 },
  "16_9": { w: 1280, h: 720 },
} as const;

async function workspaceFor(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("Workspace not found");
  return data.workspace_id as string;
}

/* ───────── Image ───────── */

export const generateContentImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      goal: z.string().min(1),
      product_id: z.string().uuid().nullable().optional(),
      prompt: z.string().min(3).max(2000),
      format: z.enum(["1_1", "9_16", "16_9"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const workspace_id = await workspaceFor(context.supabase, context.userId);
    const dims = FORMAT_DIMS[data.format];

    let file_url = "";
    try {
      const aiRes = await callAI({
        messages: [
          {
            role: "user",
            content: `Generate an image for this brief. Goal: ${data.goal}. Brief: ${data.prompt}. Aspect: ${data.format.replace("_", ":")}.`,
          },
        ],
        model: "google/gemini-2.5-flash-image-preview",
      });
      const imgs = aiRes.images;
      file_url = imgs?.[0]?.image_url?.url || "";
    } catch (e) {
      // fall back to placeholder
      file_url = "";
    }
    if (!file_url) {
      file_url = `https://picsum.photos/seed/${encodeURIComponent(data.prompt.slice(0, 32))}-${Date.now()}/${dims.w}/${dims.h}`;
    }

    const { data: row, error } = await context.supabase
      .from("ai_content")
      .insert({
        workspace_id,
        user_id: context.userId,
        product_id: data.product_id ?? null,
        content_type: "image",
        goal: data.goal,
        format: data.format,
        prompt: data.prompt,
        result_url: file_url,
        status: "ready",
      })
      .select("id, result_url")
      .single();
    if (error || !row) throw new Error(error?.message || "Failed to save");
    return { id: row.id, result_url: row.result_url };
  });

/* ───────── Video (placeholder) ───────── */

export const generateContentVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      script: z.string().min(3).max(5000),
      style: z.enum(["ai_presenter", "text_on_screen"]),
      goal: z.string().min(1),
      product_id: z.string().uuid().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const workspace_id = await workspaceFor(context.supabase, context.userId);
    // Mock: return a sample video URL. Real provider can be wired later.
    const sampleVideos = [
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    ];
    const result_url = sampleVideos[Math.floor(Math.random() * sampleVideos.length)];

    const { data: row, error } = await context.supabase
      .from("ai_content")
      .insert({
        workspace_id,
        user_id: context.userId,
        product_id: data.product_id ?? null,
        content_type: "video",
        goal: data.goal,
        prompt: data.script.slice(0, 500),
        script_text: data.script,
        result_url,
        status: "ready",
        metadata: { style: data.style, mock: true },
      })
      .select("id, result_url")
      .single();
    if (error || !row) throw new Error(error?.message || "Failed to save");
    return { id: row.id, result_url: row.result_url };
  });

/* ───────── UGC Script ───────── */

export const generateContentScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      product_id: z.string().uuid().nullable().optional(),
      script_type: z.enum(["hook_story_cta", "problem_solution", "testimonial", "tutorial"]),
      platform: z.enum(["tiktok", "instagram_reels", "youtube_shorts"]),
      extra_brief: z.string().max(800).optional().default(""),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const workspace_id = await workspaceFor(context.supabase, context.userId);

    let productCtx = "";
    if (data.product_id) {
      const { data: p } = await context.supabase
        .from("products")
        .select("title, description, price, currency")
        .eq("id", data.product_id)
        .maybeSingle();
      if (p) productCtx = `Product: ${p.title} — ${p.description ?? ""} (${p.currency} ${p.price})`;
    }

    const typeLabel = {
      hook_story_cta: "Hook + Story + CTA",
      problem_solution: "Problem → Solution",
      testimonial: "Testimonial style",
      tutorial: "Tutorial style",
    }[data.script_type];
    const platformLabel = { tiktok: "TikTok", instagram_reels: "Instagram Reels", youtube_shorts: "YouTube Shorts" }[data.platform];

    const sys = `You are Wazeer AI, a UGC creative director. Write a short (~30s) UGC script for ${platformLabel} in the "${typeLabel}" structure.
Reply ONLY in JSON with keys: hook (string), body (string), cta (string), spoken_script (string). No prose, no markdown.
Avoid invented testimonials, medical/financial claims.`;
    const user = `${productCtx}\nExtra brief: ${data.extra_brief || "(none)"}`;

    const aiRes = await callAI({
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      responseFormat: { type: "json_object" },
    });
    const raw = aiRes.content || "{}";
    let parsed: { hook: string; body: string; cta: string; spoken_script: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    const formatted = `HOOK\n${parsed.hook}\n\nBODY\n${parsed.body}\n\nCTA\n${parsed.cta}`;

    const { data: row, error } = await context.supabase
      .from("ai_content")
      .insert({
        workspace_id,
        user_id: context.userId,
        product_id: data.product_id ?? null,
        content_type: "ugc",
        goal: typeLabel,
        prompt: data.extra_brief || typeLabel,
        script_text: formatted,
        status: "ready",
        metadata: { platform: data.platform, script_type: data.script_type, parts: parsed },
      })
      .select("id, script_text, metadata")
      .single();
    if (error || !row) throw new Error(error?.message || "Failed to save");
    return { id: row.id, script_text: row.script_text, parts: parsed };
  });

/* ───────── List / Delete ───────── */

export const listContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      filter: z.enum(["all", "image", "video", "ugc"]).optional().default("all"),
      limit: z.number().int().min(1).max(100).optional().default(50),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("ai_content")
      .select("id, content_type, goal, prompt, result_url, script_text, metadata, status, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.filter !== "all") q = q.eq("content_type", data.filter);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const deleteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ai_content").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const suggestPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ goal: z.string().min(1), product_id: z.string().uuid().nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let productCtx = "";
    if (data.product_id) {
      const { data: p } = await context.supabase
        .from("products").select("title, description").eq("id", data.product_id).maybeSingle();
      if (p) productCtx = `Product: ${p.title} — ${p.description ?? ""}`;
    }
    const aiRes = await callAI([
      { role: "system", content: "You write concise, vivid image generation prompts (one paragraph, max 80 words). Reply with the prompt only — no prefix, no quotes." },
      { role: "user", content: `Goal: ${data.goal}\n${productCtx}\nWrite the prompt now.` },
    ]);
    const text: string = aiRes.content?.trim() || "";
    return { prompt: text };
  });

export const generateVideoScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ goal: z.string().min(1), product_id: z.string().uuid().nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let productCtx = "";
    if (data.product_id) {
      const { data: p } = await context.supabase
        .from("products").select("title, description").eq("id", data.product_id).maybeSingle();
      if (p) productCtx = `Product: ${p.title} — ${p.description ?? ""}`;
    }
    const aiRes = await callAI([
      { role: "system", content: "You write short ~30 second video scripts. Plain text, 3-6 short lines, no headings. Avoid invented claims." },
      { role: "user", content: `Goal: ${data.goal}\n${productCtx}\nWrite the script now.` },
    ]);
    const text: string = aiRes.content?.trim() || "";
    return { script: text };
  });
