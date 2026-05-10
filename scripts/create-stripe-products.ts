/**
 * One-time script to create Stripe products & prices for Wazeer plans and credit packs.
 *
 * Run:
 *   npx tsx scripts/create-stripe-products.ts
 *
 * Requires STRIPE_SECRET_KEY in .env
 */
import "dotenv/config";
import Stripe from "stripe";
import { PLANS } from "../src/lib/billing/plans";
import { CREDIT_PACKS } from "../src/lib/billing/packs";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY in .env");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2025-04-30.basil" as any });

async function createPlanProducts() {
  const planIds = ["starter", "growth", "pro", "agency"] as const;

  for (const id of planIds) {
    const plan = PLANS[id];
    const productName = `Wazeer ${plan.name}`;
    const priceCents = plan.price_usd * 100;

    // Check if product already exists by metadata
    const existing = await stripe.products.list({ limit: 100 });
    const found = existing.data.find(
      (p) => p.metadata?.wazeer_plan_id === id
    );

    let product: Stripe.Product;
    if (found) {
      product = found;
      console.log(`[plan] Product exists: ${product.name} (${product.id})`);
    } else {
      product = await stripe.products.create({
        name: productName,
        description: `${plan.credits_per_month.toLocaleString()} credits/mo — ${plan.features.join(", ")}`,
        metadata: {
          wazeer_plan_id: id,
          credits_per_month: String(plan.credits_per_month),
        },
      });
      console.log(`[plan] Created product: ${product.name} (${product.id})`);
    }

    // Check for existing recurring price
    const prices = await stripe.prices.list({ product: product.id, limit: 100 });
    const recurring = prices.data.find(
      (p) => p.recurring?.interval === "month" && p.unit_amount === priceCents
    );

    if (recurring) {
      console.log(`  → Price exists: ${recurring.id}`);
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceCents,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { wazeer_plan_id: id },
      });
      console.log(`  → Created price: ${price.id}`);
    }
  }
}

async function createPackProducts() {
  for (const pack of CREDIT_PACKS) {
    const productName = `Wazeer Credit Pack — ${pack.credits.toLocaleString()} credits`;
    const priceCents = Math.round(pack.price_usd * 100);
    const totalCredits = pack.bonus_pct
      ? Math.round(pack.credits * (1 + pack.bonus_pct / 100))
      : pack.credits;

    const existing = await stripe.products.list({ limit: 100 });
    const found = existing.data.find(
      (p) => p.metadata?.wazeer_pack_id === pack.id
    );

    let product: Stripe.Product;
    if (found) {
      product = found;
      console.log(`[pack] Product exists: ${product.name} (${product.id})`);
    } else {
      product = await stripe.products.create({
        name: productName,
        description: `${totalCredits.toLocaleString()} total credits${pack.bonus_pct ? ` (includes ${pack.bonus_pct}% bonus)` : ""}`,
        metadata: {
          wazeer_pack_id: pack.id,
          credits: String(totalCredits),
        },
      });
      console.log(`[pack] Created product: ${product.name} (${product.id})`);
    }

    const prices = await stripe.prices.list({ product: product.id, limit: 100 });
    const oneTime = prices.data.find(
      (p) => !p.recurring && p.unit_amount === priceCents
    );

    if (oneTime) {
      console.log(`  → Price exists: ${oneTime.id}`);
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceCents,
        currency: "usd",
        metadata: { wazeer_pack_id: pack.id },
      });
      console.log(`  → Created price: ${price.id}`);
    }
  }
}

async function main() {
  console.log("Creating Stripe products…\n");
  await createPlanProducts();
  console.log("");
  await createPackProducts();
  console.log("\nDone! Copy the Price IDs above into your .env or code as needed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
