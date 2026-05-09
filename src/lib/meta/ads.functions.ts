import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { consumeCredits, refundCredits, requireEntitlement } from "@/lib/billing/guard.server";
import { callAI } from "@/lib/ai/gateway";

export const AD_GOALS = ["sales", "leads", "website_traffic", "messages", "awareness", "subscriptions"] as const;
export const AUDIENCE_KINDS = ["ai_recommended", "local", "interest", "retargeting", "lookalike"] as const;

const SAFETY = `Hard rules:
- No fake testimonials/quotes/numbers.
- No medical/financial/legal claims.
- Comply with Meta ad policy. Avoid before/after, sensitive attributes.`;

const AdCopySchema = {
  type: "object",
  additionalProperties: false,
  required: ["campaign_name","objective","audience_recommendation","budget_recommendation","headline","primary_text","description","cta","creative_recommendation","landing_page_url","utm_params","tracking_notes","risks","approval_checklist"],
  properties: {
    campaign_name: { type: "string" }, objective: { type: "string" },
    audience_recommendation: { type: "string" }, budget_recommendation: { type: "string" },
    headline: { type: "string" }, primary_text: { type: "string" }, description: { type: "string" },
    cta: { type: "string" }, creative_recommendation: { type: "string" },
    landing_page_url: { type: "string" }, utm_params: { type: "string" },
    tracking_notes: { type: "string" }, risks: { type: "string" },
    approval_checklist: { type: "array", items: { type: "string" } },
  },
} as const;

async function loadWs(supabase: any, business_id: string): Promise<string> {
  const { data } = await supabase.from("businesses").select("workspace_id").eq("id", business_id).maybeSingle();
  if (!data) throw new Error("Business not found");
  return (data as any).workspace_id;
}

async function loadCtx(supabase: any, business_id: string) {
  const [{ data: biz }, { data: brand }, { data: offer }, { data: sf }] = await Promise.all([
    supabase.from("businesses").select("name, type, description, target_audience, desired_result, pain_point, currency, country").eq("id", business_id).maybeSingle(),
    supabase.from("brand_profiles").select("brand_name, tone, positioning, audience_json, benefits_json").eq("business_id", business_id).maybeSingle(),
    supabase.from("offers").select("id, name, description, price, currency").eq("business_id", business_id).maybeSingle(),
    supabase.from("storefronts").select("slug").eq("business_id", business_id).maybeSingle(),
  ]);
  return { biz, brand, offer, sf };
}

async function callAdsAI(messages: any[], tool: any, toolName: string) {
  const aiRes = await callAI({
    messages,
    tools: [tool as any],
    toolChoice: { type: "function", function: { name: toolName } },
  });
  const args = aiRes.toolCalls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured output");
  return typeof args === "string" ? JSON.parse(args) : args;
}

export const generateMetaAdCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    business_id: z.string().uuid(),
    goal: z.enum(AD_GOALS),
    offer_id: z.string().uuid().nullable().optional(),
    audience_kind: z.enum(AUDIENCE_KINDS),
    daily_budget: z.number().positive().max(10000),
    duration_days: z.number().int().positive().max(365),
    media_asset_id: z.string().uuid().nullable().optional(),
    brief: z.string().max(500).optional().default(""),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const ws_id = await loadWs(context.supabase, data.business_id);
    await requireEntitlement(ws_id, "meta_ads");
    await consumeCredits(ws_id, "meta_ad", { business_id: data.business_id, goal: data.goal });
    try {
      const { biz, brand, offer, sf } = await loadCtx(context.supabase, data.business_id);
      const tool = { type: "function" as const, function: { name: "write_ad", description: "Write Meta ad copy.", parameters: AdCopySchema as any } };
      const sys = `You are Wazeer, a senior Meta media buyer. Write compliant ad copy. Reply via tool. ${SAFETY}`;
      const user = `Brand: ${brand?.brand_name ?? biz?.name} | Tone: ${brand?.tone ?? "warm"}
Business: ${biz?.name} (${biz?.type}) â€” ${biz?.description ?? ""}
Audience: ${biz?.target_audience ?? ""} | Country: ${biz?.country ?? ""}
Offer: ${offer?.name ?? "â€”"} â€” ${offer?.description ?? ""} (${offer?.price ?? ""} ${offer?.currency ?? ""})
Goal: ${data.goal} | Audience kind: ${data.audience_kind}
Daily budget: $${data.daily_budget} | Duration: ${data.duration_days} days
Storefront slug: ${sf?.slug ?? "â€”"}
Brief: ${data.brief || "(none)"}`;
      const parsed = await callAdsAI([{ role: "system", content: sys }, { role: "user", content: user }], tool, "write_ad");
      return { ok: true, copy: parsed };
    } catch (err) {
      await refundCredits(ws_id, "meta_ad", { business_id: data.business_id });
      throw err;
    }
  });

