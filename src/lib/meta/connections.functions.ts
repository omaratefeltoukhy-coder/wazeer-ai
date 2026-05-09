import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const TOKEN_KEY = () => {
  const key = process.env.META_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length < 16) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY is not configured. Set a 32-byte random key in project secrets.");
  }
  return key;
};

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

async function encryptToken(plaintext: string): Promise<string> {
  const { data: enc, error: encErr } = await supabaseAdmin.rpc("encrypt_meta_token", {
    _plaintext: plaintext,
    _key: TOKEN_KEY(),
  });
  if (encErr) throw new Error(`Token encryption failed: ${encErr.message}`);
  return enc as unknown as string;
}

async function exchangeCodeForToken(code: string): Promise<{ access_token: string; expires_in?: number }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    throw new Error("Meta app credentials not configured");
  }

  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || `Token exchange failed (${res.status})`);
  }
  if (!json.access_token) {
    throw new Error("Meta did not return an access token");
  }
  return json;
}

async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("Meta app credentials not configured");

  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url.toString());
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    // Fallback to short-lived if long-lived exchange fails
    return shortLivedToken;
  }
  return json.access_token;
}

async function fetchPages(accessToken: string): Promise<Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>> {
  const url = new URL(`${GRAPH_API_BASE}/me/accounts`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", "id,name,access_token,instagram_business_account");

  const res = await fetch(url.toString());
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || `Failed to fetch pages (${res.status})`);
  }
  return json.data ?? [];
}

