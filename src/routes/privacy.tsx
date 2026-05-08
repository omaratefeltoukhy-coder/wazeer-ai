import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/wazeer/Navbar";
import { Footer } from "@/components/wazeer/Footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — Wazeer AI" },
      { name: "description", content: "How Wazeer AI collects, uses, and protects your personal data." },
      { property: "og:title", content: "Privacy Notice — Wazeer AI" },
      { property: "og:description", content: "How Wazeer AI collects, uses, and protects your personal data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Privacy Notice</h1>
          <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

          <h2>1. Who we are</h2>
          <p>
            This Privacy Notice is issued by <strong>Wazeer AI</strong> ("Wazeer AI", "we", "us", or "our"),
            the controller of personal data collected through our website and services. If you have questions
            about this notice or how we handle your data, contact us at{" "}
            <a href="mailto:privacy@wazeer.ai">privacy@wazeer.ai</a>.
          </p>

          <h2>2. Personal data we collect</h2>
          <ul>
            <li><strong>Account data:</strong> name, email address, login credentials.</li>
            <li><strong>Profile and business data:</strong> business name, brand, products, content you create with the service.</li>
            <li><strong>Support communications:</strong> messages you send us and our replies.</li>
            <li><strong>Usage and telemetry:</strong> pages visited, features used, errors, performance data.</li>
            <li><strong>Device and connection data:</strong> IP address, browser type, device identifiers, approximate location.</li>
            <li><strong>Billing data:</strong> processed by our payment provider (Paddle); we receive transaction metadata such as plan, amount, and country.</li>
          </ul>

          <h2>3. How we use your data</h2>
          <ul>
            <li>To create and maintain your account and provide the service.</li>
            <li>To generate AI content you request (storefronts, ads, emails, images, video).</li>
            <li>To process subscriptions and entitlements.</li>
            <li>To prevent fraud, abuse, and to keep the service secure.</li>
            <li>To improve our product and fix bugs.</li>
            <li>To respond to support requests.</li>
            <li>To send service-related and, where permitted, marketing communications.</li>
          </ul>

          <h2>4. Legal bases</h2>
          <p>We rely on the following legal bases under applicable data protection laws:</p>
          <ul>
            <li><strong>Performance of a contract</strong> — to provide the service you signed up for.</li>
            <li><strong>Legitimate interests</strong> — security, fraud prevention, product improvement.</li>
            <li><strong>Consent</strong> — for optional analytics, marketing, and cookies where required.</li>
            <li><strong>Legal obligation</strong> — tax, accounting, and regulatory compliance.</li>
          </ul>

          <h2>5. How we share your data</h2>
          <p>We share personal data only with:</p>
          <ul>
            <li><strong>Service providers / subprocessors</strong> — hosting, database, AI inference, email delivery, analytics, and customer support tooling, all bound by contract.</li>
            <li><strong>Merchant of Record (Paddle)</strong> — Paddle.com Market Limited acts as the reseller and Merchant of Record for all our orders. Paddle handles payments, billing, subscription management, sales tax, invoicing, and refunds. See <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">Paddle's privacy notice</a>.</li>
            <li><strong>Professional advisers</strong> — legal, accounting, and audit firms, where necessary.</li>
            <li><strong>Authorities</strong> — where required by law, court order, or to protect our rights.</li>
          </ul>
          <p>We do not sell your personal data.</p>

          <h2>6. International transfers</h2>
          <p>
            Your data may be processed outside your country of residence, including in the United States and the
            European Economic Area. Where required, we use appropriate safeguards such as Standard Contractual
            Clauses or rely on adequacy decisions.
          </p>

          <h2>7. Data retention</h2>
          <p>
            We keep personal data only as long as necessary for the purposes described above, to comply with legal
            obligations (e.g. tax records), and to resolve disputes. Account data is deleted or anonymised within
            a reasonable period after you close your account.
          </p>

          <h2>8. Your rights</h2>
          <p>Depending on where you live, you may have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction or deletion.</li>
            <li>Restrict or object to certain processing.</li>
            <li>Receive a portable copy of your data.</li>
            <li>Withdraw consent at any time.</li>
            <li>Lodge a complaint with your local supervisory authority.</li>
          </ul>
          <p>
            To exercise these rights, email <a href="mailto:privacy@wazeer.ai">privacy@wazeer.ai</a>. We aim to
            respond within one month.
          </p>

          <h2>9. Security</h2>
          <p>
            We use appropriate technical and organisational measures including encryption in transit, access
            controls, audit logging, and least-privilege access to protect your data. No system is perfectly
            secure, and we cannot guarantee absolute security.
          </p>

          <h2>10. Cookies</h2>
          <p>
            We use essential cookies to keep you signed in and to operate the service. We may use limited
            analytics cookies to understand product usage. Where required by law, we ask for consent before
            setting non-essential cookies. You can manage cookie preferences in your browser.
          </p>

          <h2>11. Children</h2>
          <p>The service is not directed to children under 16, and we do not knowingly collect their data.</p>

          <h2>12. Changes</h2>
          <p>
            We may update this notice. Material changes will be communicated via the service or by email. The
            "Last updated" date above reflects the latest version.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