export const createMetaCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    business_id: z.string().uuid(),
    name: z.string().min(2).max(200),
    goal: z.enum(AD_GOALS),
    daily_budget: z.number().positive(),
    total_budget: z.number().positive().nullable().optional(),
    start_date: z.string(), end_date: z.string(),
    audience: z.object({ kind: z.enum(AUDIENCE_KINDS), notes: z.string().max(500).optional().default("") }),
    copy: z.record(z.string(), z.any()),
    media_asset_id: z.string().uuid().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const ws_id = await loadWs(context.supabase, data.business_id);
    const isDemo = (process.env.META_MODE ?? "demo") === "demo";

    const { data: camp, error: cErr } = await context.supabase.from("meta_campaigns").insert({
      business_id: data.business_id,
      name: data.name,
      objective: data.goal,
      goal: data.goal,
      budget: data.daily_budget,
      daily_budget: data.daily_budget,
      total_budget: data.total_budget ?? null,
      start_date: data.start_date,
      end_date: data.end_date,
      status: "draft",
      audience_json: data.audience as any,
      external_campaign_id: isDemo ? `demo_camp_${Math.random().toString(36).slice(2, 8)}` : null,
    }).select("id").single();
    if (cErr || !camp) throw new Error(cErr?.message || "Failed to create campaign");

    const { data: ad, error: aErr } = await context.supabase.from("meta_ads").insert({
      business_id: data.business_id,
      campaign_id: (camp as any).id,
      headline: (data.copy.headline as string | undefined) ?? "",
      primary_text: (data.copy.primary_text as string | undefined) ?? "",
      cta: (data.copy.cta as string | undefined) ?? "Learn more",
      media_asset_id: data.media_asset_id ?? null,
      copy_json: data.copy as any,
      status: "draft",
      approval_status: "pending",
      external_ad_id: isDemo ? `demo_ad_${Math.random().toString(36).slice(2, 8)}` : null,
    }).select("id").single();
    if (aErr) throw new Error(aErr.message);

    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: ws_id, business_id: data.business_id, user_id: context.userId,
      action: "create_meta_campaign", entity: "meta_campaign", entity_id: (camp as any).id,
      metadata_json: { goal: data.goal, daily_budget: data.daily_budget, mode: isDemo ? "demo" : "live" } as never,
    });

    return { ok: true, campaign_id: (camp as any).id, ad_id: (ad as any).id };
  });

export const listMetaCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ business_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [{ data: camps, error: e1 }, { data: ads, error: e2 }] = await Promise.all([
      context.supabase.from("meta_campaigns")
        .select("id, name, objective, goal, budget, daily_budget, total_budget, start_date, end_date, status, insights_json, external_campaign_id, audience_json, created_at")
        .eq("business_id", data.business_id).order("created_at", { ascending: false }),
      context.supabase.from("meta_ads")
        .select("id, campaign_id, headline, primary_text, cta, status, approval_status, copy_json, media_asset_id, insights_json, external_ad_id, paused_at, created_at")
        .eq("business_id", data.business_id).order("created_at", { ascending: false }),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return { campaigns: camps ?? [], ads: ads ?? [] };
  });

export const pauseMetaCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ campaign_id: z.string().uuid(), pause: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: camp } = await context.supabase.from("meta_campaigns").select("id, business_id").eq("id", data.campaign_id).maybeSingle();
    if (!camp) throw new Error("Campaign not found");
    const ws_id = await loadWs(context.supabase, (camp as any).business_id);
    const { error } = await context.supabase.from("meta_campaigns").update({
      status: data.pause ? "paused" : "active",
    } as any).eq("id", data.campaign_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: ws_id, business_id: (camp as any).business_id, user_id: context.userId,
      action: data.pause ? "pause_meta_campaign" : "resume_meta_campaign",
      entity: "meta_campaign", entity_id: data.campaign_id, metadata_json: {} as never,
    });
    return { ok: true };
  });

