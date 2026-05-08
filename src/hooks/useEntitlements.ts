import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getEntitlements } from "@/lib/billing/entitlements.functions";
import type { Feature, PlanId, Plan } from "@/lib/billing/plans";
import { PLANS, planHas } from "@/lib/billing/plans";
import { toast } from "sonner";

export type Entitlements = {
  plan: PlanId;
  status: string;
  plan_meta: Plan;
  credits_balance: number;
  usage: Record<string, number>;
};

const FALLBACK: Entitlements = {
  plan: "trial",
  status: "trialing",
  plan_meta: PLANS.trial,
  credits_balance: 0,
  usage: {},
};

async function readResponseError(e: unknown): Promise<string> {
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
  const toastedRef = useRef(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setData(FALLBACK);
        setError(null);
        return;
      }
      const { data: m, error: mErr } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .limit(1)
        .maybeSingle();
      if (mErr) throw mErr;
      if (!m) {
        setData(FALLBACK);
        setError(null);
        return;
      }
      const result = await fetchEnt({ data: { workspace_id: m.workspace_id } });
      setData(result as Entitlements);
      setError(null);
    } catch (e) {
      const msg = await readResponseError(e);
      console.error("[useEntitlements] failed:", msg, e);
      if (!toastedRef.current) {
        toastedRef.current = true;
        toast.error("Unable to load your plan details. Showing free tier features.");
      }
      setData(FALLBACK);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const has = (f: Feature) => (data ? planHas(data.plan, f) : false);
  return { data, loading, error, refresh, has };
}
