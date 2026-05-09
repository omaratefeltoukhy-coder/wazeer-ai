import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { consumeCredits, refundCredits, requireEntitlement, checkUsageCap, incrementUsage } from "@/lib/billing/guard.server";
import { callAI } from "@/lib/ai/gateway";
import {
  sendEmailViaResend,
  sendEmailBatchViaResend,
  mdToHtml,
  personalizeEmail,
  getOrCreateUnsubscribeToken,
  buildUnsubscribeUrl,
  wrapEmailBody,
  trackEmailEvent,
} from "@/lib/email/resend.server";

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

const SAFETY_RAILS = `Hard rules:
- No fake testimonials, names, or quotes.
- No medical, financial, or legal claims.
- Use the brand's actual voice; no exaggerated guarantees.
- Use {{first_name}} style placeholders for personalization.
- CTA URLs are placeholders like {{cta_url}}.`;

const SequenceSchema = {
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

const SingleEmailSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name","goal","subject_line","preview_text","body_markdown","cta_text","cta_url_placeholder","send_delay","success_metric","personalization_fields"],
  properties: SequenceSchema.properties.emails.items.properties,
} as const;

async function callEmailAI(messages: any[], tool: any, toolName: string) {
  const aiRes = await callAI({
    messages,
    tools: [tool as any],
    toolChoice: { type: "function", function: { name: toolName } },
  });
  const args = aiRes.toolCalls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured output");
  return typeof args === "string" ? JSON.parse(args) : args;
}

async function loadWorkspaceId(supabase: any, business_id: string): Promise<string> {
  const { data, error } = await supabase.from("businesses").select("workspace_id").eq("id", business_id).maybeSingle();
  if (error || !data) throw new Error(error?.message || "Business not found");
  return data.workspace_id as string;
}

async function loadContext(supabase: any, business_id: string) {
  const [{ data: biz }, { data: brand }, { data: offer }] = await Promise.all([
    supabase.from("businesses").select("name, type, description, target_audience, desired_result, pain_point, currency").eq("id", business_id).maybeSingle(),
    supabase.from("brand_profiles").select("brand_name, tone, positioning, audience_json, benefits_json, pain_points_json, objections_json").eq("business_id", business_id).maybeSingle(),
    supabase.from("offers").select("name, description, price, currency, billing_interval, free_trial_days").eq("business_id", business_id).maybeSingle(),
  ]);
  return { biz, brand, offer };
}

