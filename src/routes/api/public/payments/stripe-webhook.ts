import { createFileRoute } from "@tanstack/react-router";
import { constructStripeEvent } from "@/lib/billing/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/payments/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.text();
        const sig = request.headers.get("stripe-signature") || "";

        let event;
        try {
          event = await constructStripeEvent(payload, sig);
        } catch (err: any) {
          console.error("Stripe webhook verification failed:", err.message);
          return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        }

        const supabase = supabaseAdmin;

        // Idempotency
        const { data: existing } = await supabase
          .from("billing_events")
          .select("id")
          .eq("external_event_id", event.id)
          .maybeSingle();
        if (existing) return Response.json({ received: true });

        const eventData = event.data.object as Record<string, any>;
        const metadata = eventData.metadata || {};

        await supabase.from("billing_events").insert({
          external_event_id: event.id,
          event_type: event.type,
          event_data: eventData,
        });

        switch (event.type) {
          case "checkout.session.completed": {
            const mode = eventData.mode; // "payment" or "subscription"
            const paymentLinkCode = metadata.payment_link_code;
            const buyerEmail = eventData.customer_email || eventData.customer_details?.email;

            if (paymentLinkCode && buyerEmail) {
              await supabase.rpc("record_payment_link_purchase", {
                _code: paymentLinkCode,
                _buyer_name: eventData.customer_details?.name || "Customer",
                _buyer_email: buyerEmail,
                _buyer_phone: eventData.customer_details?.phone || null,
                _amount: eventData.amount_total ? eventData.amount_total / 100 : 0,
                _currency: eventData.currency?.toUpperCase() || "USD",
                _provider_transaction_id: eventData.id,
                _provider: "stripe",
              });
            }

            if (mode === "subscription" && metadata.user_id && metadata.plan_id) {
              await supabase.rpc("grant_plan_credits", {
                p_user_id: metadata.user_id,
                p_plan_id: metadata.plan_id,
              });
            }
            break;
          }

          case "invoice.payment_succeeded": {
            if (eventData.subscription && metadata.user_id) {
              await supabase
                .from("subscriptions")
                .upsert({
                  user_id: metadata.user_id,
                  stripe_subscription_id: eventData.subscription,
                  status: "active",
                  current_period_end: new Date(eventData.period_end * 1000).toISOString(),
                }, { onConflict: "user_id" });
            }
            break;
          }

          case "customer.subscription.deleted": {
            if (eventData.id) {
              await supabase
                .from("subscriptions")
                .update({ status: "canceled" })
                .eq("stripe_subscription_id", eventData.id);
            }
            break;
          }
        }

        return Response.json({ received: true });
      },
    },
  },
});
