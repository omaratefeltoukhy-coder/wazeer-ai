import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
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

const entitlementInputSchema = z.object({ workspace_id: z.string().uuid().nullable().optional() });

async function resolveOptionalEntitlementsAuth() {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      console.error("[getEntitlements] Missing backend environment for auth context");
      return null;
    }

    const { getRequest } = await import("@tanstack/react-start/server");
    const authHeader = getRequest()?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return null;

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;

    return { supabase, userId: data.claims.sub };
  } catch (error) {
    console.warn("[getEntitlements] Optional auth resolution failed", error);
    return null;
  }
}

export const getEntitlements = createServerFn({ method: "POST" })
  .inputValidator((input) => {
    const parsed = entitlementInputSchema.safeParse(input);
    return parsed.success ? parsed.data : { workspace_id: null };
  })
  .handler(async ({ data }) => {
    try {
      if (!data.workspace_id) return fallbackEntitlements;

      const authContext = await resolveOptionalEntitlementsAuth();
      if (!authContext) return fallbackEntitlements;

      const { supabase, userId } = authContext;
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
