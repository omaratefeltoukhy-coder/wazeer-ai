import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createPaymentLinkCheckout = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      code: z.string().min(1),
      buyerEmail: z.string().email(),
      buyerName: z.string().min(1).max(200),
      buyerPhone: z.string().max(50).optional(),
      environment: z.enum(["sandbox", "live"]),
    }).parse(i)
  )
  .handler(async ({ data }) => {
    const env = data.environment;

    // Look up the payment link (must be active)
    const { data: link, error: linkErr } = await supabaseAdmin
      .from("payment_links")
      .select(
        "id, workspace_id, product_id, amount, currency, custom_title, description, unique_code, pass_fee_to_buyer"
      )
      .eq("unique_code", data.code)
      .eq("is_active", true)
      .maybeSingle();

    if (linkErr) {
      console.error("[payment-link] lookup error:", linkErr);
      throw new Error("Failed to load payment link");
    }
    if (!link) {
      throw new Error("Payment link not found or inactive");
    }

    // Calculate total with optional fee passthrough
    const fee = link.pass_fee_to_buyer ? Math.round(link.amount * 0.03 * 100) : 0;
    const totalCents = Math.round(link.amount * 100) + fee;

    // Create Paddle transaction with an inline price
    const response = await gatewayFetch(env, "/transactions", {
      method: "POST",
      body: JSON.stringify({
        data: {
          items: [
            {
              price: {
                description: link.custom_title || "Payment",
                unitPrice: {
                  amount: String(totalCents),
                  currencyCode: link.currency,
                },
                product: {
                  name: link.custom_title || "Payment",
                  taxCategory: "standard",
                },
              },
              quantity: 1,
            },
          ],
          customer: {
            email: data.buyerEmail,
            name: data.buyerName,
          },
          customData: {
            payment_link_code: data.code,
            buyer_name: data.buyerName,
            buyer_phone: data.buyerPhone || null,
            buyer_email: data.buyerEmail,
            workspace_id: link.workspace_id,
            product_id: link.product_id,
          },
        },
      }),
    });

    if (!response.ok) {
      let detail = "Paddle transaction creation failed";
      try {
        const errBody = await response.json();
        detail = errBody.error?.detail || JSON.stringify(errBody);
      } catch {
        detail = `${detail} (HTTP ${response.status})`;
      }
      console.error("[payment-link] Paddle error:", detail);
      throw new Error(detail);
    }

    const result = await response.json();
    const transactionId = result.data?.id;
    if (!transactionId) {
      throw new Error("Paddle did not return a transaction ID");
    }

    return { transactionId };
  });
