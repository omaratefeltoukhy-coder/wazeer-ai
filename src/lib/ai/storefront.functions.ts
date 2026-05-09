import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeCredits, refundCredits, requireEntitlement } from "@/lib/billing/guard.server";
import { callAI } from "@/lib/ai/gateway";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SECTIONS = ["hero", "benefits", "how_it_works", "faq", "final_cta"] as const;
type Section = (typeof SECTIONS)[number];

// Deterministic mock used when LOVABLE_API_KEY is missing so the storefront
// editor's "Regenerate" buttons keep working in demo mode. Mirrors the shape
// the AI tool returns for each section.
function buildSectionMock(
  section: Section,
  ctx: { brand?: { brand_name?: string | null; tone?: string | null; positioning?: string | null } | null; biz?: { name?: string | null; target_audience?: string | null; desired_result?: string | null; description?: string | null } | null },
): unknown {
  const brandName = ctx.brand?.brand_name || ctx.biz?.name || "Your business";
  const audience = ctx.biz?.target_audience || "your customers";
  const result = ctx.biz?.desired_result || "the outcome you actually want";
  switch (section) {
    case "hero":
      return {
        headline: `${brandName} — ${result}.`,
        sub: `Built for ${audience}. ${ctx.brand?.positioning || "Skip the marketing learning curve."}`,
        cta: "Get started",
      };
    case "benefits":
      return [
        { title: "Set up in minutes, not weeks", body: "From idea to ready-to-launch in a single workflow." },
        { title: "Stays on-brand automatically", body: `Every asset matches ${brandName}'s tone and visuals — no manual tweaks.` },
        { title: "Always know your next move", body: "AI recommendations surface what's working and what to fix." },
      ];
    case "how_it_works":
      return [
        { step: "Tell us about your business", body: "One short input — a description, link, or product photo — is all we need." },
        { step: "Wazeer AI builds the kit", body: "Storefront, content, ads, and emails drafted for your review in minutes." },
        { step: "Approve and launch", body: "Edit anything, then go live with one click." },
      ];
    case "faq":
      return [
        { q: "How long does setup take?", a: "Most users have a complete kit ready within minutes of finishing the wizard." },
        { q: "Can I edit the AI output?", a: "Yes. Every section, image, email, and ad is fully editable." },
        { q: "Will my ads launch automatically?", a: "Never. Ads, emails, and posts always need your explicit approval." },
        { q: "What if I don't have testimonials yet?", a: "Wazeer AI never invents fake reviews. Add real customer quotes when you have them." },
      ];
    case "final_cta":
      return {
        headline: `Ready to launch ${brandName}?`,
        sub: `Everything is in place. Approve, edit, then publish.`,
        cta: "Start selling with AI",
      };
  }
}

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
    const patch: { title?: string; content_json?: any } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.content_json !== undefined) patch.content_json = data.content_json as any;
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

      // Demo-mode fallback: if the AI provider isn't configured, return a
      // deterministic mock section shaped like the real tool's output so the
      // editor flow stays usable without provider credentials.
      if (!LOVABLE_API_KEY) {
        const content = buildSectionMock(data.section, { brand, biz });
        const next = { ...(sf.content_json as Record<string, any>), [data.section]: content };
        const { error: upErr } = await context.supabase
          .from("storefronts")
          .update({ content_json: next as any })
          .eq("id", sf.id);
        if (upErr) throw new Error(upErr.message);
        return { ok: true, section: data.section, content: content as any, provider: "mock" as const };
      }

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

      const aiRes = await callAI({
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool as any],
        toolChoice: { type: "function", function: { name: "rewrite_section" } },
      });
      const args = aiRes.toolCalls?.[0]?.function?.arguments;
      if (!args) throw new Error("AI returned no structured output");
      const parsed = typeof args === "string" ? JSON.parse(args) : args;
      const content = parsed.content;

      const next = { ...(sf.content_json as any), [data.section]: content };
      const { error: upErr } = await context.supabase
        .from("storefronts")
        .update({ content_json: next as any })
        .eq("id", sf.id);
      if (upErr) throw new Error(upErr.message);
      return { ok: true, section: data.section, content: content as any, provider: "lovable_ai" as const };
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
