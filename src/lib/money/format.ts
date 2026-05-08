export function formatMoney(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `${(amount || 0).toFixed(2)} ${currency}`;
  }
}

export async function getWorkspaceCurrency(
  supabase: typeof import("@/integrations/supabase/client").supabase,
): Promise<string> {
  try {
    const { data } = await supabase
      .from("businesses")
      .select("currency")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.currency as string) || "USD";
  } catch {
    return "USD";
  }
}
