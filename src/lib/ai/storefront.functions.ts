import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeCredits, refundCredits, requireEntitlement } from "@/lib/billing/guard.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SECTIONS = ["hero", "benefits", "how_it_works", "faq", "final_cta"] as const;
type Section = (typeof SECTIONS)[number];

async function loadStorefront(supabase: any, business_id: string) {
  const { data, error } = await supabase
    .from("storefronts")
    .select("id, business_id, slug, title, status, content_json, published_url")
    .eq("business_id", business_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Storefront not found");
  return data;
}

async function loadWorkspaceId(supabase: any, business_id: string): Promise<string> {
  const { data, error } = await supabase
    .from("businesses")
    .select("workspace_id")
    .eq("id", business_id)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Business not found");
  return data.workspace_id as string;
}

export const getStorefrontByBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ business_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sf = await loadStorefront(context.supabase, data.business_id);
    const { data: biz } = await context.supabase
      .from("businesses")
      .select("id, name, type, currency, workspace_id")
      .eq("id", data.business_id)
      .maybeSingle();
    const { data: offer } = await context.supabase
      .from("offers")
      .select("id, name, description, price, currency, billing_interval, status")
      .eq("business_id", data.business_id)
      .maybeSingle();
    return { storefront: sf, business: biz, offer };
  });

export const updateStorefront = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      business_id: z.string().uuid(),
      title: z.string().min(1).max(160).optional(),
      content_json: z.record(z.string(), z.any()).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sf = await loadStorefront(context.supabase, data.business_id);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.content_json !== undefined) patch.content_json = data.content_json;
    const { error } = await context.supabase.from("storefronts").update(patch).eq("id", sf.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const regenerateStorefrontSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      business_id: z.string().uuid(),
      section: z.enum(SECTIONS),
      brief: z.string().max(1000).optional().default(""),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const workspace_id = await loadWorkspaceId(context.supabase, data.business_id);
    await requireEntitlement(workspace_id, "storefront");
    await consumeCredits(workspace_id, "storefront_section_regenerate", { section: data.section });

    try {
      const sf = await loadStorefront(context.supabase, data.business_id);
      const { data: brand } = await context.supabase
        .from("brand_profiles")
        .select("brand_name, tone, positioning, audience_json, benefits_json")
        .eq("business_id", data.business_id)
        .maybeSingle();
      const { data: biz } = await context.supabase
        .from("businesses")
        .select("name, type, description, target_audience, desired_result")
        .eq("id", data.business_id)
        .maybeSingle();

      const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
      if (!LOVABLE_API_KEY) throw new Error("AI gateway not configured");

      const sectionSchemas: Record<Section, any> = {
        hero: { type: "object", properties: { headline: { type: "string" }, sub: { type: "string" }, cta: { type: "string" } }, required: ["headline", "sub", "cta"], additionalProperties: false },
        benefits: { type: "array", minItems: 3, maxItems: 4, items: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } }, required: ["title", "body"], additionalProperties: false } },
        how_it_works: { type: "array", minItems: 3, maxItems: 4, items: { type: "object", properties: { step: { type: "string" }, body: { type: "string" } }, required: ["step", "body"], additionalProperties: false } },
        faq: { type: "array", minItems: 4, maxItems: 6, items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"], additionalProperties: false } },
        final_cta: { type: "object", properties: { headline: { type: "string" }, sub: { type: "string" }, cta: { type: "string" } }, required: ["headline", "sub", "cta"], additionalProperties: false },
      };

      const tool = {
        type: "function" as const,
        function: {
          name: "rewrite_section",
          description: `Rewrite the storefront ${data.section} section.`,
          parameters: {
            type: "object",
            properties: { content: sectionSchemas[data.section] },
            required: ["content"],
            additionalProperties: false,
          },
        },
      };

      const sysPrompt = `You are Wazeer AI, a senior conversion copywriter. Rewrite a single storefront section. Be specific, premium, customer-focused. Always reply via the provided tool.`;
      const userPrompt = `Brand: ${brand?.brand_name ?? biz?.name}
Tone: ${brand?.tone ?? "confident"}
Positioning: ${brand?.positioning ?? ""}
Business: ${biz?.name} (${biz?.type}) — ${biz?.description}
Target: ${biz?.target_audience ?? ""}
Desired result: ${biz?.desired_result ?? ""}
Section to rewrite: ${data.section}
Extra instructions: ${data.brief || "(none)"}`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "rewrite_section" } },
        }),
      });
      if (!aiRes.ok) {
        const text = await aiRes.text();
        if (aiRes.status === 429) throw new Error("Rate limit hit. Please wait a moment and try again.");
        if (aiRes.status === 402) throw new Error("AI credits exhausted. Top up to continue.");
        throw new Error(`AI generation failed (${aiRes.status}): ${text.slice(0, 200)}`);
      }
      const json = await aiRes.json();
      const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) throw new Error("AI returned no structured output");
      const parsed = typeof args === "string" ? JSON.parse(args) : args;
      const content = parsed.content;

      const next = { ...(sf.content_json as any), [data.section]: content };
      const { error: upErr } = await context.supabase
        .from("storefronts")
        .update({ content_json: next })
        .eq("id", sf.id);
      if (upErr) throw new Error(upErr.message);
      return { ok: true, section: data.section, content };
    } catch (err) {
      await refundCredits(workspace_id, "storefront_section_regenerate", { business_id: data.business_id });
      throw err;
    }
  });

export const setStorefrontPublishStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      business_id: z.string().uuid(),
      action: z.enum(["publish", "unpublish"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const workspace_id = await loadWorkspaceId(context.supabase, data.business_id);
    await requireEntitlement(workspace_id, "storefront");
    const sf = await loadStorefront(context.supabase, data.business_id);
    const status = data.action === "publish" ? "published" : "draft";
    const { error } = await context.supabase
      .from("storefronts")
      .update({ status, published_url: data.action === "publish" ? `/s/${sf.slug}` : null })
      .eq("id", sf.id);
    if (error) throw new Error(error.message);

    // If publishing, also mark the offer as active so checkout works.
    if (data.action === "publish") {
      await context.supabase.from("offers").update({ status: "active" }).eq("business_id", data.business_id);
    }

    // Audit log entry
    await supabaseAdmin.from("audit_logs").insert({
      workspace_id,
      business_id: data.business_id,
      user_id: context.userId,
      action: data.action,
      entity: "storefront",
      entity_id: sf.id,
      metadata_json: { slug: sf.slug } as never,
    });

    return { ok: true, status, slug: sf.slug };
  });
