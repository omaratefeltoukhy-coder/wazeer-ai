// Stripe server-side utilities — UAE-friendly alternative to Paddle
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured in .env");
  return new Stripe(key);
}

export type StripeLineItem =
  | { price: string; quantity: number }
  | {
      price_data: {
        currency: string;
        product_data: { name: string; description?: string };
        unit_amount: number;
      };
      quantity: number;
    };

export async function createStripeCheckoutSession(
  opts: {
    lineItems: StripeLineItem[];
    customerEmail?: string;
    metadata?: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
  }
) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: opts.lineItems as any,
    customer_email: opts.customerEmail,
    metadata: opts.metadata,
    mode: "payment",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
  return session;
}

export async function createStripeSubscriptionSession(
  opts: {
    priceId: string;
    customerEmail?: string;
    metadata?: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
  }
) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [{ price: opts.priceId, quantity: 1 }],
    customer_email: opts.customerEmail,
    metadata: opts.metadata,
    mode: "subscription",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
  return session;
}

export async function constructStripeEvent(
  payload: string,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
