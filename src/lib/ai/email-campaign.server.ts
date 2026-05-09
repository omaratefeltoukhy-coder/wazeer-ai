import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withBillingGuard } from "@/lib/server/billing";
import { callAITool } from "@/lib/ai/gateway";
import { loadBrandContext } from "@/lib/server/context";

export const CAMPAIGN_TYPES = [
  "welcome", "abandoned_cart", "launch", "lead_nurture", "offer_announcement",
  "trial_conversion", "renewal", "win_back", "re_engagement", "event_reminder", "customer_onboarding",
] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_LABEL: Record<CampaignType, string> = {
  welcome: "Welcome",
  abandoned_cart: "Abandoned Cart",
  launch: "Launch",
  lead_nurture: "Lead Nurture",
  offer_announcement: "Offer Announcement",
  trial_conversion: "Trial Conversion",
  renewal: "Renewal",
  win_back: "Win-back",
  re_engagement: "Re-engagement",
  event_reminder: "Event Reminder",
  customer_onboarding: "Customer Onboarding",
};

export const SAFETY_RAILS = `Hard rules:
- No fake testimonials, names, or quotes.
- No medical, financial, or legal claims.
- Use the brand's actual voice; no exaggerated guarantees.
- Use {{first_name}} style placeholders for personalization.
- CTA URLs are placeholders like {{cta_url}}.`;

export const SequenceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["campaign_name", "goal", "segment", "emails"],
  properties: {
    campaign_name: { type: "string" },
    goal: { type: "string" },
    segment: { type: "string" },
    emails: {
      type: "array", minItems: 1, maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name","goal","subject_line","preview_text","body_markdown","cta_text","cta_url_placeholder","send_delay","success_metric","personalization_fields"],
        properties: {
          name: { type: "string" },
          goal: { type: "string" },
          subject_line: { type: "string" },
          preview_text: { type: "string" },
          body_markdown: { type: "string" },
          cta_text: { type: "string" },
          cta_url_placeholder: { type: "string" },
          send_delay: { type: "string" },
          success_metric: { type: "string" },
          personalization_fields: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export const SingleEmailSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name","goal","subject_line","preview_text","body_markdown","cta_text","cta_url_placeholder","send_delay","success_metric","personalization_fields"],
  properties: SequenceSchema.properties.emails.items.properties,
} as const;

export const generateEmailCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    business_id: z.string().uuid(),
    type: z.enum(CAMPAIGN_TYPES),
    tone: z.string().max(80).optional().default("warm, helpful"),
    length: z.union([z.literal(3), z.literal(5), z.literal(7)]),
    audience_note: z.string().max(500).optional().default(""),
  }).parse(input))
  .handler(async ({ data, context }) => {
    return withBillingGuard(
      context.supabase,
      data.business_id,
      { feature: "email_campaigns", creditAction: "email_campaign", metadata: { business_id: data.business_id, type: data.type } },
      async () => {
        const { biz, brand, offer } = await loadBrandContext(context.supabase, data.business_id);
        const tool = {
          type: "function" as const,
          function: { name: "write_sequence", description: "Write an email sequence.", parameters: SequenceSchema as any },
        };
        const sys = `You are Wazeer, an expert lifecycle marketer.
Write a ${data.length}-email ${CAMPAIGN_LABEL[data.type]} sequence in a ${data.tone} tone.
Use realistic send_delay values like "immediate", "1d", "3d", "5d", "7d".
Reply ONLY through the provided tool.
${SAFETY_RAILS}`;
        const user = `Brand: ${brand?.brand_name ?? biz?.name}
Tone: ${brand?.tone ?? data.tone}
Positioning: ${brand?.positioning ?? ""}
Business: ${biz?.name} (${biz?.type}) — ${biz?.description ?? ""}
Audience: ${biz?.target_audience ?? ""} ${data.audience_note ? `| Note: ${data.audience_note}` : ""}
Pain point: ${biz?.pain_point ?? ""}
Desired result: ${biz?.desired_result ?? ""}
Offer: ${offer?.name ?? "—"} — ${offer?.description ?? ""} (${offer?.price ?? ""} ${offer?.currency ?? ""})
Trial days: ${offer?.free_trial_days ?? 0}
Campaign type: ${CAMPAIGN_LABEL[data.type]}
Length: ${data.length} emails`;

        const parsed = await callAITool(
          [{ role: "system", content: sys }, { role: "user", content: user }],
          tool, "write_sequence",
        );

        const { data: campaignRow, error: cErr } = await context.supabase.from("email_campaigns").insert({
          business_id: data.business_id,
          name: parsed.campaign_name,
          type: data.type,
          status: "draft",
          content_json: { goal: parsed.goal, segment: parsed.segment, type: data.type, tone: data.tone, length: data.length } as any,
        }).select("id").single();
        if (cErr || !campaignRow) throw new Error(cErr?.message || "Failed to save campaign");

        const rows = (parsed.emails as any[]).map((e, i) => ({
          business_id: data.business_id,
          campaign_id: campaignRow.id,
          position: i,
          name: e.name,
          goal: e.goal,
          subject_line: e.subject_line,
          preview_text: e.preview_text,
          body_markdown: e.body_markdown,
          cta_text: e.cta_text,
          cta_url_placeholder: e.cta_url_placeholder,
          send_delay: e.send_delay,
          success_metric: e.success_metric,
          personalization_fields: e.personalization_fields ?? [],
          status: "draft",
        }));
        const { error: msgErr } = await context.supabase.from("email_messages").insert(rows);
        if (msgErr) throw new Error(msgErr.message);

        return { campaign_id: campaignRow.id, name: parsed.campaign_name, count: rows.length };
      },
    );
  });

