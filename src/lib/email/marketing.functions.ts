import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAI } from "@/lib/ai/gateway";
import {
  sendEmailViaResend,
  sendEmailBatchViaResend,
  getOrCreateUnsubscribeToken,
  buildUnsubscribeUrl,
  wrapEmailBody,
  trackEmailEvent,
} from "@/lib/email/resend.server";

async function getBusinessId(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from("businesses").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) throw new Error("Create a business first.");
  return data.id as string;
}

/* ─────────────── AI helpers ─────────────── */

export const generateCampaignSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ goal: z.string().max(500).optional().default("") }).parse(i))
  .handler(async ({ data }) => {
    const aiRes = await callAI({
      messages: [
        { role: "system", content: "You write concise, high-open-rate email subject lines under 60 chars. Reply with the subject only — no quotes, no prefix." },
        { role: "user", content: `Goal/topic: ${data.goal || "general newsletter"}` },
      ],
    });
    return { subject: (aiRes.content || "").trim() };
  });

export const generateCampaignBody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ subject: z.string().max(200).optional().default(""), goal: z.string().max(800).optional().default("") }).parse(i),
  )
  .handler(async ({ data }) => {
    const aiRes = await callAI({
      messages: [
        { role: "system", content: "You write friendly, persuasive marketing email bodies in clean HTML. Use <h2>, <p>, and <a>. No <html>/<body> tags. 120-220 words. End with a clear CTA. Avoid invented claims." },
        { role: "user", content: `Subject: ${data.subject}\nGoal: ${data.goal || "engage subscribers"}` },
      ],
    });
    return { body_html: (aiRes.content || "").trim() };
  });

/* ─────────────── Audience resolution ─────────────── */

async function resolveAudience(business_id: string, audience_type: string, manual_emails: string[] = []) {
  if (audience_type === "manual") {
    return manual_emails.filter((e) => /\S+@\S+\.\S+/.test(e)).map((e) => ({ email: e.toLowerCase(), name: null as string | null, id: null as string | null }));
  }
  const { data: contacts } = await supabaseAdmin
    .from("contacts")
    .select("id, email, name, status, tags_json")
    .eq("business_id", business_id)
    .eq("status", "active");
  let list = (contacts ?? []).filter((c) => !!c.email);
  if (audience_type === "paid") list = list.filter((c) => Array.isArray((c as any).tags_json) && (c as any).tags_json.includes("paid"));
  if (audience_type === "free") list = list.filter((c) => !Array.isArray((c as any).tags_json) || !(c as any).tags_json.includes("paid"));
  // Drop suppressed
  const { data: sup } = await supabaseAdmin.from("suppression_list").select("email").eq("business_id", business_id);
  const supSet = new Set((sup ?? []).map((s) => s.email.toLowerCase()));
  return list.filter((c) => !supSet.has((c.email as string).toLowerCase())).map((c) => ({ id: c.id as string, email: c.email as string, name: c.name as string | null }));
}

/* ─────────────── Resend send ─────────────── */

async function sendOneViaResend(opts: { from: string; to: string; subject: string; html: string; tags?: { name: string; value: string }[] }) {
  const result = await sendEmailViaResend({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    tags: opts.tags,
  });
  if (!result.ok) {
    return { ok: false as const, mock: !process.env.RESEND_API_KEY, error: result.error };
  }
  return { ok: true as const, mock: false };
}

/* ─────────────── Campaigns ─────────────── */

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("email_campaigns")
      .select("id, name, subject, audience_type, status, recipients_count, opens_count, clicks_count, sent_at, scheduled_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const getCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("email_campaigns").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Campaign not found");
    return { campaign: row };
  });

export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(160),
      subject: z.string().min(1).max(200),
      body_html: z.string().min(1),
      audience_type: z.enum(["all", "paid", "free", "manual"]),
      manual_emails: z.array(z.string()).optional().default([]),
      scheduled_at: z.string().nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const business_id = await getBusinessId(context.supabase);
    const payload: any = {
      business_id,
      name: data.name,
      subject: data.subject,
      body_html: data.body_html,
      audience_type: data.audience_type,
      content_json: { manual_emails: data.manual_emails ?? [] },
      scheduled_at: data.scheduled_at ?? null,
      status: data.scheduled_at ? "scheduled" : "draft",
    };
    if (data.id) {
      const { error } = await context.supabase.from("email_campaigns").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase.from("email_campaigns").insert(payload).select("id").single();
    if (error || !row) throw new Error(error?.message || "Failed");
    return { id: row.id };
  });

