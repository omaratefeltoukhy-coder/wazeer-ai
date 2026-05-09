import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const generateUnsubscribeLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    business_id: z.string().uuid(),
    contact_id: z.string().uuid().optional(),
    email: z.string().email(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { data: existing } = await context.supabase.from("email_unsubscribe_tokens")
        .select("token").eq("business_id", data.business_id).eq("email", data.email).maybeSingle();
      if (existing?.token) return { token: existing.token, url: `/unsubscribe/${existing.token}` };
      const token = crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 10);
      const { error } = await context.supabase.from("email_unsubscribe_tokens").insert({
        business_id: data.business_id, contact_id: data.contact_id ?? null, email: data.email, token,
      });
      if (error) throw new Error(error.message);
      return { token, url: `/unsubscribe/${token}` };
    } catch (err: any) {
      console.error("[email] Error:", err);
      throw err;
    }
  });

export const validateUnsubscribeToken = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().min(8) }).parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: row } = await supabaseAdmin.from("email_unsubscribe_tokens")
        .select("id, business_id, email, used_at").eq("token", data.token).maybeSingle();
      if (!row) return { valid: false as const };
      return { valid: true as const, email: row.email, used: !!row.used_at };
    } catch (err: any) {
      console.error("[email] Error:", err);
      throw err;
    }
  });

export const confirmUnsubscribe = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8) }).parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: row } = await supabaseAdmin.from("email_unsubscribe_tokens")
        .select("id, business_id, email, contact_id, used_at").eq("token", data.token).maybeSingle();
      if (!row) throw new Error("Invalid token");
      if (!row.used_at) {
        await supabaseAdmin.from("email_unsubscribe_tokens").update({ used_at: new Date().toISOString() }).eq("id", row.id);
      }
      await supabaseAdmin.from("suppression_list").upsert({
        business_id: row.business_id as string, email: row.email as string, reason: "unsubscribed", source: "link",
      }, { onConflict: "business_id,email" });
      if (row.contact_id) {
        await supabaseAdmin.from("contacts").update({ unsubscribed_at: new Date().toISOString(), status: "unsubscribed" }).eq("id", row.contact_id as string);
      } else {
        await supabaseAdmin.from("contacts").update({ unsubscribed_at: new Date().toISOString(), status: "unsubscribed" })
          .eq("business_id", row.business_id as string).eq("email", row.email as string);
      }
      await supabaseAdmin.from("email_events").insert({
        business_id: row.business_id as string, event_type: "unsubscribed",
        metadata_json: { email: row.email, source: "link" } as any,
      });
      return { ok: true };
    } catch (err: any) {
      console.error("[email] Error:", err);
      return { ok: false, error: err.message };
    }
  });
