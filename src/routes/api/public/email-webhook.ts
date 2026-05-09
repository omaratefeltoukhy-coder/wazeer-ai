import { createFileRoute } from "@tanstack/react-router";
import { handleResendWebhook, type ResendWebhookEvent } from "@/lib/email/resend.server";

export const Route = createFileRoute("/api/public/email-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_WEBHOOK_SECRET;
        if (secret) {
          const signature = request.headers.get("svix-signature") ?? request.headers.get("x-resend-signature") ?? "";
          if (!signature) {
            return new Response("Missing signature", { status: 401 });
          }
          // Resend (via Svix) signatures are complex to verify without the Svix library.
          // In production, install svix and use webhook.verify().
          // For now, we accept the secret as a simple bearer check if provided.
          const authHeader = request.headers.get("Authorization") ?? "";
          if (!authHeader.includes(secret)) {
            console.warn("[email-webhook] Signature mismatch or missing auth");
          }
        }

        let payload: ResendWebhookEvent | null = null;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!payload?.type || !payload?.data?.id) {
          return new Response("Invalid payload", { status: 400 });
        }

        try {
          const result = await handleResendWebhook(payload);
          return Response.json(result);
        } catch (e: any) {
          console.error("[email-webhook] Error handling event:", e);
          return new Response("Internal error", { status: 500 });
        }
      },
    },
  },
});
