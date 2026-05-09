import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = "https://api.resend.com";

export interface SendEmailOpts {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: { name: string; value: string }[];
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  ok: boolean;
  resendId?: string;
  error?: string;
}

export interface BatchSendResult {
  ok: boolean;
  sent: number;
  failed: number;
  results: { to: string; resendId?: string; error?: string }[];
}

export async function sendEmailViaResend(opts: SendEmailOpts): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const body: Record<string, any> = {
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.text) body.text = opts.text;
  if (opts.tags?.length) body.tags = opts.tags;
  if (opts.replyTo) body.reply_to = opts.replyTo;
  if (opts.headers) body.headers = opts.headers;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${RESEND_API_URL}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 500)}` };
    }

    const json = await res.json();
    return { ok: true, resendId: json.id };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendEmailBatchViaResend(
  emails: (SendEmailOpts & { metadata?: Record<string, any> })[],
): Promise<BatchSendResult> {
  if (!RESEND_API_KEY) {
    return {
      ok: false,
      sent: 0,
      failed: emails.length,
      results: emails.map((e) => ({ to: e.to, error: "RESEND_API_KEY not configured" })),
    };
  }

  const CHUNK_SIZE = 100;
  const results: { to: string; resendId?: string; error?: string }[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    const chunk = emails.slice(i, i + CHUNK_SIZE);
    const batchBody = chunk.map((email) => {
      const item: Record<string, any> = {
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
      };
      if (email.text) item.text = email.text;
      if (email.tags?.length) item.tags = email.tags;
      if (email.replyTo) item.reply_to = email.replyTo;
      if (email.headers) item.headers = email.headers;
      return item;
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${RESEND_API_URL}/emails/batch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batchBody),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        chunk.forEach((email) => {
          results.push({ to: email.to, error: `Resend batch ${res.status}: ${text.slice(0, 500)}` });
          failed++;
        });
        continue;
      }

      const json = await res.json();
      const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

      chunk.forEach((email, idx) => {
        const id = data[idx]?.id;
        if (id) {
          results.push({ to: email.to, resendId: id });
          sent++;
        } else {
          results.push({ to: email.to, error: "No ID returned from Resend" });
          failed++;
        }
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: sent > 0, sent, failed, results };
}

export async function logEmailSend(opts: {
  resendId?: string;
  templateName: string;
  recipientEmail: string;
  status: "pending" | "sent" | "suppressed" | "failed" | "bounced" | "complained" | "dlq";
  errorMessage?: string;
  metadata?: Record<string, any>;
}) {
  await supabaseAdmin.from("email_send_log").insert({
    message_id: opts.resendId ?? null,
    template_name: opts.templateName,
    recipient_email: opts.recipientEmail,
    status: opts.status,
    error_message: opts.errorMessage ?? null,
    metadata: opts.metadata ?? {},
  });
}

export async function trackEmailEvent(opts: {
  business_id: string;
  campaign_id?: string | null;
  contact_id?: string | null;
  message_id?: string | null;
  event_type: string;
  resend_id?: string;
  email?: string;
  metadata?: Record<string, any>;
}) {
  await supabaseAdmin.from("email_events").insert({
    business_id: opts.business_id,
    campaign_id: opts.campaign_id ?? null,
    contact_id: opts.contact_id ?? null,
    event_type: opts.event_type,
    metadata_json: {
      ...(opts.metadata ?? {}),
      message_id: opts.message_id,
      resend_id: opts.resend_id,
      email: opts.email,
    } as any,
  });
}

export type ResendWebhookEvent = {
  type: "email.sent" | "email.delivered" | "email.delivery_delayed" | "email.bounced" | "email.complained" | "email.opened" | "email.clicked";
  data: {
    id: string;
    object: string;
    created_at: number;
    to: string[];
    from: string;
    subject: string;
    tags?: { name: string; value: string }[];
  } & Record<string, any>;
};

export async function handleResendWebhook(payload: ResendWebhookEvent) {
  const { type, data } = payload;
  const resendId = data.id;
  const email = data.to?.[0];

  const tags = data.tags ?? [];
  const tagMap = new Map(tags.map((t) => [t.name, t.value]));

  let business_id = tagMap.get("business_id");
  let campaign_id = tagMap.get("campaign_id");
  let contact_id = tagMap.get("contact_id");
  let message_id = tagMap.get("message_id");

  if (!business_id) {
    const { data: logRows } = await supabaseAdmin
      .from("email_send_log")
      .select("metadata")
      .eq("message_id", resendId)
      .order("created_at", { ascending: false })
      .limit(1);

    const metadata = (logRows?.[0]?.metadata as Record<string, any>) ?? {};
    business_id = metadata.business_id;
    campaign_id = metadata.campaign_id;
    contact_id = metadata.contact_id;
    message_id = metadata.message_id;
  }

  if (!business_id) {
    console.warn("[email-webhook] No business_id found for event", { type, resendId, email });
    return { processed: false, reason: "no_business_id" };
  }

  const eventTypeMap: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delayed",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.opened": "opened",
    "email.clicked": "clicked",
  };

  const eventType = eventTypeMap[type] ?? type;

  await supabaseAdmin.from("email_events").insert({
    business_id,
    campaign_id: campaign_id ?? null,
    contact_id: contact_id ?? null,
    event_type: eventType,
    metadata_json: {
      resend_id: resendId,
      email,
      subject: data.subject,
      from: data.from,
      message_id,
      ...(data.click?.link ? { link: data.click.link } : {}),
    } as any,
  });

  if (campaign_id) {
    const { data: campaign } = await supabaseAdmin
      .from("email_campaigns")
      .select("opens_count, clicks_count, bounces_count, unsubscribes_count")
      .eq("id", campaign_id)
      .maybeSingle();

    if (campaign) {
      const update: any = {};
      if (eventType === "opened") update.opens_count = (campaign.opens_count ?? 0) + 1;
      if (eventType === "clicked") update.clicks_count = (campaign.clicks_count ?? 0) + 1;
      if (eventType === "bounced") update.bounces_count = (campaign.bounces_count ?? 0) + 1;
      if (eventType === "unsubscribed") update.unsubscribes_count = (campaign.unsubscribes_count ?? 0) + 1;
      if (Object.keys(update).length > 0) {
        await supabaseAdmin.from("email_campaigns").update(update).eq("id", campaign_id);
      }
    }
  }

  const statusMap: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "sent",
    "email.bounced": "bounced",
    "email.complained": "complained",
  };
  if (statusMap[type] && resendId) {
    await supabaseAdmin
      .from("email_send_log")
      .update({ status: statusMap[type] })
      .eq("message_id", resendId);
  }

  return { processed: true, eventType };
}

export function mdToHtml(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("### ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3>${inlineMd(trimmed.slice(4))}</h3>`;
    } else if (trimmed.startsWith("## ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h2>${inlineMd(trimmed.slice(3))}</h2>`;
    } else if (trimmed.startsWith("# ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h1>${inlineMd(trimmed.slice(2))}</h1>`;
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inlineMd(trimmed.slice(2))}</li>`;
    } else if (trimmed) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${inlineMd(trimmed)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function inlineMd(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, (_, label, url) => {
      const safeUrl = sanitizeUrl(url);
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
}

function sanitizeUrl(url: string): string {
  // Block javascript:, data:, vbscript: protocols
  const normalized = url.trim().toLowerCase();
  if (normalized.startsWith("javascript:") || normalized.startsWith("data:") || normalized.startsWith("vbscript:")) {
    return "#";
  }
  return url;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function personalizeEmail(template: string, contact: { name?: string | null; email?: string | null }): string {
  const firstName = escapeHtml(contact.name?.split(" ")[0] ?? "there");
  const name = escapeHtml(contact.name ?? "there");
  const email = escapeHtml(contact.email ?? "");
  return template
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*name\s*\}\}/gi, name)
    .replace(/\{\{\s*email\s*\}\}/gi, email);
}

export function buildUnsubscribeUrl(token: string): string {
  const base = process.env.SITE_URL || process.env.VERCEL_URL || "http://localhost:3000";
  return `${base}/unsubscribe/${token}`;
}

export function wrapEmailBody(html: string, opts?: { unsubscribeUrl?: string; previewText?: string }): string {
  let body = html;
  if (opts?.previewText) {
    body = `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escapeHtml(opts.previewText)}</div>` + body;
  }
  if (opts?.unsubscribeUrl) {
    body += `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="font-size:12px;color:#6b7280;">You received this because you're subscribed. <a href="${opts.unsubscribeUrl}">Unsubscribe</a></p>`;
  }
  return `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto;padding:24px;">${body}</div>`;
}

export async function getOrCreateUnsubscribeToken(
  business_id: string,
  contact_id: string | undefined,
  email: string,
): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("business_id", business_id)
    .eq("email", email)
    .maybeSingle();
  if (existing?.token) return existing.token;

  const token = crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 10);
  await supabaseAdmin.from("email_unsubscribe_tokens").insert({
    business_id,
    contact_id: contact_id ?? null,
    email,
    token,
  });
  return token;
}
