import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CREDIT_COST, PLANS, planCap, planHas, type Feature, type PlanId } from "./plans";

export type BillingContext = {
  workspace_id: string;
  plan: PlanId;
  status: string;
};

export async function getBillingContext(workspace_id: string): Promise<BillingContext> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, status")
    .eq("workspace_id", workspace_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    workspace_id,
    plan: ((data?.plan as PlanId) ?? "trial") as PlanId,
    status: data?.status ?? "trialing",
  };
}

export async function requireEntitlement(workspace_id: string, feature: Feature): Promise<void> {
  const ctx = await getBillingContext(workspace_id);
  if (!planHas(ctx.plan, feature)) {
    throw new Error(`Your ${PLANS[ctx.plan].name} plan doesn't include ${feature.replace(/_/g, " ")}. Upgrade to unlock.`);
  }
}

export async function checkUsageCap(workspace_id: string, feature: Feature): Promise<void> {
  const ctx = await getBillingContext(workspace_id);
  const cap = planCap(ctx.plan, feature);
  if (cap == null) return;
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const { data } = await supabaseAdmin
    .from("usage_counters")
    .select("count")
    .eq("workspace_id", workspace_id)
    .eq("feature", feature)
    .eq("period_start", periodStart.toISOString().slice(0, 10))
    .maybeSingle();
  if ((data?.count ?? 0) >= cap) {
    throw new Error(`You've hit your ${PLANS[ctx.plan].name} limit for ${feature.replace(/_/g, " ")} this month. Upgrade for more.`);
  }
}

export async function consumeCredits(workspace_id: string, action: keyof typeof CREDIT_COST, metadata: Record<string, unknown> = {}): Promise<void> {
  const amount = CREDIT_COST[action] ?? 0;
  if (amount <= 0) return;
  const { data, error } = await supabaseAdmin.rpc("consume_credits", {
    _workspace_id: workspace_id,
    _amount: amount,
    _reason: action,
    _metadata: metadata,
  });
  if (error) throw new Error(`Credit deduction failed: ${error.message}`);
  if (!data) throw new Error("Not enough credits. Top up or upgrade your plan to continue.");
}

export async function refundCredits(workspace_id: string, action: keyof typeof CREDIT_COST, metadata: Record<string, unknown> = {}): Promise<void> {
  const amount = CREDIT_COST[action] ?? 0;
  if (amount <= 0) return;
  // Add a fresh adjustment grant so the balance is restored.
  await supabaseAdmin.from("credit_grants").insert({
    workspace_id,
    source: "refund",
    amount,
    balance: amount,
    metadata_json: { action, ...metadata } as never,
  });
  await supabaseAdmin.from("credit_transactions").insert({
    workspace_id,
    amount,
    reason: `refund:${action}`,
    metadata_json: metadata as never,
  });
}

export async function incrementUsage(workspace_id: string, feature: Feature, by = 1): Promise<void> {
  await supabaseAdmin.rpc("increment_usage", { _workspace_id: workspace_id, _feature: feature, _by: by });
}
