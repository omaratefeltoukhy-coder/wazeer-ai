import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  consumeCredits,
  refundCredits,
  requireEntitlement,
  checkUsageCap,
  incrementUsage,
} from "@/lib/billing/guard.server";
import { loadWorkspaceId } from "./context";
import type { Feature } from "@/lib/billing/plans";
import type { CREDIT_COST } from "@/lib/billing/plans";

export async function withBillingGuard<T>(
  supabase: SupabaseClient<Database>,
  business_id: string,
  options: {
    feature: Feature;
    creditAction: keyof typeof CREDIT_COST;
    metadata?: Record<string, unknown>;
  },
  fn: () => Promise<T>
): Promise<T> {
  const workspace_id = await loadWorkspaceId(supabase, business_id);
  return withWorkspaceBillingGuard(workspace_id, {
    ...options,
    metadata: { business_id, ...options.metadata },
  }, fn);
}

export async function withWorkspaceBillingGuard<T>(
  workspace_id: string,
  options: {
    feature: Feature;
    creditAction: keyof typeof CREDIT_COST;
    metadata?: Record<string, unknown>;
  },
  fn: () => Promise<T>
): Promise<T> {
  await requireEntitlement(workspace_id, options.feature);
  await checkUsageCap(workspace_id, options.feature);
  await consumeCredits(workspace_id, options.creditAction, options.metadata ?? {});

  try {
    const result = await fn();
    await incrementUsage(workspace_id, options.feature);
    return result;
  } catch (err) {
    await refundCredits(workspace_id, options.creditAction, {
      reason: "handler_error",
      ...options.metadata,
    });
    throw err;
  }
}
