import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TRIGGERS = [
  "new_lead", "new_customer", "new_subscriber", "abandoned_checkout",
  "no_purchase_3d", "trial_ending", "manual",
] as const;

export const ACTIONS = ["send_email", "add_tag", "notify_user", "recommend_followup"] as const;
export const CONDITIONS = [
  "opened_email", "clicked_link", "purchased",
  "did_not_purchase", "subscription_active", "subscription_cancelled",
] as const;
export const DELAYS = ["immediate", "1h", "1d", "3d", "custom"] as const;

const StepSchema = z.object({
  id: z.string(),
  type: z.enum(["delay", "action", "condition"]),
  delay: z.enum(DELAYS).optional(),
  delay_custom: z.string().optional(),
  action: z.enum(ACTIONS).optional(),
  action_payload: z.record(z.string(), z.any()).optional(),
  condition: z.enum(CONDITIONS).optional(),
});

async function audit(supabase: any, business_id: string, action: string, entity_id: string, metadata: Record<string, unknown> = {}) {
  const { data: biz } = await supabase.from("businesses").select("workspace_id").eq("id", business_id).maybeSingle();
  if (!biz) return;
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("audit_logs").insert({
    workspace_id: biz.workspace_id, business_id, user_id: user?.id ?? null,
    action, entity: "email_automation", entity_id, metadata_json: metadata as any,
  });
}

export const listAutomations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ business_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.from("email_automations")
      .select("*").eq("business_id", data.business_id).order("updated_at", { ascending: false });
    return { automations: rows ?? [] };
  });

export const upsertAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    id: z.string().uuid().optional(),
    business_id: z.string().uuid(),
    name: z.string().min(1).max(160),
    trigger_type: z.enum(TRIGGERS),
    steps_json: z.array(StepSchema),
    status: z.enum(["draft", "active", "paused"]).default("draft"),
  }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase.from("email_automations").update({
        name: data.name, trigger_type: data.trigger_type, steps_json: data.steps_json as any, status: data.status,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("email_automations").insert({
      business_id: data.business_id, name: data.name, trigger_type: data.trigger_type,
      steps_json: data.steps_json as any, status: data.status,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const setAutomationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    id: z.string().uuid(),
    status: z.enum(["draft", "active", "paused"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("email_automations").select("business_id").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Automation not found");
    const { error } = await context.supabase.from("email_automations").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, row.business_id as string,
      data.status === "active" ? "start_automation" : data.status === "paused" ? "stop_automation" : "draft_automation",
      data.id, { status: data.status });
    return { ok: true };
  });

export const deleteAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("email_automations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
