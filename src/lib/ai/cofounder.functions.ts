import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { consumeCredits, requireEntitlement } from "@/lib/billing/guard.server";
import { callAI } from "@/lib/ai/gateway";

const ChatSchema = z.object({
  business_id: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional().default([]),
});

type ChatInput = z.infer<typeof ChatSchema>;

async function loadBusinessContext(supabase: any, workspace_id: string, business_id?: string) {
  let bizId = business_id;
  if (!bizId) {
    const { data } = await supabase
      .from("businesses")
      .select("id")
      .eq("workspace_id", workspace_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) bizId = data.id;
  }

  if (!bizId) return null;

  const [{ data: biz }, { data: brand }, { data: offer }, { data: storefront }, { data: counts }] = await Promise.all([
    supabase.from("businesses").select("name, type, description, status, target_audience, desired_result, pain_point, country, language, currency").eq("id", bizId).maybeSingle(),
    supabase.from("brand_profiles").select("brand_name, tone, positioning, benefits_json, pain_points_json").eq("business_id", bizId).maybeSingle(),
    supabase.from("offers").select("name, price, currency, billing_interval").eq("business_id", bizId).maybeSingle(),
    supabase.from("storefronts").select("status, slug").eq("business_id", bizId).maybeSingle(),
    supabase.from("performance_snapshots").select("visits, orders, revenue, email_sent, email_opened, meta_posts, meta_ad_spend").eq("business_id", bizId).order("period_start", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return { biz, brand, offer, storefront, counts };
}

async function callCofounderAI(messages: any[]) {
  try {
    const aiRes = await callAI({ messages });
    if (!aiRes.content) throw new Error("AI returned empty response");
    return { content: aiRes.content, mock: false };
  } catch (err) {
    // If no provider configured, return demo response
    if (err instanceof Error && err.message.includes("No AI provider configured")) {
      return {
        content: "I'm your AI Cofounder — here to help you grow! (Demo mode: connect an AI provider in settings for full responses.)",
        mock: true,
      };
    }
    throw err;
  }
}

export const cofounderChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: ChatInput) => ChatSchema.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const supabase = supabaseAdmin();

    // Look up workspace from user
    const { data: m } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!m) throw new Error("No workspace found");
    const workspace_id = m.workspace_id;

    // Require 1 credit per message
    await requireEntitlement(workspace_id, "ai_chat");
    await consumeCredits(workspace_id, "ai_chat", { user_id: userId });

    const ctx = await loadBusinessContext(supabase, workspace_id, data.business_id);

    const systemPrompt = `You are Wazeer, an AI Cofounder and business growth strategist. You help solopreneurs and creators launch, grow, and monetize their businesses.

Your personality:
- Encouraging but direct — you celebrate wins and call out what's not working
- Strategic — you always think about the next step that moves the business forward
- Practical — you give actionable advice, not generic platitudes
- Concise — keep responses under 150 words unless deep analysis is requested

Current business context:
${ctx?.biz ? `- Business: ${ctx.biz.name} (${ctx.biz.type})` : "- No business created yet"}
${ctx?.biz?.status ? `- Status: ${ctx.biz.status}` : ""}
${ctx?.brand ? `- Brand voice: ${ctx.brand.tone}` : ""}
${ctx?.offer ? `- Offer: ${ctx.offer.name} at ${ctx.offer.currency} ${ctx.offer.price}` : ""}
${ctx?.storefront ? `- Storefront: ${ctx.storefront.status === "published" ? "LIVE" : "Draft"} (${ctx.storefront.slug ? `/s/${ctx.storefront.slug}` : "no slug"})` : ""}
${ctx?.counts ? `- This month: ${ctx.counts.visits ?? 0} visits, ${ctx.counts.orders ?? 0} orders, ${ctx.counts.revenue ?? 0} revenue` : ""}

Your job:
1. Answer business questions
2. Suggest growth tactics based on their current stage
3. Help them overcome obstacles
4. Celebrate milestones
5. If they haven't published their storefront yet, nudge them gently
6. If they have no customers yet, suggest Meta ads or email outreach

Never be generic. Always tie advice to their specific business context.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...data.history.slice(-6),
      { role: "user", content: data.message },
    ];

    const result = await callCofounderAI(messages);
    return { reply: result.content, mock: result.mock };
  });
