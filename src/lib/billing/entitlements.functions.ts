import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, type PlanId } from "./plans";
import { getBillingContext } from "./guard.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getEntitlements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspace_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify the caller is a member of this workspace
    const { data: m } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!m) throw new Error("Not a member of this workspace");

    const ctx = await getBillingContext(data.workspace_id);
    const { data: grants } = await supabaseAdmin
      .from("credit_grants")
      .select("balance, expires_at")
      .eq("workspace_id", data.workspace_id);
    const balance = (grants ?? []).reduce((acc, g) => {
      const ok = !g.expires_at || new Date(g.expires_at).getTime() > Date.now();
      return acc + (ok ? (g.balance ?? 0) : 0);
    }, 0);

    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const { data: counters } = await supabaseAdmin
      .from("usage_counters")
      .select("feature, count")
      .eq("workspace_id", data.workspace_id)
      .eq("period_start", periodStart.toISOString().slice(0, 10));

    const usage: Record<string, number> = {};
    (counters ?? []).forEach((c) => { usage[c.feature] = c.count; });

    return {
      plan: ctx.plan,
      status: ctx.status,
      plan_meta: PLANS[ctx.plan as PlanId],
      credits_balance: balance,
      usage,
    };
  });
