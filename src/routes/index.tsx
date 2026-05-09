import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/wazeer/Navbar";
import { Hero } from "@/components/wazeer/Hero";
import { HowItWorks } from "@/components/wazeer/HowItWorks";
import { Features } from "@/components/wazeer/Features";
import { Pricing } from "@/components/wazeer/Pricing";
import { FAQ } from "@/components/wazeer/FAQ";
import { SuccessStories } from "@/components/wazeer/SuccessStories";
import { CTA } from "@/components/wazeer/CTA";
import { Footer } from "@/components/wazeer/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wazeer — Your AI growth partner for selling online" },
      {
        name: "description",
        content:
          "Wazeer builds your offer, storefront, images, UGC videos, emails, Meta posts, and ads from one simple input.",
      },
      { property: "og:title", content: "Wazeer — Turn one idea into a selling machine" },
      { property: "og:description", content: "From product idea to live store, ads, emails, and dashboard — built by AI." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <HowItWorks />
      <SuccessStories />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
