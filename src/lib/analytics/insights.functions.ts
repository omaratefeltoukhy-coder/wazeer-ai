import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { consumeCredits, requireEntitlement } from "@/lib/billing/guard.server";

async function assertAccess(supabase: any, businessId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, workspace_id, name")
    .eq("id", businessId)
    .maybeSingle();
  if (error || !data) throw new Error("Business not found or access denied");
  return data as { id: string; workspace_id: string; name: string };
}

export type AnalyticsRollup = {
  business: { id: string; name: string };
  period: { start: string; end: string };
  storefront: { status: string; views: number; orders: number; revenue: number; conversion_rate: number };
  email: { campaigns: number; sent: number; delivered: number; opens: number; clicks: number; unsubs: number; open_rate: number; click_rate: number };
  meta: { posts_published: number; posts_drafts: number; campaigns_active: number; ad_spend: number; impressions: number; clicks: number; ctr: number };
  ugc: { scripts: number; videos_ready: number; videos_rendering: number };
  contacts: { total: number; new_this_period: number; unsubscribed: number };
  credits: { spent_this_period: number; top_actions: { reason: string; total: number }[] };
};

export const getAnalyticsRollup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ business_id: z.string().uuid(), days: z.number().int().min(1).max(365).default(30) }).parse(input))
  .handler(async ({ data, context }) => {
    const biz = await assertAccess(context.supabase, data.business_id);
    const end = new Date();
    const start = new Date(Date.now() - data.days * 86400000);
    const startIso = start.toISOString();

    const [
      storefront, orders, emailCampaigns, emailEvents, posts, campaigns, ads,
      scripts, videos, contacts, creditTx,
    ] = await Promise.all([
      supabaseAdmin.from("storefronts").select("status, content_json").eq("business_id", biz.id).maybeSingle(),
      supabaseAdmin.from("orders").select("amount, payment_status, created_at").eq("business_id", biz.id).gte("created_at", startIso),
      supabaseAdmin.from("email_campaigns").select("id, status").eq("business_id", biz.id),
      supabaseAdmin.from("email_events").select("event_type, created_at").eq("business_id", biz.id).gte("created_at", startIso),
      supabaseAdmin.from("meta_posts").select("status, created_at").eq("business_id", biz.id),
      supabaseAdmin.from("meta_campaigns").select("status, insights_json").eq("business_id", biz.id),
      supabaseAdmin.from("meta_ads").select("status, insights_json").eq("business_id", biz.id),
      supabaseAdmin.from("ugc_scripts").select("id").eq("business_id", biz.id),
      supabaseAdmin.from("ugc_videos").select("status").eq("business_id", biz.id),
      supabaseAdmin.from("contacts").select("status, created_at, unsubscribed_at").eq("business_id", biz.id),
      supabaseAdmin.from("credit_transactions").select("amount, reason, created_at, metadata_json").eq("workspace_id", biz.workspace_id).gte("created_at", startIso),
    ]);

    const sfViews = (storefront.data?.content_json as any)?.analytics?.views ?? 0;
    const paidOrders = (orders.data ?? []).filter((o) => o.payment_status === "paid");
    const revenue = paidOrders.reduce((s, o) => s + Number(o.amount ?? 0), 0);
    const orderCount = paidOrders.length;
    const conv = sfViews > 0 ? (orderCount / sfViews) * 100 : 0;

    const ev = emailEvents.data ?? [];
    const count = (t: string) => ev.filter((e) => e.event_type === t).length;
    const sent = count("sent"), delivered = count("delivered"), opens = count("opened"), clicks = count("clicked"), unsubs = count("unsubscribed");

    const adSpend = (ads.data ?? []).reduce((s, a) => s + Number((a.insights_json as any)?.spend ?? 0), 0);
    const adImps = (ads.data ?? []).reduce((s, a) => s + Number((a.insights_json as any)?.impressions ?? 0), 0);
    const adClicks = (ads.data ?? []).reduce((s, a) => s + Number((a.insights_json as any)?.clicks ?? 0), 0);

    const txAgg: Record<string, number> = {};
    let spent = 0;
    for (const t of creditTx.data ?? []) {
      if ((t.amount ?? 0) < 0) {
        const amt = Math.abs(t.amount);
        spent += amt;
        const r = t.reason ?? "other";
        txAgg[r] = (txAgg[r] ?? 0) + amt;
      }
    }
    const topActions = Object.entries(txAgg).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, total]) => ({ reason, total }));

    const rollup: AnalyticsRollup = {
      business: { id: biz.id, name: biz.name },
      period: { start: start.toISOString(), end: end.toISOString() },
      storefront: { status: storefront.data?.status ?? "draft", views: sfViews, orders: orderCount, revenue, conversion_rate: Math.round(conv * 100) / 100 },
      email: {
        campaigns: (emailCampaigns.data ?? []).length,
        sent, delivered, opens, clicks, unsubs,
        open_rate: delivered > 0 ? Math.round((opens / delivered) * 1000) / 10 : 0,
        click_rate: delivered > 0 ? Math.round((clicks / delivered) * 1000) / 10 : 0,
      },
      meta: {
        posts_published: (posts.data ?? []).filter((p) => p.status === "posted").length,
        posts_drafts: (posts.data ?? []).filter((p) => p.status !== "posted").length,
        campaigns_active: (campaigns.data ?? []).filter((c) => c.status === "active").length,
        ad_spend: Math.round(adSpend * 100) / 100,
        impressions: adImps,
        clicks: adClicks,
        ctr: adImps > 0 ? Math.round((adClicks / adImps) * 1000) / 10 : 0,
      },
      ugc: {
        scripts: (scripts.data ?? []).length,
        videos_ready: (videos.data ?? []).filter((v) => v.status === "ready").length,
        videos_rendering: (videos.data ?? []).filter((v) => v.status !== "ready" && v.status !== "failed" && v.status !== "draft").length,
      },
      contacts: {
        total: (contacts.data ?? []).filter((c) => c.status !== "suppressed").length,
        new_this_period: (contacts.data ?? []).filter((c) => c.created_at && new Date(c.created_at) >= start).length,
        unsubscribed: (contacts.data ?? []).filter((c) => !!c.unsubscribed_at).length,
      },
      credits: { spent_this_period: spent, top_actions: topActions },
    };
    return rollup;
  });

