import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sendEmailViaResend,
  getOrCreateUnsubscribeToken,
  buildUnsubscribeUrl,
  wrapEmailBody,
  trackEmailEvent,
} from "@/lib/email/resend.server";

export const Route = createFileRoute("/api/email/automations/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error("[automation-worker] Missing Supabase env vars");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.slice("Bearer ".length).trim();
        if (token !== supabaseServiceKey) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        const results = await processAutomations();
        return Response.json(results);
      },
    },
  },
});

async function processAutomations() {
  const now = new Date().toISOString();
  const stats = { enrolled: 0, sent: 0, failed: 0, skipped: 0 };

  // 1. Get active automations
  const { data: automations, error: autoErr } = await (supabaseAdmin as any)
    .from("email_automations")
    .select("id, business_id, automation_type, name, subject, body_html, delay_minutes, is_active, trigger_type")
    .eq("is_active", true);

  if (autoErr) {
    console.error("[automation-worker] Failed to load automations:", autoErr);
    return { error: autoErr.message };
  }

  if (!automations?.length) return { ...stats, message: "No active automations" };

  // 2. For each automation, enroll eligible contacts
  for (const auto of automations) {
    const enrolled = await enrollEligibleContacts(auto as any);
    stats.enrolled += enrolled;
  }

  // 3. Send emails for due enrollments
  const { data: dueEnrollments, error: dueErr } = await (supabaseAdmin as any)
    .from("email_automation_enrollments")
    .select("id, automation_id, contact_id, business_id, execute_at, email_automations!inner(subject, body_html, name)")
    .eq("status", "pending")
    .lte("execute_at", now)
    .limit(100);

  if (dueErr) {
    console.error("[automation-worker] Failed to load due enrollments:", dueErr);
    return { ...stats, error: dueErr.message };
  }

  const fromEmail = process.env.MARKETING_FROM_EMAIL || "Marketing <onboarding@wazeer.io>";

  for (const enrollment of (dueEnrollments ?? []) as any[]) {
    const automation = enrollment.email_automations;
    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("id, email, name, unsubscribed_at, status")
      .eq("id", enrollment.contact_id)
      .maybeSingle();

    if (!contact?.email || contact.unsubscribed_at || contact.status === "unsubscribed") {
      await (supabaseAdmin as any)
        .from("email_automation_enrollments")
        .update({ status: "skipped", updated_at: now })
        .eq("id", enrollment.id);
      stats.skipped++;
      continue;
    }

    // Check suppression
    const { data: sup } = await supabaseAdmin
      .from("suppression_list")
      .select("id")
      .eq("business_id", enrollment.business_id)
      .eq("email", contact.email)
      .maybeSingle();
    if (sup) {
      await (supabaseAdmin as any)
        .from("email_automation_enrollments")
        .update({ status: "skipped", updated_at: now })
        .eq("id", enrollment.id);
      stats.skipped++;
      continue;
    }

    try {
      const token = await getOrCreateUnsubscribeToken(enrollment.business_id, contact.id, contact.email);
      const unsubscribeUrl = buildUnsubscribeUrl(token);
      const html = wrapEmailBody(automation.body_html ?? `<p>${automation.name}</p>`, { unsubscribeUrl });

      const result = await sendEmailViaResend({
        from: fromEmail,
        to: contact.email,
        subject: automation.subject ?? automation.name,
        html,
        tags: [
          { name: "business_id", value: enrollment.business_id },
          { name: "automation_id", value: enrollment.automation_id },
          { name: "contact_id", value: contact.id },
          { name: "enrollment_id", value: enrollment.id },
        ],
      });

      if (result.ok) {
        await (supabaseAdmin as any)
          .from("email_automation_enrollments")
          .update({ status: "sent", sent_at: now, updated_at: now })
          .eq("id", enrollment.id);

        await trackEmailEvent({
          business_id: enrollment.business_id,
          contact_id: contact.id,
          event_type: "sent",
          resend_id: result.resendId,
          email: contact.email,
          metadata: { automation_id: enrollment.automation_id, enrollment_id: enrollment.id },
        });

        // Increment automation sent_count
        await supabaseAdmin.rpc("increment_automation_sent" as any, { automation_id: enrollment.automation_id });
        stats.sent++;
      } else {
        await (supabaseAdmin as any)
          .from("email_automation_enrollments")
          .update({ status: "failed", updated_at: now })
          .eq("id", enrollment.id);
        stats.failed++;
      }
    } catch (e: any) {
      console.error("[automation-worker] Send failed:", e);
      await (supabaseAdmin as any)
        .from("email_automation_enrollments")
        .update({ status: "failed", updated_at: now })
        .eq("id", enrollment.id);
      stats.failed++;
    }
  }

  // 4. Update last_run_at on automations
  if (automations.length > 0) {
    await (supabaseAdmin as any)
      .from("email_automations")
      .update({ last_run_at: now })
      .in(
        "id",
        automations.map((a: any) => a.id),
      );
  }

  return stats;
}

async function enrollEligibleContacts(auto: {
  id: string;
  business_id: string;
  automation_type: string | null;
  delay_minutes: number;
}) {
  let contacts: { id: string; created_at: string }[] = [];
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000).toISOString(); // 15 min window

  switch (auto.automation_type) {
    case "welcome": {
      const { data } = await supabaseAdmin
        .from("contacts")
        .select("id, created_at")
        .eq("business_id", auto.business_id)
        .gte("created_at", windowStart)
        .is("unsubscribed_at", null)
        .neq("status", "unsubscribed");
      contacts = (data ?? []) as any[];
      break;
    }
    case "post_purchase": {
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("customer_id, created_at")
        .eq("business_id", auto.business_id)
        .gte("created_at", windowStart)
        .in("payment_status", ["paid", "completed", "succeeded"]);
      const contactIds = [...new Set((orders ?? []).map((o: any) => o.customer_id).filter(Boolean))];
      if (contactIds.length) {
        const { data } = await supabaseAdmin
          .from("contacts")
          .select("id, created_at")
          .in("id", contactIds)
          .is("unsubscribed_at", null)
          .neq("status", "unsubscribed");
        contacts = (data ?? []) as any[];
      }
      break;
    }
    case "re_engagement": {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      // Contacts who have been sent to but not opened in 30 days
      const { data: inactiveContacts } = await supabaseAdmin.rpc("get_re_engagement_contacts" as any, {
        p_business_id: auto.business_id,
        p_since: thirtyDaysAgo,
      });
      contacts = (inactiveContacts ?? []) as any[];
      break;
    }
    case "abandoned_checkout": {
      // Orders that are pending/unpaid created 30-120 min ago
      const minAgo = new Date(now.getTime() - 120 * 60 * 1000).toISOString();
      const maxAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("customer_id, created_at")
        .eq("business_id", auto.business_id)
        .gte("created_at", minAgo)
        .lte("created_at", maxAgo)
        .not("payment_status", "in", "(paid,completed,succeeded)");
      const contactIds = [...new Set((orders ?? []).map((o: any) => o.customer_id).filter(Boolean))];
      if (contactIds.length) {
        const { data } = await supabaseAdmin
          .from("contacts")
          .select("id, created_at")
          .in("id", contactIds)
          .is("unsubscribed_at", null)
          .neq("status", "unsubscribed");
        contacts = (data ?? []) as any[];
      }
      break;
    }
    default:
      return 0;
  }

  if (!contacts.length) return 0;

  // Exclude already enrolled
  const { data: existing } = await (supabaseAdmin as any)
    .from("email_automation_enrollments")
    .select("contact_id")
    .eq("automation_id", auto.id)
    .in(
      "contact_id",
      contacts.map((c) => c.id),
    );
  const enrolledIds = new Set((existing ?? []).map((e: any) => e.contact_id));
  const newContacts = contacts.filter((c) => !enrolledIds.has(c.id));

  if (!newContacts.length) return 0;

  const delayMs = (auto.delay_minutes ?? 0) * 60 * 1000;
  const rows = newContacts.map((c) => ({
    automation_id: auto.id,
    contact_id: c.id,
    business_id: auto.business_id,
    status: "pending" as const,
    execute_at: new Date(new Date(c.created_at).getTime() + delayMs).toISOString(),
    metadata_json: { trigger: auto.automation_type } as any,
  }));

  const { error } = await (supabaseAdmin as any).from("email_automation_enrollments").insert(rows);
  if (error) {
    console.error("[automation-worker] Enrollment failed:", error);
    return 0;
  }
  return rows.length;
}
