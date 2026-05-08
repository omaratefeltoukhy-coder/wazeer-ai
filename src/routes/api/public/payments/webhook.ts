import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

// Map Paddle external price IDs -> internal plan IDs
const PRICE_TO_PLAN: Record<string, "starter" | "growth" | "pro" | "agency"> = {
  starter_monthly: "starter",
  growth_monthly: "growth",
  pro_monthly: "pro",
  agency_monthly: "agency",
};

const PLAN_CREDITS: Record<string, number> = {
  starter: 800,
  growth: 3000,
  pro: 8000,
  agency: 25000,
};

// Credit pack price IDs -> total credits to grant (includes bonuses)
const PACK_TO_CREDITS: Record<string, number> = {
  pack_500: 500,
  pack_1500: 1650,
  pack_5000: 6000,
  pack_15000: 18750,
};

async function handleSubscriptionCreatedOrUpdated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, scheduledChange, customData } = data;
  const workspaceId = customData?.workspaceId as string | undefined;
  const userId = customData?.userId as string | undefined;
  if (!workspaceId || !userId) {
    console.error("Missing workspaceId/userId in customData", { id });
    return;
  }

  const item = items?.[0];
  const priceExtId = item?.price?.importMeta?.externalId as string | undefined;
  const productExtId = item?.product?.importMeta?.externalId as string | undefined;
  if (!priceExtId) {
    console.warn("Skipping: missing importMeta.externalId", { rawPriceId: item?.price?.id });
    return;
  }

  const plan = PRICE_TO_PLAN[priceExtId];
  if (!plan) {
    console.warn("Unknown plan price:", priceExtId);
    return;
  }

  const periodStart = currentBillingPeriod?.startsAt ?? null;
  const periodEnd = currentBillingPeriod?.endsAt ?? null;

  // Upsert subscription row keyed by paddle_subscription_id (or workspace fallback for first time)
  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id, plan, status")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const mappedStatus: "active" | "canceled" | "past_due" | "trialing" | "unpaid" =
    status === "trialing" ? "trialing"
    : status === "canceled" ? "canceled"
    : status === "past_due" ? "past_due"
    : "active";

  const subRow = {
    workspace_id: workspaceId,
    user_id: userId,
    plan,
    status: mappedStatus,
    paddle_subscription_id: id,
    paddle_customer_id: customerId,
    paddle_price_id: priceExtId,
    paddle_product_id: productExtId ?? null,
    environment: env,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: scheduledChange?.action === "cancel",
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabaseAdmin.from("subscriptions").update(subRow).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("subscriptions").insert(subRow);
  }

  // On purchase / plan change → reset monthly credits to plan amount
  const planChanged = !existing || existing.plan !== plan || existing.status !== "active";
  if (planChanged && status !== "canceled") {
    const credits = PLAN_CREDITS[plan];
    await supabaseAdmin.from("credit_grants").insert({
      workspace_id: workspaceId,
      source: `plan:${plan}`,
      amount: credits,
      balance: credits,
      expires_at: periodEnd,
      metadata_json: { paddle_subscription_id: id, environment: env } as never,
    });
    // Zero out previous unexpired plan grants so this acts as a "reset"
    await supabaseAdmin
      .from("credit_grants")
      .update({ balance: 0 })
      .eq("workspace_id", workspaceId)
      .like("source", "plan:%")
      .neq("source", `plan:${plan}`);
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const { id, currentBillingPeriod, customData } = data;
  const workspaceId = customData?.workspaceId as string | undefined;

  await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: true,
      current_period_end: currentBillingPeriod?.endsAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);

  // billing_events row is recorded centrally by the POST handler for idempotency.

}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const { id, customerId, items, customData, details } = data;
  const workspaceId = customData?.workspaceId as string | undefined;
  const userId = customData?.userId as string | undefined;
  if (!workspaceId) return;

  const item = items?.[0];
  const priceExtId = item?.price?.importMeta?.externalId as string | undefined;
  const amount = Number(details?.totals?.total ?? 0) / 100;

  // One-time credit pack purchase
  if (priceExtId && PACK_TO_CREDITS[priceExtId]) {
    const credits = PACK_TO_CREDITS[priceExtId];
    await supabaseAdmin.from("credit_grants").insert({
      workspace_id: workspaceId,
      source: `topup:${priceExtId}`,
      amount: credits,
      balance: credits,
      expires_at: null, // never expire
      metadata_json: { paddle_transaction_id: id, environment: env } as never,
    });
    await supabaseAdmin.from("credit_transactions").insert({
      workspace_id: workspaceId,
      user_id: userId ?? null,
      amount: credits,
      reason: `topup:${priceExtId}`,
      metadata_json: { paddle_transaction_id: id } as never,
    });
  }

  await supabaseAdmin.from("invoices").insert({
    workspace_id: workspaceId,
    user_id: userId ?? null,
    amount_usd: amount,
    status: "paid",
    kind: priceExtId && PACK_TO_CREDITS[priceExtId] ? "topup" : "subscription",
    description: priceExtId ?? "Purchase",
    metadata_json: {
      paddle_transaction_id: id,
      paddle_customer_id: customerId,
      environment: env,
    } as never,
  });

  // billing_events row is recorded centrally by the POST handler for idempotency.

}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          const event = await verifyWebhook(request, env);

          // Idempotency: short-circuit if we've already processed this event id.
          const eventId = (event as any).eventId ?? (event as any).notification_id ?? null;
          if (eventId) {
            const { data: existing } = await supabaseAdmin
              .from("billing_events")
              .select("id")
              .eq("external_event_id", eventId)
              .maybeSingle();
            if (existing) {
              return Response.json({ received: true, duplicate: true });
            }
            // Reserve the event id immediately so concurrent retries collide on the unique index.
            const { error: reserveErr } = await supabaseAdmin.from("billing_events").insert({
              provider: "paddle",
              event_type: event.eventType,
              external_event_id: eventId,
              payload_json: event.data as never,
              processed_at: new Date().toISOString(),
            });
            if (reserveErr && /duplicate key|unique/i.test(reserveErr.message)) {
              return Response.json({ received: true, duplicate: true });
            }
          }

          switch (event.eventType) {
            case EventName.SubscriptionCreated:
            case EventName.SubscriptionUpdated:
              await handleSubscriptionCreatedOrUpdated(event.data, env);
              break;
            case EventName.SubscriptionCanceled:
              await handleSubscriptionCanceled(event.data, env);
              break;
            case EventName.TransactionCompleted:
              await handleTransactionCompleted(event.data, env);
              break;
            default:
              console.log("Unhandled Paddle event:", event.eventType);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Paddle webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