export const updateMetaBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    campaign_id: z.string().uuid(),
    daily_budget: z.number().positive().max(10000),
    confirmed: z.literal(true),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: camp } = await context.supabase.from("meta_campaigns").select("id, business_id, daily_budget").eq("id", data.campaign_id).maybeSingle();
    if (!camp) throw new Error("Campaign not found");
    const ws_id = await loadWs(context.supabase, (camp as any).business_id);
    const { error } = await context.supabase.from("meta_campaigns").update({
      daily_budget: data.daily_budget, budget: data.daily_budget,
    } as any).eq("id", data.campaign_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: ws_id, business_id: (camp as any).business_id, user_id: context.userId,
      action: "update_meta_budget", entity: "meta_campaign", entity_id: data.campaign_id,
      metadata_json: { from: (camp as any).daily_budget, to: data.daily_budget } as never,
    });
    return { ok: true };
  });

export const regenerateAdCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    ad_id: z.string().uuid(),
    brief: z.string().max(500).optional().default(""),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: ad } = await context.supabase.from("meta_ads").select("id, business_id, copy_json, campaign_id").eq("id", data.ad_id).maybeSingle();
    if (!ad) throw new Error("Ad not found");
    const ws_id = await loadWs(context.supabase, (ad as any).business_id);
    await requireEntitlement(ws_id, "meta_ads");
    await consumeCredits(ws_id, "meta_ad_creative", { ad_id: data.ad_id });
    try {
      const { biz, brand, offer } = await loadCtx(context.supabase, (ad as any).business_id);
      const tool = { type: "function" as const, function: { name: "write_ad", description: "Rewrite Meta ad copy.", parameters: AdCopySchema as any } };
      const sys = `You are Wazeer. Rewrite Meta ad copy. Reply via tool. ${SAFETY}`;
      const user = `Brand: ${brand?.brand_name ?? biz?.name} | Tone: ${brand?.tone ?? "warm"}
Existing: ${JSON.stringify((ad as any).copy_json)}
Offer: ${offer?.name ?? "â€”"} â€” ${offer?.description ?? ""}
Brief: ${data.brief || "(none)"}`;
      const parsed = await callAdsAI([{ role: "system", content: sys }, { role: "user", content: user }], tool, "write_ad");
      const { error } = await context.supabase.from("meta_ads").update({
        headline: parsed.headline, primary_text: parsed.primary_text, cta: parsed.cta,
        copy_json: parsed as any, approval_status: "pending",
      } as any).eq("id", data.ad_id);
      if (error) throw new Error(error.message);
      return { ok: true, copy: parsed };
    } catch (err) {
      await refundCredits(ws_id, "meta_ad_creative", { ad_id: data.ad_id });
      throw err;
    }
  });

export const fetchMetaInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ business_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Mock insights synthesised per-campaign.
    const { data: camps } = await context.supabase.from("meta_campaigns").select("id, name, daily_budget").eq("business_id", data.business_id);
    const result = (camps ?? []).map((c: any) => ({
      campaign_id: c.id, name: c.name,
      impressions: Math.floor(800 + Math.random() * 5000),
      clicks: Math.floor(20 + Math.random() * 200),
      spend: +(Math.random() * (c.daily_budget ?? 10)).toFixed(2),
      cpc: +(0.4 + Math.random() * 1.2).toFixed(2),
      ctr: +(0.5 + Math.random() * 3).toFixed(2),
    }));
    return { insights: result, mode: (process.env.META_MODE ?? "demo") };
  });

export const duplicateMetaAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ad_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: ad } = await context.supabase.from("meta_ads").select("*").eq("id", data.ad_id).maybeSingle();
    if (!ad) throw new Error("Ad not found");
    const { id, created_at, updated_at, external_ad_id, ...rest } = ad as any;
    const { data: row, error } = await context.supabase.from("meta_ads").insert({
      ...rest, status: "draft", approval_status: "pending",
    } as any).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, ad_id: (row as any).id };
  });