export const listRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ business_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, data.business_id);
    const { data: rows } = await supabaseAdmin
      .from("ai_recommendations")
      .select("*")
      .eq("business_id", data.business_id)
      .order("created_at", { ascending: false })
      .limit(20);
    return rows ?? [];
  });

export const updateRecommendationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    business_id: z.string().uuid(),
    id: z.string().uuid(),
    status: z.enum(["open", "done", "dismissed"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, data.business_id);
    const { error } = await supabaseAdmin
      .from("ai_recommendations")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("business_id", data.business_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const RECO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recommendations"],
  properties: {
    recommendations: {
      type: "array", minItems: 3, maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "category", "priority", "problem", "recommendation", "confidence_score", "action"],
        properties: {
          title: { type: "string" },
          category: { type: "string", enum: ["storefront", "email", "meta_posts", "meta_ads", "ugc", "contacts", "billing", "other"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          problem: { type: "string" },
          recommendation: { type: "string" },
          confidence_score: { type: "number", minimum: 0, maximum: 1 },
          action: {
            type: "object",
            additionalProperties: false,
            required: ["label", "route"],
            properties: {
              label: { type: "string" },
              route: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ business_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const biz = await assertAccess(context.supabase, data.business_id);
    await requireEntitlement(biz.workspace_id, "recommendations");
    await consumeCredits(biz.workspace_id, "analytics_refresh", { business_id: biz.id });

    try {
      // Build rollup inline to avoid double auth
      const rollup = await getAnalyticsRollup({ data: { business_id: biz.id, days: 30 } });
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("AI service unavailable");

      const sys = `You are a senior growth strategist. Given KPI rollups for a small business, suggest 3-6 highly specific, actionable next steps. Never invent metrics. Avoid generic advice. Each action must map to one of these app routes: /dashboard/storefront/${biz.id}, /dashboard/emails/${biz.id}, /dashboard/posts/${biz.id}, /dashboard/ads/${biz.id}, /dashboard/ugc/${biz.id}, /dashboard/images/${biz.id}, /dashboard/billing.`;
      const user = `Business: ${biz.name}\nKPIs (last 30d):\n${JSON.stringify(rollup, null, 2)}`;

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          response_format: { type: "json_schema", json_schema: { name: "Recos", strict: true, schema: RECO_SCHEMA } },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`AI gateway error ${res.status}: ${txt.slice(0, 200)}`);
      }
      const json = await res.json();
      const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
      const recs: any[] = parsed.recommendations ?? [];

      // Replace open recos with new batch
      await supabaseAdmin.from("ai_recommendations").delete().eq("business_id", biz.id).eq("status", "open");
      if (recs.length) {
        await supabaseAdmin.from("ai_recommendations").insert(
          recs.map((r) => ({
            business_id: biz.id,
            title: r.title,
            category: r.category,
            priority: r.priority,
            problem: r.problem,
            recommendation: r.recommendation,
            confidence_score: r.confidence_score,
            action_json: r.action,
            status: "open",
          })) as never,
        );
      }

      await supabaseAdmin.from("audit_logs").insert({
        workspace_id: biz.workspace_id,
        business_id: biz.id,
        user_id: context.userId,
        entity: "ai_recommendations",
        action: "generate_recommendations",
        metadata_json: { count: recs.length } as never,
      });

      return { count: recs.length };
    } catch (e) {
      // refund the credit on failure
      const { refundCredits } = await import("@/lib/billing/guard.server");
      await refundCredits(biz.workspace_id, "analytics_refresh", { reason: "generation_failed" });
      throw e;
    }
  });
