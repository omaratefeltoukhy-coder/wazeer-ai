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

export function useEntitlements() {
  const [data, setData] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchEnt = useServerFn(getEntitlements);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: m, error: mErr } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .limit(1)
        .single();
      if (mErr || !m) throw new Error("No workspace found");
      const result = await fetchEnt({ data: { workspace_id: m.workspace_id } });
      setData(result as Entitlements);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const has = (f: Feature) => (data ? planHas(data.plan, f) : false);
  return { data, loading, error, refresh, has };
}
