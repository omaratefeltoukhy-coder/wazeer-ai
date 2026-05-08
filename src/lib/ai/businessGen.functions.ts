import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(2).max(120),
  type: z.string().min(1).max(40),
  description: z.string().min(5).max(2000),
  target_audience: z.string().max(500).optional().default(""),
  pain_point: z.string().max(1000).optional().default(""),
  desired_result: z.string().max(1000).optional().default(""),
  goal: z.string().max(40).optional().default("sales"),
  country: z.string().max(80).optional().default(""),
  currency: z.string().max(8).optional().default("USD"),
  language: z.string().max(8).optional().default("en"),
});

const CREDIT_COST = 15;

function slugify(s: string, fallback: string) {
  const v = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return v || fallback;
}

export const generateBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Insert business as `generating`
    const { data: biz, error: bizErr } = await supabase
      .from("businesses")
      .insert({
        workspace_id: data.workspace_id,
        user_id: userId,
        name: data.name,
        type: data.type as never,
        description: data.description,
        target_audience: data.target_audience || null,
        pain_point: data.pain_point || null,
        desired_result: data.desired_result || null,
        goal: data.goal,
        country: data.country || null,
        currency: data.currency,
        language: data.language,
        status: "generating",
      })
      .select("id")
      .single();
    if (bizErr || !biz) throw new Error(bizErr?.message || "Failed to create business");
    const businessId = biz.id as string;

    // 2) Save raw input
    await supabase.from("business_inputs").insert({
      business_id: businessId,
      input_type: "wizard",
      original_text: data.description,
      extracted_data_json: JSON.parse(JSON.stringify(data)),
    });

    // 3) Call Lovable AI for full plan via tool calling
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) {
      await supabase.from("businesses").update({ status: "failed" }).eq("id", businessId);
      throw new Error("AI gateway not configured");
    }

    const sysPrompt = `You are Wazeer AI, a senior brand & growth strategist. Given a business brief, you produce a complete go-to-market kit: brand profile, opening offer, storefront sections, and 3 high-impact recommendations. Be specific, premium, conversion-focused. Always reply via the provided tool.`;

    const userPrompt = `Business brief:
Name: ${data.name}
Type: ${data.type}
Description: ${data.description}
Target audience: ${data.target_audience}
Pain point: ${data.pain_point}
Desired result: ${data.desired_result}
Primary goal: ${data.goal}
Country: ${data.country}
Currency: ${data.currency}
Language: ${data.language}`;

    const tool = {
      type: "function" as const,
      function: {
        name: "build_business_kit",
        description: "Return a complete brand profile, offer, storefront content and recommendations.",
        parameters: {
          type: "object",
          properties: {
            brand: {
              type: "object",
              properties: {
                brand_name: { type: "string" },
                tone: { type: "string" },
                visual_style: { type: "string" },
                positioning: { type: "string" },
                colors: {
                  type: "object",
                  properties: {
                    primary: { type: "string" },
                    accent: { type: "string" },
                    background: { type: "string" },
                  },
                  required: ["primary", "accent", "background"],
                  additionalProperties: false,
                },
                audience: {
                  type: "object",
                  properties: {
                    persona: { type: "string" },
                    demographics: { type: "string" },
                    psychographics: { type: "string" },
                  },
                  required: ["persona", "demographics", "psychographics"],
                  additionalProperties: false,
                },
                benefits: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
                pain_points: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
                objections: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
              },
              required: ["brand_name", "tone", "visual_style", "positioning", "colors", "audience", "benefits", "pain_points", "objections"],
              additionalProperties: false,
            },
            offer: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                price: { type: "number" },
                billing_interval: { type: "string", enum: ["one_time", "month", "year"] },
                free_trial_days: { type: "number" },
              },
              required: ["name", "description", "price", "billing_interval", "free_trial_days"],
              additionalProperties: false,
            },
            storefront: {
              type: "object",
              properties: {
                title: { type: "string" },
                hero: {
                  type: "object",
                  properties: {
                    headline: { type: "string" },
                    sub: { type: "string" },
                    cta: { type: "string" },
                  },
                  required: ["headline", "sub", "cta"],
                  additionalProperties: false,
                },
                benefits: { type: "array", items: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } }, required: ["title", "body"], additionalProperties: false }, minItems: 3, maxItems: 4 },
                how_it_works: { type: "array", items: { type: "object", properties: { step: { type: "string" }, body: { type: "string" } }, required: ["step", "body"], additionalProperties: false }, minItems: 3, maxItems: 4 },
                testimonials: { type: "array", items: { type: "object", properties: { quote: { type: "string" }, author: { type: "string" } }, required: ["quote", "author"], additionalProperties: false }, minItems: 2, maxItems: 3 },
                faq: { type: "array", items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"], additionalProperties: false }, minItems: 4, maxItems: 6 },
                final_cta: {
                  type: "object",
                  properties: { headline: { type: "string" }, sub: { type: "string" }, cta: { type: "string" } },
                  required: ["headline", "sub", "cta"],
                  additionalProperties: false,
                },
              },
              required: ["title", "hero", "benefits", "how_it_works", "testimonials", "faq", "final_cta"],
              additionalProperties: false,
            },
            recommendations: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  title: { type: "string" },
                  problem: { type: "string" },
                  recommendation: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["category", "title", "problem", "recommendation", "priority"],
                additionalProperties: false,
              },
            },
          },
          required: ["brand", "offer", "storefront", "recommendations"],
          additionalProperties: false,
        },
      },
    };

    let kit: any;
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "build_business_kit" } },
        }),
      });

      if (!aiRes.ok) {
        const text = await aiRes.text();
        await supabase.from("businesses").update({ status: "failed", generation_log_json: { error: text, status: aiRes.status } }).eq("id", businessId);
        if (aiRes.status === 429) throw new Error("Rate limit hit. Please wait a moment and try again.");
        if (aiRes.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
        throw new Error(`AI generation failed (${aiRes.status})`);
      }

      const json = await aiRes.json();
      const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) throw new Error("AI returned no structured output");
      kit = typeof args === "string" ? JSON.parse(args) : args;
    } catch (err) {
      await supabase.from("businesses").update({ status: "failed" }).eq("id", businessId);
      throw err;
    }

    // 4) Persist generated artifacts
    const slug = slugify(data.name, `biz-${businessId.slice(0, 6)}`);
    const isSubLike = ["subscription", "course", "coaching", "membership"].includes(data.type);
    const billing = kit.offer.billing_interval === "one_time" ? null : kit.offer.billing_interval;

    const writes = await Promise.all([
      supabase.from("brand_profiles").insert({
        business_id: businessId,
        brand_name: kit.brand.brand_name,
        tone: kit.brand.tone,
        visual_style: kit.brand.visual_style,
        positioning: kit.brand.positioning,
        colors_json: kit.brand.colors,
        audience_json: kit.brand.audience,
        benefits_json: kit.brand.benefits,
        pain_points_json: kit.brand.pain_points,
        objections_json: kit.brand.objections,
      }),
      supabase.from("offers").insert({
        business_id: businessId,
        name: kit.offer.name,
        description: kit.offer.description,
        type: data.type as never,
        price: kit.offer.price,
        currency: data.currency,
        billing_interval: isSubLike ? (billing ?? "month") : billing,
        free_trial_days: kit.offer.free_trial_days ?? 0,
        status: "draft",
      }),
      supabase.from("storefronts").insert({
        business_id: businessId,
        slug,
        title: kit.storefront.title,
        status: "draft",
        content_json: kit.storefront,
      }),
      supabase.from("ai_recommendations").insert(
        (kit.recommendations as any[]).map((r) => ({
          business_id: businessId,
          category: r.category,
          title: r.title,
          problem: r.problem,
          recommendation: r.recommendation,
          priority: r.priority,
          status: "open",
          confidence_score: 0.8,
        })),
      ),
    ]);

    const writeError = writes.find((w) => w.error)?.error;
    if (writeError) {
      await supabase.from("businesses").update({ status: "failed", generation_log_json: { write_error: writeError.message } }).eq("id", businessId);
      throw new Error(`Failed to save generated kit: ${writeError.message}`);
    }

    // 5) Deduct credits + mark ready
    await supabase.from("credit_transactions").insert({
      workspace_id: data.workspace_id,
      user_id: userId,
      amount: -CREDIT_COST,
      reason: "business_generation",
      metadata_json: { business_id: businessId },
    });

    await supabase
      .from("businesses")
      .update({ status: "ready", generation_log_json: { model: "google/gemini-2.5-flash", credits: CREDIT_COST } })
      .eq("id", businessId);

    return { business_id: businessId, slug };
  });
