import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/wazeer/Navbar";
import { Footer } from "@/components/wazeer/Footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions â€” Wazeer" },
      { name: "description", content: "The terms governing your use of Wazeer." },
      { property: "og:title", content: "Terms & Conditions â€” Wazeer" },
      { property: "og:description", content: "The terms governing your use of Wazeer." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Terms &amp; Conditions</h1>
          <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

          <h2>1. Who you are contracting with</h2>
          <p>
            These Terms &amp; Conditions ("Terms") are a binding agreement between you and{" "}
            <strong>Wazeer</strong> ("Wazeer", "we", "us", or "our"). By creating an account, accessing,
            or using our website and services (the "Service"), you agree to these Terms. If you do not agree,
            do not use the Service.
          </p>

          <h2>2. The Service</h2>
          <p>
            Wazeer is an AI-powered platform that helps users create storefronts, marketing content,
            advertisements, emails, images, and video for selling products online. Specific features may
            change as we improve the Service.
          </p>

          <h2>3. Eligibility and accounts</h2>
          <p>
            You must be at least 18 years old (or the age of majority in your jurisdiction) and have authority
            to bind any organisation you represent. You are responsible for keeping your credentials confidential
            and for all activity under your account. You must provide accurate information and keep it up to date.
          </p>

          <h2>4. Acceptable use</h2>
          <p>You must not:</p>
          <ul>
            <li>Use the Service for any unlawful, fraudulent, or harmful purpose.</li>
            <li>Send spam, scrape, probe, or interfere with the Service or its security.</li>
            <li>Upload malware or infringe anyone's intellectual property or privacy.</li>
            <li>Reverse engineer, resell, or redistribute the Service or circumvent technical limits.</li>
            <li>Generate prohibited AI content, including illegal content, deepfakes of real people without consent, hate speech, sexual content involving minors, harassment, or content designed to deceive or defraud.</li>
            <li>Attempt to jailbreak, manipulate, or extract proprietary prompts or model behaviour.</li>
          </ul>

          <h2>5. AI-generated content</h2>
          <p>
            You are responsible for your prompts, the inputs you provide, your use of outputs, and for
            verifying their accuracy and lawfulness. You must have the rights to any content you upload.
            AI outputs may be inaccurate, biased, or unsuitable for regulated decisions and should not be
            relied on as professional, legal, financial, or medical advice without independent review. We
            may filter, restrict, refuse, or remove outputs that violate these Terms or our policies. As
            between you and Wazeer, you retain rights to your inputs and, subject to these Terms, to
            outputs you generate; we may use de-identified usage data to improve the Service. Rights-holders
            may submit takedown requests to <a href="mailto:legal@wazeer.ai">legal@wazeer.ai</a>; repeat or
            serious infringers will be terminated.
          </p>

          <h2>6. Intellectual property</h2>
          <p>
            We retain all rights, title, and interest in the Service, including software, models, branding,
            documentation, and trademarks. We grant you a limited, non-exclusive, non-transferable, revocable
            licence to use the Service in accordance with your subscription plan and these Terms. You retain
            ownership of your content and grant us a limited licence to host, process, and display it solely
            to provide the Service.
          </p>

          <h2>7. Payments, subscriptions, and refunds</h2>
          <p>
            Our order process is conducted by our online reseller <strong>Paddle.com</strong>. Paddle.com is
            the Merchant of Record for all our orders. Paddle provides all customer service inquiries and
            handles returns. Payment, billing, tax, cancellation, and refund mechanics are governed by{" "}
            <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">Paddle's Buyer Terms</a>{" "}
            and our <a href="/refunds">Refund Policy</a>. Subscriptions renew automatically until cancelled.
            Fees are exclusive of taxes where applicable. You authorise Paddle to charge your selected
            payment method on each renewal.
          </p>

          <h2>8. Service availability and warranties</h2>
          <p>
            The Service is provided "as is" and "as available". We do not warrant that the Service will be
            uninterrupted, timely, secure, or error-free, or that AI outputs will meet your requirements.
            To the fullest extent permitted by law, we disclaim all implied warranties including merchantability,
            fitness for a particular purpose, and non-infringement.
          </p>

          <h2>9. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, our aggregate liability arising out of or relating to the
            Service is limited to the fees you paid us in the 12 months preceding the event giving rise to the
            claim. We are not liable for indirect, incidental, special, consequential, or punitive damages,
            including loss of profits, revenue, data, or goodwill. Nothing limits liability for fraud, death,
            or personal injury caused by negligence, or other liability that cannot be excluded by law.
          </p>

          <h2>10. Indemnity</h2>
          <p>
            You will defend and indemnify us against claims arising from your content, your use of outputs,
            your violation of these Terms, or your violation of law or third-party rights.
          </p>

          <h2>11. Suspension and termination</h2>
          <p>
            We may suspend or terminate your access immediately for material breach of these Terms,
            non-payment, suspected fraud, security risk, or repeated or serious policy violations. You may
            cancel your subscription at any time through your account or via Paddle. On termination, your
            right to use the Service ends; we may delete your data after a reasonable export window unless
            we are required to retain it.
          </p>

          <h2>12. Changes to the Service or Terms</h2>
          <p>
            We may modify the Service and these Terms from time to time. Material changes will be communicated
            via the Service or by email and take effect on the date stated. Continued use after changes
            constitutes acceptance.
          </p>

          <h2>13. Governing law and disputes</h2>
          <p>
            These Terms are governed by the laws of the jurisdiction where Wazeer is established, without
            regard to conflict-of-laws rules. Disputes will be brought in the competent courts of that
            jurisdiction, unless mandatory consumer law provides otherwise.
          </p>

          <h2>14. Miscellaneous</h2>
          <p>
            You may not assign these Terms without our consent. We may assign them in connection with a
            merger, acquisition, or sale of assets. If any provision is unenforceable, the rest remain in
            effect. Our failure to enforce any right is not a waiver. We are not liable for delays or failures
            due to events beyond our reasonable control (force majeure).
          </p>

          <h2>15. Contact</h2>
          <p>
            Questions about these Terms? Email <a href="mailto:legal@wazeer.ai">legal@wazeer.ai</a>.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
