import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TOKEN_KEY = () => process.env.META_TOKEN_KEY ?? "wazeer-demo-meta-key-change-me";

const KIND = z.enum(["facebook_page", "instagram", "ad_account", "pixel", "capi"]);
type Kind = z.infer<typeof KIND>;

const PERMISSIONS: Record<Kind, string[]> = {
  facebook_page: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
  instagram: ["instagram_basic", "instagram_content_publish"],
  ad_account: ["ads_management", "ads_read", "business_management"],
  pixel: ["ads_read"],
  capi: ["business_management"],
};

async function loadWorkspaceId(supabase: any, business_id: string): Promise<string> {
  const { data, error } = await supabase.from("businesses").select("workspace_id").eq("id", business_id).maybeSingle();
  if (error || !data) throw new Error(error?.message || "Business not found");
  return data.workspace_id as string;
}

async function audit(business_id: string, user_id: string | null, action: string, entity_id: string | null, metadata: Record<string, unknown> = {}) {
  const { data: biz } = await supabaseAdmin.from("businesses").select("workspace_id").eq("id", business_id).maybeSingle();
  if (!biz) return;
  await supabaseAdmin.from("audit_logs").insert({
    workspace_id: (biz as any).workspace_id, business_id, user_id,
    action, entity: "meta_connection", entity_id, metadata_json: metadata as never,
  });
}

export const listMetaConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ business_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("meta_connections")
      .select("id, kind, label, token_status, permissions_json, page_id, instagram_account_id, ad_account_id, last_synced_at, error_message, metadata_json, created_at, updated_at")
      .eq("business_id", data.business_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { connections: rows ?? [] };
  });

export const startMetaOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ business_id: z.string().uuid(), kind: KIND }).parse(i))
  .handler(async ({ data, context }) => {
    await loadWorkspaceId(context.supabase, data.business_id);
    const state = `${data.business_id}:${data.kind}:${Date.now()}`;
    // In prod we'd build the real Facebook dialog URL. In demo we return a synthetic redirect.
    const isDemo = (process.env.META_MODE ?? "demo") === "demo";
    const redirect_url = isDemo
      ? `/dashboard/integrations/meta?demo_callback=1&state=${encodeURIComponent(state)}&kind=${data.kind}&business_id=${data.business_id}`
      : `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.META_APP_ID}&redirect_uri=${encodeURIComponent(process.env.META_REDIRECT_URI ?? "")}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(PERMISSIONS[data.kind].join(","))}`;
    return { redirect_url, demo: isDemo };
  });

export const handleMetaOAuthCallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    business_id: z.string().uuid(), kind: KIND,
    code: z.string().optional(), // present in prod
  }).parse(i))
  .handler(async ({ data, context }) => {
    const ws_id = await loadWorkspaceId(context.supabase, data.business_id);
    const isDemo = (process.env.META_MODE ?? "demo") === "demo";
    const fakeToken = `demo-token-${data.kind}-${Math.random().toString(36).slice(2, 10)}`;
    // Encrypt token using server-side function (token never leaves the DB unencrypted).
    const { data: enc, error: encErr } = await supabaseAdmin.rpc("encrypt_meta_token", {
      _plaintext: fakeToken, _key: TOKEN_KEY(),
    });
    if (encErr) throw new Error(`Token encryption failed: ${encErr.message}`);

    const label = ({ facebook_page: "Facebook Page", instagram: "Instagram Business", ad_account: "Meta Ad Account", pixel: "Meta Pixel", capi: "Conversions API" } as const)[data.kind];

    const row = {
      business_id: data.business_id,
      user_id: context.userId,
      provider: "facebook" as const,
      kind: data.kind,
      label,
      token_status: isDemo ? "demo" : "connected",
      permissions_json: PERMISSIONS[data.kind] as never,
      encrypted_token: enc as unknown as never,
      last_synced_at: new Date().toISOString(),
      metadata_json: { mode: isDemo ? "demo" : "live" } as never,
      error_message: null,
    };

    // Upsert by (business_id, kind)
    const { data: existing } = await supabaseAdmin
      .from("meta_connections").select("id").eq("business_id", data.business_id).eq("kind", data.kind).maybeSingle();
    let conn_id: string;
    if (existing) {
      const { error } = await supabaseAdmin.from("meta_connections").update(row).eq("id", (existing as any).id);
      if (error) throw new Error(error.message);
      conn_id = (existing as any).id;
    } else {
      const { data: ins, error } = await supabaseAdmin.from("meta_connections").insert(row).select("id").single();
      if (error) throw new Error(error.message);
      conn_id = (ins as any).id;
    }

    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: ws_id, business_id: data.business_id, user_id: context.userId,
      action: "connect_meta", entity: "meta_connection", entity_id: conn_id, metadata_json: { kind: data.kind, mode: isDemo ? "demo" : "live" } as never,
    });

    return { ok: true, connection_id: conn_id };
  });

export const disconnectMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ connection_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase.from("meta_connections").select("id, business_id, kind").eq("id", data.connection_id).maybeSingle();
    if (!c) throw new Error("Connection not found");
    const { error } = await context.supabase.from("meta_connections").delete().eq("id", data.connection_id);
    if (error) throw new Error(error.message);
    await audit((c as any).business_id, context.userId, "disconnect_meta", data.connection_id, { kind: (c as any).kind });
    return { ok: true };
  });

// Mock sync — populates fake pages / IG / ad-account metadata
export const runMockMetaSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ business_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await loadWorkspaceId(context.supabase, data.business_id);
    const { data: conns } = await context.supabase
      .from("meta_connections").select("id, kind").eq("business_id", data.business_id);

    const updates: Promise<unknown>[] = [];
    for (const c of (conns ?? []) as any[]) {
      const patch: Record<string, unknown> = { last_synced_at: new Date().toISOString(), token_status: "demo" };
      if (c.kind === "facebook_page") {
        patch.page_id = "demo_page_1001";
        patch.metadata_json = { pages: [{ id: "demo_page_1001", name: "Demo Brand Page" }, { id: "demo_page_1002", name: "Demo Secondary" }] };
      } else if (c.kind === "instagram") {
        patch.instagram_account_id = "demo_ig_2002";
        patch.metadata_json = { username: "demo_brand", followers: 1240 };
      } else if (c.kind === "ad_account") {
        patch.ad_account_id = "act_demo_3003";
        patch.metadata_json = { name: "Demo Ad Account", currency: "USD", spend_cap: 1000 };
      } else if (c.kind === "pixel") {
        patch.metadata_json = { pixel_id: "demo_pixel_4004", events_30d: 312 };
      } else if (c.kind === "capi") {
        patch.metadata_json = { capi_active: true };
      }
      updates.push(supabaseAdmin.from("meta_connections").update(patch).eq("id", c.id));
    }
    await Promise.all(updates);
    return { ok: true, synced: (conns ?? []).length };
  });
