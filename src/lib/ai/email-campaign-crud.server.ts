import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withBillingGuard } from "@/lib/server/billing";
import { loadWorkspaceId, loadBrandContext } from "@/lib/server/context";
import {
  sendEmailBatchViaResend,
  mdToHtml,
  personalizeEmail,
  getOrCreateUnsubscribeToken,
  buildUnsubscribeUrl,
  wrapEmailBody,
  trackEmailEvent,
} from "@/lib/email/resend.server";

async function audit(supabase: any, business_id: string, action: string, entity: string, entity_id: string | null, metadata: Record<string, unknown> = {}) {
  const ws_id = await loadWorkspaceId(supabase, business_id);
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("audit_logs").insert({
    workspace_id: ws_id, business_id, user_id: user?.id ?? null,
    action, entity, entity_id, metadata_json: metadata as any,
  });
}

export const listEmailCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ business_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { data: campaigns } = await context.supabase.from("email_campaigns")
        .select("id, name, type, status, created_at, updated_at, content_json").eq("business_id", data.business_id).order("updated_at", { ascending: false });
      return { campaigns: campaigns ?? [] };
    } catch (err: any) {
      console.error("[email] Error:", err);
      throw err;
    }
  });

export const getEmailCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ campaign_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const [{ data: campaign }, { data: messages }] = await Promise.all([
        context.supabase.from("email_campaigns").select("*").eq("id", data.campaign_id).maybeSingle(),
        context.supabase.from("email_messages").select("*").eq("campaign_id", data.campaign_id).order("position"),
      ]);
      if (!campaign) throw new Error("Campaign not found");
      return { campaign, messages: messages ?? [] };
    } catch (err: any) {
      console.error("[email] Error:", err);
      throw err;
    }
  });

export const updateEmailCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    campaign_id: z.string().uuid(),
    patch: z.object({
      name: z.string().max(160).optional(),
      type: z.string().max(40).optional(),
      status: z.string().max(40).optional(),
      content_json: z.record(z.any()).optional(),
    }),
  }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { error } = await context.supabase.from("email_campaigns").update(data.patch as any).eq("id", data.campaign_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err: any) {
      console.error("[email] Error:", err);
      return { ok: false, error: err.message };
    }
  });

export const deleteEmailCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ campaign_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { error: msgErr } = await context.supabase.from("email_messages").delete().eq("campaign_id", data.campaign_id);
      if (msgErr) throw new Error(msgErr.message);
      const { error } = await context.supabase.from("email_campaigns").delete().eq("id", data.campaign_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err: any) {
      console.error("[email] Error:", err);
      return { ok: false, error: err.message };
    }
  });

export const sendEmailCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ campaign_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
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

      const from = process.env.MARKETING_FROM_EMAIL || "Marketing <onboarding@wazeer.io>";
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
    } catch (err: any) {
      console.error("[email] Error:", err);
      return { ok: false, error: err.message };
    }
  });

export const getCampaignAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ campaign_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
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
    } catch (err: any) {
      console.error("[email] Error:", err);
      throw err;
    }
  });

export const seedDemoContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ business_id: z.string().uuid(), count: z.number().int().min(1).max(50).default(10) }).parse(input))
  .handler(async ({ data, context }) => {
    try {
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
    } catch (err: any) {
      console.error("[email] Error:", err);
      return { ok: false, error: err.message };
    }
  });