export const sendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: c, error } = await context.supabase
      .from("email_campaigns").select("*").eq("id", data.id).maybeSingle();
    if (error || !c) throw new Error("Campaign not found");
    const audience_type = (c.audience_type as string) || "all";
    const manual = ((c.content_json as any)?.manual_emails as string[]) || [];
    const recipients = await resolveAudience(c.business_id as string, audience_type, manual);
    if (!recipients.length) throw new Error("No recipients matched the audience.");

    const from = process.env.MARKETING_FROM_EMAIL || "Marketing <onboarding@wazeer.io>";
    let mocked = !process.env.RESEND_API_KEY;

    const emails: any[] = [];
    for (const r of recipients.slice(0, 500)) {
      const token = await getOrCreateUnsubscribeToken(c.business_id as string, r.id ?? undefined, r.email);
      const unsubscribeUrl = buildUnsubscribeUrl(token);
      const html = wrapEmailBody(c.body_html as string, { unsubscribeUrl });
      emails.push({
        from,
        to: r.email,
        subject: c.subject as string,
        html,
        tags: [
          { name: "business_id", value: c.business_id as string },
          { name: "campaign_id", value: c.id as string },
          { name: "contact_id", value: r.id ?? "" },
        ],
        metadata: { contact_id: r.id, email: r.email },
      });
    }

    const batchResult = await sendEmailBatchViaResend(emails);
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < batchResult.results.length; i++) {
      const r = batchResult.results[i];
      const meta = emails[i].metadata;
      if (r.resendId) {
        sent++;
        await trackEmailEvent({
          business_id: c.business_id as string,
          campaign_id: c.id as string,
          contact_id: meta.contact_id,
          event_type: "sent",
          resend_id: r.resendId,
          email: meta.email,
        });
      } else {
        failed++;
        await trackEmailEvent({
          business_id: c.business_id as string,
          campaign_id: c.id as string,
          contact_id: meta.contact_id,
          event_type: "failed",
          email: meta.email,
          metadata: { error: r.error },
        });
      }
    }

    await context.supabase.from("email_campaigns").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      recipients_count: recipients.length,
    }).eq("id", c.id);

    return { ok: true, sent, failed, mock: mocked, total: recipients.length };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("email_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCampaignStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: events } = await context.supabase
      .from("email_events").select("event_type, created_at").eq("campaign_id", data.id);
    const counts = { sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, failed: 0 } as Record<string, number>;
    (events ?? []).forEach((e) => { counts[e.event_type as string] = (counts[e.event_type as string] ?? 0) + 1; });
    return { counts, events: events ?? [] };
  });

/* ─────────────── Automations ─────────────── */

export const AUTOMATION_TYPES = ["welcome", "abandoned_checkout", "post_purchase", "re_engagement"] as const;
export type AutomationType = typeof AUTOMATION_TYPES[number];

export const triggerAutomationWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase configuration");

    const res = await fetch(`${supabaseUrl}/functions/v1/email-automations-process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Automation worker failed: ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json();
  });

export const listAutomations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const business_id = await getBusinessId(context.supabase);
    const { data, error } = await context.supabase
      .from("email_automations")
      .select("id, automation_type, name, is_active, subject, body_html, delay_minutes, sent_count, opens_count")
      .eq("business_id", business_id)
      .not("automation_type", "is", null);
    if (error) throw new Error(error.message);
    return { items: data ?? [], business_id };
  });

export const upsertAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      automation_type: z.enum(AUTOMATION_TYPES),
      is_active: z.boolean().optional(),
      subject: z.string().max(200).optional(),
      body_html: z.string().optional(),
      delay_minutes: z.number().int().min(0).max(60 * 24 * 7).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const business_id = await getBusinessId(context.supabase);
    const defaults: Record<string, { name: string; subject: string; delay: number; body: string }> = {
      welcome: { name: "Welcome", subject: "Welcome aboard!", delay: 0, body: "<h2>Welcome!</h2><p>We're glad to have you.</p>" },
      abandoned_checkout: { name: "Abandoned Checkout", subject: "You left something behind", delay: 60, body: "<h2>Still thinking it over?</h2><p>Your cart is waiting.</p>" },
      post_purchase: { name: "Post-Purchase Thank You", subject: "Thanks for your order!", delay: 0, body: "<h2>Thank you!</h2><p>Your order means the world.</p>" },
      re_engagement: { name: "Re-engagement", subject: "We miss you", delay: 60 * 24 * 30, body: "<h2>Long time no see</h2><p>Here's what's new.</p>" },
    };
    const def = defaults[data.automation_type];

    const { data: existing } = await context.supabase
      .from("email_automations").select("id")
      .eq("business_id", business_id).eq("automation_type", data.automation_type).maybeSingle();

    const patch: any = {};
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    if (data.subject !== undefined) patch.subject = data.subject;
    if (data.body_html !== undefined) patch.body_html = data.body_html;
    if (data.delay_minutes !== undefined) patch.delay_minutes = data.delay_minutes;

    if (existing) {
      const { error } = await context.supabase.from("email_automations").update(patch).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: row, error } = await context.supabase.from("email_automations").insert({
      business_id,
      automation_type: data.automation_type,
      name: def.name,
      subject: data.subject ?? def.subject,
      body_html: data.body_html ?? def.body,
      delay_minutes: data.delay_minutes ?? def.delay,
      is_active: data.is_active ?? false,
      status: "active",
      trigger_type: data.automation_type,
    }).select("id").single();
    if (error || !row) throw new Error(error?.message || "Failed");
    return { id: row.id };
  });
