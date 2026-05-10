import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startStripeCheckout, startStripeSubscription } from "@/lib/billing/stripe-checkout.functions";

export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);
  const checkout = useServerFn(startStripeCheckout);
  const subscribe = useServerFn(startStripeSubscription);

  const openCheckout = async (options: {
    priceId: string;
    customerEmail?: string;
    customData?: Record<string, string>;
    mode?: "payment" | "subscription";
    successUrl?: string;
    cancelUrl?: string;
  }) => {
    setLoading(true);
    try {
      const successUrl = options.successUrl || `${window.location.origin}/dashboard/billing?checkout=success`;
      const cancelUrl = options.cancelUrl || `${window.location.origin}/dashboard/billing?checkout=cancel`;

      if (options.mode === "subscription") {
        const res = await subscribe({
          data: {
            priceId: options.priceId,
            customerEmail: options.customerEmail,
            metadata: options.customData,
            successUrl,
            cancelUrl,
          },
        });
        window.location.href = res.url!;
      } else {
        const res = await checkout({
          data: {
            lineItems: [{ price: options.priceId, quantity: 1 }],
            customerEmail: options.customerEmail,
            metadata: options.customData,
            successUrl,
            cancelUrl,
          },
        });
        window.location.href = res.url!;
      }
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
