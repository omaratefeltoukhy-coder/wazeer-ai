import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";
import { constructStripeEvent } from "@/lib/billing/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getSubscriptionId(
  sub: Stripe.Subscription | string | null | undefined
): string | null {
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

export const Route = createFileRoute("/api/public/payments/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.text();
        const sig = request.headers.get("stripe-signature") || "";

        let event: Stripe.Event;
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

        await supabase.from("billing_events").insert({
          external_event_id: event.id,
          event_type: event.type,
          event_data: event.data.object as never,
        });

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const metadata = session.metadata || {};
            const paymentLinkCode = metadata.payment_link_code;
            const buyerEmail =
              session.customer_email || session.customer_details?.email;

            if (paymentLinkCode && buyerEmail) {
              await (supabase as any).rpc("record_payment_link_purchase", {
                _code: paymentLinkCode,
                _buyer_name: session.customer_details?.name || "Customer",
                _buyer_email: buyerEmail,
                _buyer_phone: session.customer_details?.phone || null,
                _amount: session.amount_total ? session.amount_total / 100 : 0,
                _currency: session.currency?.toUpperCase() || "USD",
                _provider_transaction_id: session.id,
                _provider: "stripe",
              });
            }

            if (
              session.mode === "subscription" &&
              metadata.workspace_id &&
              metadata.user_id &&
              metadata.plan_id
            ) {
              // Record the subscription immediately so the user gets access right away
              const { data: existing } = await supabase
                .from("subscriptions")
                .select("id")
                .eq("workspace_id", metadata.workspace_id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              const row = {
                workspace_id: metadata.workspace_id,
                user_id: metadata.user_id,
                plan: metadata.plan_id,
                status: "trialing" as const,
                stripe_customer_id:
                  typeof session.customer === "string"
                    ? session.customer
                    : null,
                stripe_subscription_id: session.subscription as string | null,
              };

              if (existing) {
                await supabase.from("subscriptions").update(row).eq("id", existing.id);
              } else {
                await supabase.from("subscriptions").insert(row);
              }
            }
            break;
          }

          case "invoice.payment_succeeded": {
            const invoice = event.data.object as Stripe.Invoice;
            const metadata = (invoice.metadata as Record<string, string>) || {};
            const subId = getSubscriptionId(invoice.subscription);
            const workspaceId = metadata.workspace_id || metadata.workspaceId;
            if (subId && workspaceId) {
              const { data: existing } = await supabase
                .from("subscriptions")
                .select("id")
                .eq("workspace_id", workspaceId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              const row = {
                workspace_id: workspaceId,
                user_id: metadata.user_id,
                stripe_customer_id: invoice.customer as string | null,
                stripe_subscription_id: subId,
                status: "active" as const,
                current_period_end: invoice.period_end
                  ? new Date(invoice.period_end * 1000).toISOString()
                  : null,
              };

              if (existing) {
                await supabase.from("subscriptions").update(row).eq("id", existing.id);
              } else {
                await supabase.from("subscriptions").insert(row);
              }
            }
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            if (subscription.id) {
              await supabase
                .from("subscriptions")
                .update({ status: "canceled" })
                .eq("stripe_subscription_id", subscription.id);
            }
            break;
          }
        }

        return Response.json({ received: true });
      },
    },
  },
});
