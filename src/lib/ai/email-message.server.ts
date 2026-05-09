import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sendEmailViaResend,
  mdToHtml,
  wrapEmailBody,
  trackEmailEvent,
} from "@/lib/email/resend.server";

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
    try {
      const { error } = await context.supabase.from("email_messages").update(data.patch as any).eq("id", data.message_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err: any) {
      console.error("[email] Error:", err);
      return { ok: false, error: err.message };
    }
  });

export const duplicateEmailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ message_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { data: src, error } = await context.supabase.from("email_messages").select("*").eq("id", data.message_id).maybeSingle();
      if (error || !src) throw new Error("Email not found");
      const { id, created_at, updated_at, sent_at, ...rest } = src as any;
      const { data: ins, error: insErr } = await context.supabase.from("email_messages").insert({
        ...rest, name: `${rest.name} (copy)`, status: "draft", scheduled_at: null, position: (rest.position ?? 0) + 1,
      }).select("id").single();
      if (insErr) throw new Error(insErr.message);
      return { id: ins.id };
    } catch (err: any) {
      console.error("[email] Error:", err);
      throw err;
    }
  });

export const archiveEmailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ message_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { error } = await context.supabase.from("email_messages").update({ status: "archived" }).eq("id", data.message_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err: any) {
      console.error("[email] Error:", err);
      return { ok: false, error: err.message };
    }
  });

export const scheduleEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    message_id: z.string().uuid(),
    scheduled_at: z.string().datetime(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { error } = await context.supabase.from("email_messages")
        .update({ scheduled_at: data.scheduled_at, status: "scheduled" }).eq("id", data.message_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err: any) {
      console.error("[email] Error:", err);
      return { ok: false, error: err.message };
    }
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    message_id: z.string().uuid(),
    to_email: z.string().email(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    try {
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
        from: process.env.MARKETING_FROM_EMAIL || "Marketing <onboarding@wazeer.io>",
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
    } catch (err: any) {
      console.error("[email] Error:", err);
      return { ok: false, error: err.message };
    }
  });