export const regenerateEmailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    message_id: z.string().uuid(),
    brief: z.string().max(500).optional().default(""),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: msg, error } = await context.supabase.from("email_messages")
      .select("id, business_id, campaign_id, name, goal, subject_line, preview_text, body_markdown, cta_text, cta_url_placeholder, send_delay, success_metric, personalization_fields")
      .eq("id", data.message_id).maybeSingle();
    if (error || !msg) throw new Error("Email not found");

    return withBillingGuard(
      context.supabase,
      msg.business_id as string,
      { feature: "email_campaigns", creditAction: "email_regenerate", metadata: { message_id: msg.id } },
      async () => {
        const { biz, brand, offer } = await loadBrandContext(context.supabase, msg.business_id as string);
        const tool = { type: "function" as const, function: { name: "rewrite_email", description: "Rewrite a single email.", parameters: SingleEmailSchema as any } };
        const sys = `You are Wazeer. Rewrite ONE email keeping its goal & send_delay. Reply via tool. ${SAFETY_RAILS}`;
        const user = `Brand: ${brand?.brand_name ?? biz?.name} | Tone: ${brand?.tone ?? "warm"}
Offer: ${offer?.name ?? "—"} — ${offer?.description ?? ""}
Existing email: ${JSON.stringify(msg)}
Brief: ${data.brief || "(none)"}`;
        const parsed = await callAITool([{ role: "system", content: sys }, { role: "user", content: user }], tool, "rewrite_email");
        const { error: upErr } = await context.supabase.from("email_messages").update({
          name: parsed.name, goal: parsed.goal,
          subject_line: parsed.subject_line, preview_text: parsed.preview_text,
          body_markdown: parsed.body_markdown, cta_text: parsed.cta_text,
          cta_url_placeholder: parsed.cta_url_placeholder, send_delay: parsed.send_delay,
          success_metric: parsed.success_metric, personalization_fields: parsed.personalization_fields ?? [],
        }).eq("id", msg.id);
        if (upErr) throw new Error(upErr.message);
        return { ok: true, email: parsed };
      },
    );
  });
