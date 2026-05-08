import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getEntitlements } from "@/lib/billing/entitlements.functions";
import type { Feature, PlanId, Plan } from "@/lib/billing/plans";
import { planHas } from "@/lib/billing/plans";

export type Entitlements = {
  plan: PlanId;
  status: string;
  plan_meta: Plan;
  credits_balance: number;
  usage: Record<string, number>;
};

const FRIENDLY_ERROR =
  "We couldn't load your plan details right now. Some features may be limited.";

async function describeError(e: unknown): Promise<string> {
  if (e instanceof Response) {
    try {
      const txt = await e.text();
      return `${e.status} ${e.statusText}${txt ? `: ${txt}` : ""}`;
    } catch {
      return `${e.status} ${e.statusText}`;
    }
  }
  return e instanceof Error ? e.message : String(e);
}

export function useEntitlements() {
  const [data, setData] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchEnt = useServerFn(getEntitlements);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setData(null);
        setError(null);
        return;
      }
      const { data: m, error: mErr } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .limit(1)
        .maybeSingle();
      if (mErr) {
        const detail = await describeError(mErr);
        console.error("[useEntitlements] workspace lookup failed:", detail, mErr);
        setData(null);
        setError(FRIENDLY_ERROR);
        return;
      }
      if (!m) {
        setData(null);
        setError(null);
        return;
      }
      try {
        const result = await fetchEnt({ data: { workspace_id: m.workspace_id } });
        setData(result as Entitlements);
        setError(null);
      } catch (e) {
        // Never rethrow — degrade gracefully so the app keeps rendering.
        const detail = await describeError(e);
        console.error("[useEntitlements] entitlements fetch failed:", detail, e);
        setData(null);
        setError(FRIENDLY_ERROR);
      }
    } catch (e) {
      const detail = await describeError(e);
      console.error("[useEntitlements] unexpected error:", detail, e);
      setData(null);
      setError(FRIENDLY_ERROR);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const has = (f: Feature) => (data ? planHas(data.plan, f) : false);
  return { data, loading, error, refresh, has };
}
