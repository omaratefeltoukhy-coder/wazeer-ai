import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/wazeer/Navbar";
import { Footer } from "@/components/wazeer/Footer";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy â€” Wazeer" },
      { name: "description", content: "Wazeer's 30-day money-back guarantee and how to request a refund." },
      { property: "og:title", content: "Refund Policy â€” Wazeer" },
      { property: "og:description", content: "Wazeer's 30-day money-back guarantee and how to request a refund." },
    ],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Refund Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

          <h2>30-day money-back guarantee</h2>
          <p>
            <strong>Wazeer</strong> offers a <strong>30-day money-back guarantee</strong>. If you are not
            satisfied with your purchase, you can request a full refund within 30 days of your order date.
          </p>

          <h2>How to request a refund</h2>
          <p>
            Refunds are processed by our payment provider and Merchant of Record, <strong>Paddle</strong>. To
            request a refund:
          </p>
          <ul>
            <li>
              Visit <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a> and
              look up your order using the email address you used at checkout, or
            </li>
            <li>
              Email our team at <a href="mailto:support@wazeer.ai">support@wazeer.ai</a> and we will help you
              process the refund.
            </li>
          </ul>
          <p>
            Please include your order ID or the email address used at checkout so we can locate the
            transaction quickly.
          </p>

          <h2>Processing time</h2>
          <p>
            Once approved, refunds are returned to the original payment method. Depending on your bank or
            card issuer, it can take 5â€“10 business days for the funds to appear.
          </p>

          <h2>Subscription cancellations</h2>
          <p>
            You can cancel a subscription at any time from your account or via{" "}
            <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a>.
            Cancelling stops future renewals; you keep access until the end of the current billing period.
            Refunds for a cancelled subscription are subject to this policy and the{" "}
            <a href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noopener noreferrer">Paddle Refund Policy</a>.
          </p>

          <h2>Questions</h2>
          <p>
            For anything refund-related, email <a href="mailto:support@wazeer.ai">support@wazeer.ai</a>.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
