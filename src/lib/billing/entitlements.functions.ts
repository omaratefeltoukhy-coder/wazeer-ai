import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, type PlanId } from "./plans";
import { getBillingContext } from "./guard.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const fallbackEntitlements = {
  plan: "trial" as const,
  status: "trialing",
  plan_meta: PLANS.trial,
  credits_balance: 0,
  usage: {},
  fallback: true,
};

export const getEntitlements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspace_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context;
      // Verify the caller is a member of this workspace
      const { data: m, error: memberError } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", data.workspace_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (memberError) throw memberError;
      if (!m) return fallbackEntitlements;

      const ctx = await getBillingContext(data.workspace_id);
      const { data: grants, error: grantsError } = await supabaseAdmin
        .from("credit_grants")
        .select("balance, expires_at")
        .eq("workspace_id", data.workspace_id);
      if (grantsError) throw grantsError;
      const balance = (grants ?? []).reduce((acc, g) => {
        const ok = !g.expires_at || new Date(g.expires_at).getTime() > Date.now();
        return acc + (ok ? (g.balance ?? 0) : 0);
      }, 0);

      const periodStart = new Date();
      periodStart.setUTCDate(1);
      periodStart.setUTCHours(0, 0, 0, 0);
      const { data: counters, error: countersError } = await supabaseAdmin
        .from("usage_counters")
        .select("feature, count")
        .eq("workspace_id", data.workspace_id)
        .eq("period_start", periodStart.toISOString().slice(0, 10));
      if (countersError) throw countersError;

      const usage: Record<string, number> = {};
      (counters ?? []).forEach((c) => { usage[c.feature] = c.count; });

      return {
        plan: ctx.plan,
        status: ctx.status,
        plan_meta: PLANS[ctx.plan as PlanId],
        credits_balance: balance,
        usage,
        fallback: false,
      };
    } catch (error) {
      console.error("[getEntitlements] Falling back after entitlement load failed", error);
      return fallbackEntitlements;
    }
  });
