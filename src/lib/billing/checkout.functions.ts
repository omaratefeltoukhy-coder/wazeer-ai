import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLANS, type PlanId } from "./plans";
import { CREDIT_PACKS, getPack } from "./packs";

const PROVIDER = (process.env.BILLING_PROVIDER ?? "mock").toLowerCase();

async function assertOwnerOrAdmin(workspace_id: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || (data.role !== "owner" && data.role !== "admin")) {
    throw new Error("Only workspace owners or admins can manage billing.");
  }
}

async function audit(workspace_id: string, user_id: string | null, action: string, metadata: Record<string, unknown>) {
  await supabaseAdmin.from("audit_logs").insert({
    workspace_id,
    user_id,
    entity: "billing",
    action,
    metadata_json: metadata as never,
  });
}

/** Mock-mode subscription change. In live mode this would create a Stripe/Paddle Checkout Session. */
export const upgradePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspace_id: z.string().uuid(),
    plan: z.enum(["starter", "growth", "pro", "agency"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwnerOrAdmin(data.workspace_id, userId);
    const plan = PLANS[data.plan as PlanId];

    if (PROVIDER !== "mock") {
      // Production hand-off: create a Checkout Session and return its URL.
      throw new Error("Live billing provider not yet configured. Contact support.");
    }

    // Mock: flip the subscription, grant the monthly credits, log an invoice.
    const periodEnd = new Date(); periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    await supabaseAdmin.from("subscriptions").upsert({
      workspace_id: data.workspace_id,
      user_id: userId,
      plan: data.plan,
      status: "active",
      current_period_end: periodEnd.toISOString(),
    } as never, { onConflict: "workspace_id" });

    await supabaseAdmin.from("credit_grants").insert({
      workspace_id: data.workspace_id,
      source: `plan:${data.plan}`,
      amount: plan.credits_per_month,
      balance: plan.credits_per_month,
      expires_at: periodEnd.toISOString(),
      metadata_json: { mock: true } as never,
    });

    const { data: inv } = await supabaseAdmin.from("invoices").insert({
      workspace_id: data.workspace_id,
      user_id: userId,
      amount_usd: plan.price_usd,
      status: "paid",
      kind: "subscription",
      description: `${plan.name} plan — monthly`,
      metadata_json: { mock: true, plan: data.plan } as never,
    }).select("id").single();

    await supabaseAdmin.from("billing_events").insert({
      workspace_id: data.workspace_id,
      provider: "mock",
      event_type: "subscription.upgraded",
      payload_json: { plan: data.plan, invoice_id: inv?.id } as never,
      processed_at: new Date().toISOString(),
    });

    await audit(data.workspace_id, userId, "upgrade_plan", { plan: data.plan, mock: true });
    return { success: true, plan: data.plan, invoice_id: inv?.id, mock: true };
  });

/** Mock-mode credit pack top-up. */
export const topUpCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspace_id: z.string().uuid(),
    pack_id: z.string().min(1).max(64),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwnerOrAdmin(data.workspace_id, userId);
    const pack = getPack(data.pack_id);
    if (!pack) throw new Error("Unknown credit pack.");

    if (PROVIDER !== "mock") {
      throw new Error("Live billing provider not yet configured. Contact support.");
    }

    const totalCredits = Math.round(pack.credits * (1 + (pack.bonus_pct ?? 0) / 100));
    await supabaseAdmin.from("credit_grants").insert({
      workspace_id: data.workspace_id,
      source: `topup:${pack.id}`,
      amount: totalCredits,
      balance: totalCredits,
      metadata_json: { mock: true, pack_id: pack.id } as never,
    });

    await supabaseAdmin.from("credit_transactions").insert({
      workspace_id: data.workspace_id,
      user_id: userId,
      amount: totalCredits,
      reason: `topup:${pack.id}`,
      metadata_json: { mock: true } as never,
    });

    const { data: inv } = await supabaseAdmin.from("invoices").insert({
      workspace_id: data.workspace_id,
      user_id: userId,
      amount_usd: pack.price_usd,
      status: "paid",
      kind: "topup",
      description: `${totalCredits.toLocaleString()} credits top-up`,
      metadata_json: { mock: true, pack_id: pack.id } as never,
    }).select("id").single();

    await audit(data.workspace_id, userId, "topup_credits", { pack_id: pack.id, credits: totalCredits, mock: true });
    return { success: true, credits_added: totalCredits, invoice_id: inv?.id, mock: true };
  });

export const listInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("invoices")
      .select("id, amount_usd, currency, status, description, kind, created_at")
      .eq("workspace_id", data.workspace_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { invoices: rows ?? [], packs: CREDIT_PACKS };
  });
