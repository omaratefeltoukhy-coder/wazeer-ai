import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHmac, timingSafeEqual } from "crypto";

// Provider-agnostic billing webhook stub. In live mode set BILLING_WEBHOOK_SECRET
// and adapt parsing for the chosen provider (Stripe/Paddle).
export const Route = createFileRoute("/api/public/billing-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const secret = process.env.BILLING_WEBHOOK_SECRET;
        if (secret) {
          const sig = request.headers.get("x-billing-signature") ?? "";
          const expected = createHmac("sha256", secret).update(body).digest("hex");
          try {
            if (!sig || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
              return new Response("Invalid signature", { status: 401 });
            }
          } catch {
            return new Response("Invalid signature", { status: 401 });
          }
        }
        let payload: Record<string, unknown> = {};
        try { payload = JSON.parse(body); } catch { /* tolerate empty body */ }

        await supabaseAdmin.from("billing_events").insert({
          workspace_id: (payload.workspace_id as string | undefined) ?? null,
          provider: (payload.provider as string | undefined) ?? "mock",
          event_type: (payload.type as string | undefined) ?? "unknown",
          external_event_id: (payload.id as string | undefined) ?? null,
          payload_json: payload as never,
          processed_at: new Date().toISOString(),
        });
        return Response.json({ received: true });
      },
    },
  },
});
