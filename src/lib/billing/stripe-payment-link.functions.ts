import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createStripeCheckoutSession } from "./stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createStripePaymentLinkCheckout = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        code: z.string().min(1),
        buyerEmail: z.string().email(),
        buyerName: z.string().min(1).max(200),
        buyerPhone: z.string().max(50).optional(),
      })
      .parse(i)
  )
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin();

    const { data: link, error } = await supabase
      .from("payment_links")
      .select("*")
      .eq("code", data.code)
      .eq("active", true)
      .single();

    if (error || !link) {
      throw new Error("Payment link not found or inactive");
    }

    const amount = Number(link.amount);
    const fee = link.include_fee ? Math.round(amount * 0.03 * 100) / 100 : 0;
    const totalCents = Math.round((amount + fee) * 100);

    const session = await createStripeCheckoutSession({
      lineItems: [
        {
          price_data: {
            currency: link.currency.toLowerCase() || "usd",
            product_data: { name: link.title, description: link.description || undefined },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      customerEmail: data.buyerEmail,
      metadata: {
        payment_link_code: data.code,
        buyer_name: data.buyerName,
        buyer_phone: data.buyerPhone || "",
      },
      successUrl: `${process.env.SITE_URL || "http://localhost:3000"}/pay/${data.code}?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.SITE_URL || "http://localhost:3000"}/pay/${data.code}?status=cancel`,
    });

    return { sessionId: session.id, url: session.url };
  });
