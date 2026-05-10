import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createStripeCheckoutSession,
  createStripeSubscriptionSession,
} from "./stripe.server";

export const startStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        lineItems: z.array(z.any()),
        customerEmail: z.string().email().optional(),
        metadata: z.record(z.string()).optional(),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
      .parse(i)
  )
  .handler(async ({ data }) => {
    const session = await createStripeCheckoutSession({
      lineItems: data.lineItems as any,
      customerEmail: data.customerEmail,
      metadata: data.metadata,
      successUrl: data.successUrl,
      cancelUrl: data.cancelUrl,
    });
    return { sessionId: session.id, url: session.url };
  });

export const startStripeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        priceId: z.string().min(1),
        customerEmail: z.string().email().optional(),
        metadata: z.record(z.string()).optional(),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
      .parse(i)
  )
  .handler(async ({ data }) => {
    const session = await createStripeSubscriptionSession({
      priceId: data.priceId,
      customerEmail: data.customerEmail,
      metadata: data.metadata,
      successUrl: data.successUrl,
      cancelUrl: data.cancelUrl,
    });
    return { sessionId: session.id, url: session.url };
  });

export const createStripePortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ workspace_id: z.string().uuid() }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: member } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("Only owners or admins can manage billing.");
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("workspace_id", data.workspace_id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      throw new Error("No active subscription found.");
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-04-30.basil" as any,
    });

    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${process.env.SITE_URL || "http://localhost:3000"}/dashboard/billing`,
    });

    return { url: portal.url };
  });