async function audit(supabase: any, business_id: string, action: string, entity: string, entity_id: string | null, metadata: Record<string, unknown> = {}) {
  const ws_id = await loadWorkspaceId(supabase, business_id);
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("audit_logs").insert({
    workspace_id: ws_id, business_id, user_id: user?.id ?? null,
    action, entity, entity_id, metadata_json: metadata as any,
  });
}

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
    const ws_id = await loadWorkspaceId(context.supabase, data.business_id);
    await requireEntitlement(ws_id, "email_campaigns");
    await checkUsageCap(ws_id, "email_campaigns");
    await consumeCredits(ws_id, "email_campaign", { business_id: data.business_id, type: data.type });

    try {
      const { biz, brand, offer } = await loadContext(context.supabase, data.business_id);
      const tool = {
        type: "function" as const,
        function: { name: "write_sequence", description: "Write an email sequence.", parameters: SequenceSchema as any },
      };
      const sys = `You are Wazeer AI, an expert lifecycle marketer.
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

      const parsed = await callEmailAI(
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

      await incrementUsage(ws_id, "email_campaigns", 1);
      return { campaign_id: campaignRow.id, name: parsed.campaign_name, count: rows.length };
    } catch (err) {
      await refundCredits(ws_id, "email_campaign", { business_id: data.business_id });
      throw err;
    }
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
    const ws_id = await loadWorkspaceId(context.supabase, msg.business_id as string);
    await requireEntitlement(ws_id, "email_campaigns");
    await consumeCredits(ws_id, "email_regenerate", { message_id: msg.id });
    try {
      const { biz, brand, offer } = await loadContext(context.supabase, msg.business_id as string);
      const tool = { type: "function" as const, function: { name: "rewrite_email", description: "Rewrite a single email.", parameters: SingleEmailSchema as any } };
      const sys = `You are Wazeer AI. Rewrite ONE email keeping its goal & send_delay. Reply via tool. ${SAFETY_RAILS}`;
      const user = `Brand: ${brand?.brand_name ?? biz?.name} | Tone: ${brand?.tone ?? "warm"}
Offer: ${offer?.name ?? "—"} — ${offer?.description ?? ""}
Existing email: ${JSON.stringify(msg)}
Brief: ${data.brief || "(none)"}`;
      const parsed = await callEmailAI([{ role: "system", content: sys }, { role: "user", content: user }], tool, "rewrite_email");
      const { error: upErr } = await context.supabase.from("email_messages").update({
        name: parsed.name, goal: parsed.goal,
        subject_line: parsed.subject_line, preview_text: parsed.preview_text,
        body_markdown: parsed.body_markdown, cta_text: parsed.cta_text,
        cta_url_placeholder: parsed.cta_url_placeholder, send_delay: parsed.send_delay,
        success_metric: parsed.success_metric, personalization_fields: parsed.personalization_fields ?? [],
      }).eq("id", msg.id);
      if (upErr) throw new Error(upErr.message);
      return { ok: true, email: parsed };
    } catch (err) {
      await refundCredits(ws_id, "email_regenerate", { message_id: msg.id });
      throw err;
    }
  });

export const updateEmailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    message_id: z.string().uuid(),
    patch: z.object({
      name: z.string().max(160).optional(),
      goal: z.string().max(400).optional(),
      subject_line: z.string().max(200).optional(),
      preview_text: z.string().max(200).optional(),
      body_markdown: z.string().max(20000).optional(),
      cta_text: z.string().max(120).optional(),
      cta_url_placeholder: z.string().max(500).optional(),
      send_delay: z.string().max(40).optional(),
      success_metric: z.string().max(200).optional(),
      status: z.string().max(40).optional(),
      scheduled_at: z.string().datetime().nullable().optional(),
    }),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("email_messages").update(data.patch as any).eq("id", data.message_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateEmailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ message_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: src, error } = await context.supabase.from("email_messages").select("*").eq("id", data.message_id).maybeSingle();
    if (error || !src) throw new Error("Email not found");
    const { id, created_at, updated_at, sent_at, ...rest } = src as any;
    const { data: ins, error: insErr } = await context.supabase.from("email_messages").insert({
      ...rest, name: `${rest.name} (copy)`, status: "draft", scheduled_at: null, position: (rest.position ?? 0) + 1,
    }).select("id").single();
    if (insErr) throw new Error(insErr.message);
    return { id: ins.id };
  });

export const archiveEmailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ message_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("email_messages").update({ status: "archived" }).eq("id", data.message_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    message_id: z.string().uuid(),
    to_email: z.string().email(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: msg, error } = await context.supabase.from("email_messages")
      .select("id, business_id, campaign_id, subject_line, body_markdown, preview_text, cta_text, cta_url_placeholder")
      .eq("id", data.message_id).maybeSingle();
    if (error || !msg) throw new Error("Email not found");

    // Suppression check
    const { data: sup } = await supabaseAdmin.from("suppression_list")
      .select("id").eq("business_id", msg.business_id as string).eq("email", data.to_email).maybeSingle();
    if (sup) throw new Error("This email is on the suppression list and cannot receive sends.");

    const bodyMarkdown = (msg.body_markdown as string) || "";
    const bodyHtml = mdToHtml(bodyMarkdown);
    const html = wrapEmailBody(bodyHtml, { previewText: (msg.preview_text as string) || undefined });

    const result = await sendEmailViaResend({
      from: process.env.MARKETING_FROM_EMAIL || "Marketing <onboarding@resend.dev>",
      to: data.to_email,
      subject: (msg.subject_line as string) || "Test email",
      html,
      tags: [
        { name: "business_id", value: msg.business_id as string },
        { name: "campaign_id", value: (msg.campaign_id as string) || "" },
        { name: "message_id", value: msg.id as string },
        { name: "type", value: "test" },
      ],
    });

    if (!result.ok) {
      throw new Error(result.error || "Resend send failed");
    }

    await trackEmailEvent({
      business_id: msg.business_id as string,
      campaign_id: msg.campaign_id as string | null,
      message_id: msg.id as string,
      event_type: "sent",
      resend_id: result.resendId,
      email: data.to_email,
      metadata: { test: true, subject: msg.subject_line },
    });

    return { ok: true, queued: true, resend_id: result.resendId };
  });

export const sendEmailCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ campaign_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: campaign, error } = await context.supabase.from("email_campaigns")
      .select("id, business_id, name").eq("id", data.campaign_id).maybeSingle();
    if (error || !campaign) throw new Error("Campaign not found");

    const business_id = campaign.business_id as string;
    const { data: contactsRaw } = await context.supabase.from("contacts")
      .select("id, email, name, unsubscribed_at, status").eq("business_id", business_id);
    const { data: supList } = await context.supabase.from("suppression_list")
      .select("email").eq("business_id", business_id);
    const supSet = new Set((supList ?? []).map((s) => s.email));
    const contacts = (contactsRaw ?? []).filter((c) => c.email && !c.unsubscribed_at && c.status !== "unsubscribed" && !supSet.has(c.email));

    const { data: messages } = await context.supabase.from("email_messages")
      .select("id, subject_line, body_markdown, preview_text, cta_text, cta_url_placeholder")
      .eq("campaign_id", campaign.id).neq("status", "archived").order("position");

    if (!contacts.length) throw new Error("No eligible contacts found.");
    if (!messages?.length) throw new Error("No messages to send.");

    const from = process.env.MARKETING_FROM_EMAIL || "Marketing <onboarding@resend.dev>";
    let totalSent = 0;
    let totalFailed = 0;

    for (const msg of messages) {
      const bodyMarkdown = (msg.body_markdown as string) || "";
      const bodyHtml = mdToHtml(bodyMarkdown);

      const emails: any[] = [];
      for (const c of contacts) {
        const token = await getOrCreateUnsubscribeToken(business_id, c.id, c.email as string);
        const unsubscribeUrl = buildUnsubscribeUrl(token);
        const personalized = personalizeEmail(bodyHtml, { name: c.name, email: c.email });
        const html = wrapEmailBody(personalized, {
          previewText: (msg.preview_text as string) || undefined,
          unsubscribeUrl,
        });

        emails.push({
          from,
          to: c.email as string,
          subject: personalizeEmail((msg.subject_line as string) || "", { name: c.name, email: c.email }),
          html,
          tags: [
            { name: "business_id", value: business_id },
            { name: "campaign_id", value: campaign.id as string },
            { name: "message_id", value: msg.id as string },
            { name: "contact_id", value: c.id as string },
          ],
          metadata: { contact_id: c.id, message_id: msg.id, email: c.email },
        });
      }

      const batchResult = await sendEmailBatchViaResend(emails);
      for (let i = 0; i < batchResult.results.length; i++) {
        const r = batchResult.results[i];
        const meta = emails[i].metadata;
        if (r.resendId) {
          totalSent++;
          await trackEmailEvent({
            business_id,
            campaign_id: campaign.id as string,
            contact_id: meta.contact_id,
            message_id: meta.message_id,
            event_type: "sent",
            resend_id: r.resendId,
            email: meta.email,
          });
        } else {
          totalFailed++;
          await trackEmailEvent({
            business_id,
            campaign_id: campaign.id as string,
            contact_id: meta.contact_id,
            message_id: meta.message_id,
            event_type: "failed",
            email: meta.email,
            metadata: { error: r.error },
          });
        }
      }
    }

    await context.supabase.from("email_campaigns").update({ status: "sent" }).eq("id", campaign.id);
    await context.supabase.from("email_messages").update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("campaign_id", campaign.id).neq("status", "archived");
    await audit(context.supabase, business_id, "send_email_campaign", "email_campaign", campaign.id, { recipients: contacts.length, messages: messages.length, sent: totalSent, failed: totalFailed });
    return { ok: true, recipients: contacts.length, sent: totalSent, failed: totalFailed };
  });

export const scheduleEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    message_id: z.string().uuid(),
    scheduled_at: z.string().datetime(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("email_messages")
      .update({ scheduled_at: data.scheduled_at, status: "scheduled" }).eq("id", data.message_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ campaign_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: campaign }, { data: messages }] = await Promise.all([
      context.supabase.from("email_campaigns").select("*").eq("id", data.campaign_id).maybeSingle(),
      context.supabase.from("email_messages").select("*").eq("campaign_id", data.campaign_id).order("position"),
    ]);
    if (!campaign) throw new Error("Campaign not found");
    return { campaign, messages: messages ?? [] };
  });

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ business_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: campaigns } = await context.supabase.from("email_campaigns")
      .select("id, name, type, status, created_at, updated_at, content_json").eq("business_id", data.business_id).order("updated_at", { ascending: false });
    return { campaigns: campaigns ?? [] };
  });

export const getCampaignAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ campaign_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: events } = await context.supabase.from("email_events")
      .select("event_type, metadata_json, created_at").eq("campaign_id", data.campaign_id);
    const { data: messages } = await context.supabase.from("email_messages")
      .select("id, name, subject_line, cta_text").eq("campaign_id", data.campaign_id);
    const counts = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
    const perMsgOpens = new Map<string, number>();
    const perMsgClicks = new Map<string, number>();
    for (const e of events ?? []) {
      counts[e.event_type as keyof typeof counts] = (counts[e.event_type as keyof typeof counts] ?? 0) + 1;
      const mid = (e.metadata_json as any)?.message_id;
      if (mid && e.event_type === "opened") perMsgOpens.set(mid, (perMsgOpens.get(mid) ?? 0) + 1);
      if (mid && e.event_type === "clicked") perMsgClicks.set(mid, (perMsgClicks.get(mid) ?? 0) + 1);
    }
    const denom = counts.sent || 1;
    const rates = {
      open_rate: counts.opened / denom,
      click_rate: counts.clicked / denom,
      unsub_rate: counts.unsubscribed / denom,
      bounce_rate: counts.bounced / denom,
      conversion_rate: counts.clicked ? (counts.clicked * 0.04) / denom : 0,
    };
    let bestSubject = "—", bestCta = "—", bestOpens = -1, bestClicks = -1;
    for (const m of messages ?? []) {
      const o = perMsgOpens.get(m.id) ?? 0;
      if (o > bestOpens) { bestOpens = o; bestSubject = m.subject_line; }
      const c = perMsgClicks.get(m.id) ?? 0;
      if (c > bestClicks) { bestClicks = c; bestCta = m.cta_text ?? "—"; }
    }
    return { counts, rates, best_subject_line: bestSubject, best_cta: bestCta, revenue_attributed: 0 };
  });

export const generateUnsubscribeLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    business_id: z.string().uuid(),
    contact_id: z.string().uuid().optional(),
    email: z.string().email(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase.from("email_unsubscribe_tokens")
      .select("token").eq("business_id", data.business_id).eq("email", data.email).maybeSingle();
    if (existing?.token) return { token: existing.token, url: `/unsubscribe/${existing.token}` };
    const token = crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 10);
    const { error } = await context.supabase.from("email_unsubscribe_tokens").insert({
      business_id: data.business_id, contact_id: data.contact_id ?? null, email: data.email, token,
    });
    if (error) throw new Error(error.message);
    return { token, url: `/unsubscribe/${token}` };
  });

export const validateUnsubscribeToken = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().min(8) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin.from("email_unsubscribe_tokens")
      .select("id, business_id, email, used_at").eq("token", data.token).maybeSingle();
    if (!row) return { valid: false as const };
    return { valid: true as const, email: row.email, used: !!row.used_at };
  });

export const confirmUnsubscribe = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin.from("email_unsubscribe_tokens")
      .select("id, business_id, email, contact_id, used_at").eq("token", data.token).maybeSingle();
    if (!row) throw new Error("Invalid token");
    if (!row.used_at) {
      await supabaseAdmin.from("email_unsubscribe_tokens").update({ used_at: new Date().toISOString() }).eq("id", row.id);
    }
    await supabaseAdmin.from("suppression_list").upsert({
      business_id: row.business_id as string, email: row.email as string, reason: "unsubscribed", source: "link",
    }, { onConflict: "business_id,email" });
    if (row.contact_id) {
      await supabaseAdmin.from("contacts").update({ unsubscribed_at: new Date().toISOString(), status: "unsubscribed" }).eq("id", row.contact_id as string);
    } else {
      await supabaseAdmin.from("contacts").update({ unsubscribed_at: new Date().toISOString(), status: "unsubscribed" })
        .eq("business_id", row.business_id as string).eq("email", row.email as string);
    }
    await supabaseAdmin.from("email_events").insert({
      business_id: row.business_id as string, event_type: "unsubscribed",
      metadata_json: { email: row.email, source: "link" } as any,
    });
    return { ok: true };
  });

export const seedDemoContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ business_id: z.string().uuid(), count: z.number().int().min(1).max(50).default(10) }).parse(input))
  .handler(async ({ data, context }) => {
    const rows = Array.from({ length: data.count }).map((_, i) => ({
      business_id: data.business_id,
      email: `demo${Date.now() + i}@example.test`,
      name: `Demo Contact ${i + 1}`,
      source: "demo",
      consent_at: new Date().toISOString(),
      status: "active",
    }));
    const { error } = await context.supabase.from("contacts").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });
