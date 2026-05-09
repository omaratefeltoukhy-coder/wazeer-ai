import { createFileRoute } from "@tanstack/react-router";
import { handleResendWebhook, type ResendWebhookEvent } from "@/lib/email/resend.server";
import { verifyResendSignature, parseResendPayload } from "@/lib/email/webhook.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/email-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_WEBHOOK_SECRET;

        // Fail closed: if no secret configured, reject the webhook
        if (!secret) {
          console.error("[email-webhook] RESEND_WEBHOOK_SECRET not configured");
          return new Response("Webhook secret not configured", { status: 503 });
        }

        // Idempotency: check if we've already processed this event
        const eventId = request.headers.get("svix-id") ?? request.headers.get("x-resend-event-id") ?? "";
        if (eventId) {
          const { data: existing } = await supabaseAdmin
            .from("billing_events")
            .select("id")
            .eq("external_event_id", eventId)
            .eq("provider", "resend")
            .maybeSingle();
          if (existing) {
            return Response.json({ processed: true, eventType: "duplicate", reason: "already_processed" });
          }
        }

        // Verify signature using constant-time comparison
        const signature = request.headers.get("svix-signature") ?? request.headers.get("x-resend-signature") ?? "";
        if (!signature) {
          return new Response("Missing signature", { status: 401 });
        }

        const rawBody = await request.text();
        if (!verifyResendSignature(secret, rawBody, signature)) {
          console.warn("[email-webhook] Signature mismatch");
          return new Response("Invalid signature", { status: 401 });
        }

        const parsed = parseResendPayload(rawBody);
        if (!parsed.ok) {
          return new Response(parsed.error, { status: 400 });
        }
        const payload = parsed.payload as ResendWebhookEvent;

        // Reserve idempotency key before processing
        if (eventId) {
          const { error: dupErr } = await supabaseAdmin.from("billing_events").insert({
            external_event_id: eventId,
            provider: "resend",
            event_type: payload.type,
            payload_json: payload as any,
            status: "processing",
          } as any);
          if (dupErr && dupErr.message?.includes("duplicate")) {
            return Response.json({ processed: true, eventType: payload.type, reason: "already_processed" });
          }
        }

        try {
          const result = await handleResendWebhook(payload);

          // Mark as completed
          if (eventId) {
            await supabaseAdmin
              .from("billing_events")
              .update({ status: "completed" } as any)
              .eq("external_event_id", eventId)
              .eq("provider", "resend");
          }

          return Response.json(result);
        } catch (e: any) {
          console.error("[email-webhook] Error handling event:", e);

          // Mark as failed
          if (eventId) {
            await supabaseAdmin
              .from("billing_events")
              .update({ status: "failed", error_message: e?.message || "Unknown error" } as any)
              .eq("external_event_id", eventId)
              .eq("provider", "resend");
          }

          return new Response("Internal error", { status: 500 });
        }
      },
    },
  },
});
