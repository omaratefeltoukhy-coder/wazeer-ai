import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadWorkspaceId } from "@/lib/server/context";
import { PLATFORMS } from "./post-generation.server";

export const listMetaPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ business_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    try {
      const { data: rows, error } = await context.supabase
        .from("meta_posts")
        .select("id, platform, caption, hashtags, cta_text, post_type, media_asset_id, status, approval_status, scheduled_at, published_at, external_post_id, insights_json, error_message, created_at, updated_at")
        .eq("business_id", data.business_id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return { posts: rows ?? [] };
    } catch (err: any) {
      console.error("[posts] Error:", err);
      throw err;
    }
  });

export const updateMetaPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    post_id: z.string().uuid(),
    patch: z.object({
      caption: z.string().max(8000).optional(),
      hashtags: z.string().max(2000).optional(),
      cta_text: z.string().max(200).optional(),
      media_asset_id: z.string().uuid().nullable().optional(),
      scheduled_at: z.string().datetime().nullable().optional(),
      platform: z.enum(PLATFORMS).optional(),
    }),
  }).parse(i))
  .handler(async ({ data, context }) => {
    try {
      const { error } = await context.supabase.from("meta_posts").update(data.patch as any).eq("id", data.post_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err: any) {
      console.error("[posts] Error:", err);
      return { ok: false, error: err.message };
    }
  });

export const approveMetaPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    try {
      const { data: post } = await context.supabase.from("meta_posts").select("id, business_id").eq("id", data.post_id).maybeSingle();
      if (!post) throw new Error("Post not found");
      const ws_id = await loadWorkspaceId(context.supabase, (post as any).business_id);
      const { error } = await context.supabase.from("meta_posts").update({
        approval_status: "approved", approved_at: new Date().toISOString(), approved_by: context.userId,
      } as any).eq("id", data.post_id);
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("audit_logs").insert({
        workspace_id: ws_id, business_id: (post as any).business_id, user_id: context.userId,
        action: "approve_meta_post", entity: "meta_post", entity_id: data.post_id, metadata_json: {} as never,
      });
      return { ok: true };
    } catch (err: any) {
      console.error("[posts] Error:", err);
      return { ok: false, error: err.message };
    }
  });

export const scheduleMetaPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ post_id: z.string().uuid(), scheduled_at: z.string().datetime() }).parse(i))
  .handler(async ({ data, context }) => {
    try {
      const { data: post } = await context.supabase.from("meta_posts").select("id, business_id, approval_status").eq("id", data.post_id).maybeSingle();
      if (!post) throw new Error("Post not found");
      if ((post as any).approval_status !== "approved") throw new Error("Approve the post before scheduling.");
      const { error } = await context.supabase.from("meta_posts").update({
        scheduled_at: data.scheduled_at, status: "scheduled",
      } as any).eq("id", data.post_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err: any) {
      console.error("[posts] Error:", err);
      return { ok: false, error: err.message };
    }
  });

export const deleteMetaPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    try {
      const { error } = await context.supabase.from("meta_posts").delete().eq("id", data.post_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err: any) {
      console.error("[posts] Error:", err);
      return { ok: false, error: err.message };
    }
  });
