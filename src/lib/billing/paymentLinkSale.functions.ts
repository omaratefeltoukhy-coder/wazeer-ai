import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Public confirmation lookup for a payment-link sale. Used by the
 * /pay/$code/thanks page after Paddle redirects the buyer back. No auth
 * required — only returns sanitized fields tied to this code+transaction.
 */
export const getPaymentLinkSale = createServerFn({ method: "GET" })
  .inputValidator((i) =>
    z.object({
      code: z.string().min(1).max(64),
      transaction_id: z.string().min(1).max(100).optional(),
    }).parse(i)
  )
  .handler(async ({ data }) => {
    // Public link metadata (uses SECURITY DEFINER RPC).
    const { data: linkRow } = await supabaseAdmin.rpc("get_public_payment_link", {
      _code: data.code,
    });
    const link = Array.isArray(linkRow) ? linkRow[0] : linkRow;
    if (!link) {
      return { found: false as const, link: null, sale: null };
    }

    // Look for a webhook-recorded invoice tied to this code (and txn id, if known).
    let q = supabaseAdmin
      .from("invoices")
      .select("amount_usd, currency, status, created_at, metadata_json")
      .eq("workspace_id", link.workspace_id)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1);

    if (data.transaction_id) {
      q = q.filter("metadata_json->>paddle_transaction_id", "eq", data.transaction_id);
    } else {
      q = q.filter("metadata_json->>payment_link_code", "eq", data.code);
    }

    const { data: invoice } = await q.maybeSingle();

    return {
      found: true as const,
      link: {
        title: link.custom_title ?? "Payment",
        description: link.description,
        thank_you_message: link.thank_you_message,
        redirect_url: link.redirect_url,
        currency: link.currency,
        amount: Number(link.amount),
      },
      sale: invoice
        ? {
            amount: Number(invoice.amount_usd),
            currency: (invoice.metadata_json as { currency?: string } | null)?.currency ?? "USD",
            paid_at: invoice.created_at,
          }
        : null,
    };
  });