async function fetchInstagramAccountId(pageId: string, pageAccessToken: string): Promise<string | null> {
  const url = new URL(`${GRAPH_API_BASE}/${pageId}`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("fields", "instagram_business_account");

  const res = await fetch(url.toString());
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return json.instagram_business_account?.id ?? null;
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
    const isDemo = (process.env.META_MODE ?? "demo") === "demo";
    const redirect_url = isDemo
      ? `/dashboard/integrations/meta?demo_callback=1&state=${encodeURIComponent(state)}&kind=${data.kind}&business_id=${data.business_id}`
      : `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?client_id=${process.env.META_APP_ID}&redirect_uri=${encodeURIComponent(process.env.META_REDIRECT_URI ?? "")}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(PERMISSIONS[data.kind].join(","))}`;
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

    let accessToken: string;
    if (isDemo) {
      accessToken = `demo-token-${data.kind}-${Math.random().toString(36).slice(2, 10)}`;
    } else {
      if (!data.code) throw new Error("Authorization code missing from Meta callback");
      const exchanged = await exchangeCodeForToken(data.code);
      accessToken = await exchangeForLongLivedToken(exchanged.access_token);
    }

    const encryptedToken = await encryptToken(accessToken);

    const label = ({ facebook_page: "Facebook Page", instagram: "Instagram Business", ad_account: "Meta Ad Account", pixel: "Meta Pixel", capi: "Conversions API" } as const)[data.kind];

    const row = {
      business_id: data.business_id,
      user_id: context.userId,
      provider: "facebook" as const,
      kind: data.kind,
      label,
      token_status: isDemo ? "demo" : "connected",
      permissions_json: PERMISSIONS[data.kind] as never,
      encrypted_token: encryptedToken as unknown as never,
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

async function getDecryptedToken(encryptedToken: string | null | undefined): Promise<string | null> {
  if (!encryptedToken) return null;
  const key = process.env.META_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length < 16) return null;
  const { data, error } = await supabaseAdmin.rpc("decrypt_meta_token", {
    _cipher: encryptedToken as any,
    _key: key,
  });
  if (error || !data) return null;
  return data as string;
}

export const syncMetaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ connection_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: conn } = await context.supabase
      .from("meta_connections")
      .select("id, business_id, kind, encrypted_token, token_status")
      .eq("id", data.connection_id)
      .maybeSingle();
    if (!conn) throw new Error("Connection not found");

    const isDemo = (conn as any).token_status === "demo" || (process.env.META_MODE ?? "demo") === "demo";

    if (isDemo) {
      const patch: Record<string, unknown> = { last_synced_at: new Date().toISOString(), token_status: "demo", error_message: null };
      if ((conn as any).kind === "facebook_page") {
        patch.page_id = "demo_page_1001";
        patch.metadata_json = { pages: [{ id: "demo_page_1001", name: "Demo Brand Page" }, { id: "demo_page_1002", name: "Demo Secondary" }] };
      } else if ((conn as any).kind === "instagram") {
        patch.instagram_account_id = "demo_ig_2002";
        patch.metadata_json = { username: "demo_brand", followers: 1240 };
      } else if ((conn as any).kind === "ad_account") {
        patch.ad_account_id = "act_demo_3003";
        patch.metadata_json = { name: "Demo Ad Account", currency: "USD", spend_cap: 1000 };
      } else if ((conn as any).kind === "pixel") {
        patch.metadata_json = { pixel_id: "demo_pixel_4004", events_30d: 312 };
      } else if ((conn as any).kind === "capi") {
        patch.metadata_json = { capi_active: true };
      }
      const { error } = await supabaseAdmin.from("meta_connections").update(patch as any).eq("id", data.connection_id);
      if (error) throw new Error(error.message);
      return { ok: true, mode: "demo" as const };
    }

    // Real sync
    const accessToken = await getDecryptedToken((conn as any).encrypted_token);
    if (!accessToken) {
      await supabaseAdmin.from("meta_connections").update({
        token_status: "needs_reconnect",
        error_message: "Unable to decrypt access token",
        last_synced_at: new Date().toISOString(),
      } as any).eq("id", data.connection_id);
      throw new Error("Unable to decrypt access token. Please reconnect.");
    }

    try {
      const patch: Record<string, unknown> = { last_synced_at: new Date().toISOString(), error_message: null, token_status: "connected" };

      if ((conn as any).kind === "facebook_page") {
        const pages = await fetchPages(accessToken);
        if (pages.length === 0) {
          throw new Error("No Facebook Pages found for this account. Ensure you manage at least one Page.");
        }
        // Use the first page by default
        const primaryPage = pages[0];
        patch.page_id = primaryPage.id;
        patch.metadata_json = { pages: pages.map((p) => ({ id: p.id, name: p.name })) };

        // If instagram connection also exists, or if this is instagram kind, try to get IG account
        if ((conn as any).kind === "instagram" || pages.some((p) => p.instagram_business_account)) {
          const igId = primaryPage.instagram_business_account?.id ?? await fetchInstagramAccountId(primaryPage.id, primaryPage.access_token);
          if (igId) patch.instagram_account_id = igId;
        }
      } else if ((conn as any).kind === "instagram") {
        // For Instagram, we need to find the connected page first
        const pages = await fetchPages(accessToken);
        if (pages.length === 0) {
          throw new Error("No Facebook Pages found. Instagram Business requires a connected Facebook Page.");
        }
        const primaryPage = pages[0];
        const igId = primaryPage.instagram_business_account?.id ?? await fetchInstagramAccountId(primaryPage.id, primaryPage.access_token);
        if (!igId) {
          throw new Error("No Instagram Business account linked to your Facebook Page.");
        }
        patch.instagram_account_id = igId;
        patch.page_id = primaryPage.id;
        patch.metadata_json = { page_name: primaryPage.name, ig_user_id: igId };
      } else if ((conn as any).kind === "ad_account") {
        patch.ad_account_id = "act_sync_pending";
        patch.metadata_json = { sync_note: "Ad account sync not yet implemented" };
      } else if ((conn as any).kind === "pixel") {
        patch.metadata_json = { sync_note: "Pixel sync not yet implemented" };
      } else if ((conn as any).kind === "capi") {
        patch.metadata_json = { capi_active: true };
      }

      const { error } = await supabaseAdmin.from("meta_connections").update(patch as any).eq("id", data.connection_id);
      if (error) throw new Error(error.message);
      return { ok: true, mode: "live" as const };
    } catch (err: any) {
      const msg = err?.message || "Sync failed";
      await supabaseAdmin.from("meta_connections").update({
        token_status: "needs_reconnect",
        error_message: msg,
        last_synced_at: new Date().toISOString(),
      } as any).eq("id", data.connection_id);
      throw new Error(msg);
    }
  });

// Backwards-compatible mock sync — delegates to real sync
export const runMockMetaSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ business_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await loadWorkspaceId(context.supabase, data.business_id);
    const { data: conns } = await context.supabase
      .from("meta_connections").select("id, kind, token_status").eq("business_id", data.business_id);

    const results = [];
    for (const c of (conns ?? []) as any[]) {
      try {
        const result = await syncMetaConnection({ data: { connection_id: c.id } });
        results.push({ id: c.id, kind: c.kind, ok: true, mode: result.mode });
      } catch (e: any) {
        results.push({ id: c.id, kind: c.kind, ok: false, error: e.message });
      }
    }
    return { ok: true, synced: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, details: results };
  });
