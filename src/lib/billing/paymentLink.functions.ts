import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Create a Paddle hosted-checkout transaction for an arbitrary payment link.
 * Returns the hosted checkout URL the buyer should be redirected to.
 *
 * No auth required: the caller is the public buyer landing on /pay/$code.
 * Trust comes from looking up the link by `unique_code` (server-side) and
 * using the link's stored amount/currency — never values from the client.
 */
export const createPaymentLinkCheckout = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      code: z.string().min(1).max(64),
      environment: z.enum(["sandbox", "live"]),
      buyer_email: z.string().email().optional(),
      buyer_name: z.string().max(200).optional(),
      buyer_phone: z.string().max(40).optional(),
      return_url: z.string().url().optional(),
    }).parse(i)
  )
  .handler(async ({ data }) => {
    // Look up the link via the SECURITY DEFINER RPC so the server-side query
    // matches the rules used by the public page.
    const { data: linkRow, error: lookupErr } = await supabaseAdmin.rpc(
      "get_public_payment_link",
      { _code: data.code }
    );
    if (lookupErr) throw new Error(`Link lookup failed: ${lookupErr.message}`);
    const link = Array.isArray(linkRow) ? linkRow[0] : linkRow;
    if (!link) throw new Error("This payment link is paused or doesn't exist.");

    const baseAmount = Number(link.amount);
    if (!(baseAmount > 0)) throw new Error("Invalid link amount.");
    const fee = link.pass_fee_to_buyer ? baseAmount * 0.03 : 0;
    const total = baseAmount + fee;
    // Paddle expects amount as minor units string.
    const amountMinor = Math.round(total * 100).toString();

    const title = link.custom_title ?? "Payment";
    const description = (link.description ?? `Payment via link ${data.code}`).slice(0, 500);

    // Non-catalog item — Paddle accepts a `price` with embedded `product`.
    // No need to create or reuse a catalog product for arbitrary one-off sales.
    const body = {
      items: [
        {
          quantity: 1,
          price: {
            description: description,
            name: title.slice(0, 200),
            tax_mode: "account_setting",
            unit_price: { amount: amountMinor, currency_code: link.currency },
            quantity: { minimum: 1, maximum: 1 },
            product: {
              name: title.slice(0, 200),
              tax_category: "standard",
              description: description,
            },
          },
        },
      ],
      collection_mode: "automatic",
      custom_data: {
        kind: "payment_link",
        paymentLinkCode: data.code,
        paymentLinkId: link.id,
        workspaceId: link.workspace_id,
        productId: link.product_id ?? null,
        buyerName: data.buyer_name ?? null,
        buyerPhone: data.buyer_phone ?? null,
      },
      // Paddle redirects buyer to this URL after successful payment with
      // `?_ptxn=txn_...` appended. Required so the thanks page can confirm.
      checkout: data.return_url ? { url: data.return_url } : { url: null },
      ...(data.buyer_email ? { customer: { email: data.buyer_email } } : {}),
    };

    const res = await gatewayFetch(data.environment as PaddleEnv, "/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { data?: { id: string; checkout?: { url?: string } }; error?: unknown };
    if (!res.ok || !json.data?.checkout?.url) {
      console.error("[createPaymentLinkCheckout] Paddle error", json);
      throw new Error("Could not start checkout. Please try again in a moment.");
    }

    return { url: json.data.checkout.url, transactionId: json.data.id };
  });
