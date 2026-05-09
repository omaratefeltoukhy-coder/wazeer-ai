import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CREDIT_PACKS } from "./packs";

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
