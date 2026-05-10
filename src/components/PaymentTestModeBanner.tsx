import { isStripeTestMode } from "@/lib/billing/stripe.server";

export function PaymentTestModeBanner() {
  if (!isStripeTestMode()) return null;
  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
      All payments are in Stripe test mode.{" "}
      <a
        href="https://stripe.com/docs/testing"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-medium"
      >
        Read more
      </a>
    </div>
  );
}
