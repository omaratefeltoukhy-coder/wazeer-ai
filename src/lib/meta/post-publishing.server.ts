import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadWorkspaceId } from "@/lib/server/context";
import { publishViaAyrshare } from "@/lib/integrations/ayrshare.server";
import { GRAPH_API_BASE } from "./post-generation.server";

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

async function updateConnectionError(connectionId: string, errorMessage: string | null) {
  await supabaseAdmin.from("meta_connections").update({
    error_message: errorMessage,
    token_status: errorMessage ? "needs_reconnect" : "connected",
    last_synced_at: new Date().toISOString(),
  } as any).eq("id", connectionId);
}

export async function fetchMediaUrl(supabase: any, mediaAssetId: string | null): Promise<string | null> {
  if (!mediaAssetId) return null;
  const { data, error } = await supabase.from("media_assets").select("file_url").eq("id", mediaAssetId).maybeSingle();
  if (error || !data) return null;
  return (data as any).file_url ?? null;
}

async function publishToFacebookPage(
  pageId: string,
  accessToken: string,
  message: string,
  mediaUrl: string | null
): Promise<{ id: string }> {
  const url = `${GRAPH_API_BASE}/${pageId}/feed`;
  const body: Record<string, string> = {
    message,
    access_token: accessToken,
  };
  if (mediaUrl) {
    body.link = mediaUrl;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Facebook API error (${res.status})`;
    const code = json?.error?.code;
    if (code === 190 || code === 102) {
      throw new Error(`Token expired. Please reconnect your Facebook Page in Integrations. Original: ${msg}`);
    }
    if (code === 200 || code === 206) {
      throw new Error(`Permission denied. Please reconnect your Facebook Page and grant publishing permissions. Original: ${msg}`);
    }
    throw new Error(msg);
  }
  if (!json.id) {
    throw new Error("Facebook API did not return a post ID");
  }
  return { id: json.id };
}

async function publishToInstagram(
  igUserId: string,
  accessToken: string,
  caption: string,
  mediaUrl: string | null
): Promise<{ id: string }> {
  // Step 1: Create media container
  const createUrl = `${GRAPH_API_BASE}/${igUserId}/media`;
  const createBody: Record<string, string> = {
    caption,
    access_token: accessToken,
  };

  if (mediaUrl) {
    // Determine if video or image by extension
    const isVideo = /\.(mp4|mov|avi|mkv|webm)(\?.*)?$/i.test(mediaUrl);
    if (isVideo) {
      createBody.media_type = "REELS";
      createBody.video_url = mediaUrl;
    } else {
      createBody.image_url = mediaUrl;
    }
  }

  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(createBody),
  });

  const createJson = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    const msg = createJson?.error?.message || `Instagram API error (${createRes.status})`;
    const code = createJson?.error?.code;
    if (code === 190 || code === 102) {
      throw new Error(`Token expired. Please reconnect your Instagram account in Integrations. Original: ${msg}`);
    }
    if (code === 200 || code === 206) {
      throw new Error(`Permission denied. Please reconnect your Instagram account and grant content publishing permissions. Original: ${msg}`);
    }
    throw new Error(msg);
  }

  const creationId = createJson.id;
  if (!creationId) {
    throw new Error("Instagram API did not return a creation ID");
  }

  // Step 2: Publish the container
  const publishUrl = `${GRAPH_API_BASE}/${igUserId}/media_publish`;
  const publishRes = await fetch(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken,
    }),
  });

  const publishJson = await publishRes.json().catch(() => ({}));
  if (!publishRes.ok) {
    const msg = publishJson?.error?.message || `Instagram publish error (${publishRes.status})`;
    throw new Error(msg);
  }
  if (!publishJson.id) {
    throw new Error("Instagram API did not return a post ID after publishing");
  }
  return { id: publishJson.id };
}

export const publishMetaPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: post } = await context.supabase.from("meta_posts")
      .select("id, business_id, approval_status, platform, caption, hashtags, cta_text, media_asset_id")
      .eq("id", data.post_id)
      .maybeSingle();
    if (!post) throw new Error("Post not found");
    if ((post as any).approval_status !== "approved") {
      throw new Error("Approval required. Approve the post before publishing.");
    }
    const ws_id = await loadWorkspaceId(context.supabase, (post as any).business_id);
    const platform = (post as any).platform as "facebook" | "instagram";

    const caption = (post as any).caption ?? "";
    const hashtags = (post as any).hashtags ?? "";
    const cta = (post as any).cta_text ?? "";
    const message = [caption, hashtags, cta].filter(Boolean).join("\n\n");
    const mediaUrl = await fetchMediaUrl(context.supabase, (post as any).media_asset_id);

    // Option 1: Ayrshare bridge — plug-and-play, no business verification
    const ayrshareKey = process.env.AYRSHARE_API_KEY;
    if (ayrshareKey) {
      try {
        const result = await publishViaAyrshare({
          text: message,
          platforms: [platform],
          mediaUrl,
        });
        await context.supabase.from("meta_posts").update({
          status: "published",
          external_post_id: result.id,
          published_at: new Date().toISOString(),
          error_message: null,
        } as any).eq("id", data.post_id);

        await supabaseAdmin.from("audit_logs").insert({
          workspace_id: ws_id, business_id: (post as any).business_id, user_id: context.userId,
          action: "publish_meta_post", entity: "meta_post", entity_id: data.post_id,
          metadata_json: { platform, mode: "ayrshare", external_post_id: result.id } as never,
        });
        return { ok: true, mode: "ayrshare" as const, external_post_id: result.id };
      } catch (err: any) {
        const errMsg = err?.message || "Ayrshare publishing failed";
        await context.supabase.from("meta_posts").update({
          status: "failed", error_message: errMsg,
        } as any).eq("id", data.post_id);
        throw new Error(errMsg);
      }
    }

    // Option 2: Webhook bridge (Zapier/Make)
    const webhookUrl = process.env.META_WEBHOOK_URL;
    if (webhookUrl) {
      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          message,
          caption,
          hashtags,
          cta,
          media_url: mediaUrl,
          post_id: data.post_id,
          business_id: (post as any).business_id,
        }),
      });
      const webhookJson = await webhookRes.json().catch(() => ({}));
      const ext_id = webhookJson?.id || webhookJson?.post_id || `webhook_${Math.random().toString(36).slice(2, 10)}`;

      if (!webhookRes.ok) {
        const errMsg = webhookJson?.error || `Webhook failed (${webhookRes.status})`;
        await context.supabase.from("meta_posts").update({
          status: "failed", error_message: errMsg,
        } as any).eq("id", data.post_id);
        throw new Error(errMsg);
      }

      await context.supabase.from("meta_posts").update({
        status: "published",
        external_post_id: ext_id,
        published_at: new Date().toISOString(),
        error_message: null,
      } as any).eq("id", data.post_id);

      await supabaseAdmin.from("audit_logs").insert({
        workspace_id: ws_id, business_id: (post as any).business_id, user_id: context.userId,
        action: "publish_meta_post", entity: "meta_post", entity_id: data.post_id,
        metadata_json: { platform, mode: "webhook", external_post_id: ext_id } as never,
      });
      return { ok: true, mode: "webhook" as const, external_post_id: ext_id };
    }

    // Option 3: Direct Meta Graph API (requires business verification)
    const connectionKind = platform === "facebook" ? "facebook_page" : "instagram";
    const { data: conn } = await context.supabase
      .from("meta_connections")
      .select("id, kind, token_status, page_id, instagram_account_id, encrypted_token, error_message")
      .eq("business_id", (post as any).business_id)
      .eq("kind", connectionKind)
      .maybeSingle();

    const hasValidConnection = conn &&
      ((conn as any).token_status === "connected" || (conn as any).token_status === "demo") &&
      (conn as any).encrypted_token;

    // If no valid connection, fall back to demo mode
    if (!hasValidConnection) {
      const ext_id = `demo_post_${Math.random().toString(36).slice(2, 10)}`;
      const { error } = await context.supabase.from("meta_posts").update({
        status: "published",
        external_post_id: ext_id,
        published_at: new Date().toISOString(),
        error_message: null,
      } as any).eq("id", data.post_id);
      if (error) throw new Error(error.message);

      await supabaseAdmin.from("audit_logs").insert({
        workspace_id: ws_id, business_id: (post as any).business_id, user_id: context.userId,
        action: "publish_meta_post", entity: "meta_post", entity_id: data.post_id,
        metadata_json: { platform, mode: "demo" } as never,
      });
      return { ok: true, mode: "demo" as const, external_post_id: ext_id };
    }

    // Decrypt token
    const accessToken = await getDecryptedToken((conn as any).encrypted_token);
    if (!accessToken) {
      await updateConnectionError((conn as any).id, "Unable to decrypt access token");
      throw new Error("Failed to decrypt Meta access token. Please reconnect your account in Integrations.");
    }

    // Instagram requires media (image or video) for live publishing
    if (platform === "instagram" && !mediaUrl) {
      throw new Error("Instagram posts require an image or video. Please attach media before publishing.");
    }

    // Publish via real Meta Graph API
    let result: { id: string };
    try {
      if (platform === "facebook") {
        const pageId = (conn as any).page_id;
        if (!pageId) {
          throw new Error("No Facebook Page connected. Please sync your connection in Integrations.");
        }
        result = await publishToFacebookPage(pageId, accessToken, message, mediaUrl);
      } else {
        const igUserId = (conn as any).instagram_account_id;
        if (!igUserId) {
          throw new Error("No Instagram Business account connected. Please sync your connection in Integrations.");
        }
        result = await publishToInstagram(igUserId, accessToken, message, mediaUrl);
      }

      // Clear any previous error on the connection
      await updateConnectionError((conn as any).id, null);
    } catch (err: any) {
      // Update connection status if it's a token/permission error
      const errMsg = err?.message || "Unknown publishing error";
      if (
        errMsg.includes("Token expired") ||
        errMsg.includes("Permission denied") ||
        errMsg.includes("decrypt")
      ) {
        await updateConnectionError((conn as any).id, errMsg);
      }

      // Update post with error
      await context.supabase.from("meta_posts").update({
        status: "failed",
        error_message: errMsg,
      } as any).eq("id", data.post_id);

      throw new Error(errMsg);
    }

    // Save successful publish
    const { error } = await context.supabase.from("meta_posts").update({
      status: "published",
      external_post_id: result.id,
      published_at: new Date().toISOString(),
      error_message: null,
    } as any).eq("id", data.post_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: ws_id, business_id: (post as any).business_id, user_id: context.userId,
      action: "publish_meta_post", entity: "meta_post", entity_id: data.post_id,
      metadata_json: { platform, mode: "live", external_post_id: result.id } as never,
    });

    return { ok: true, mode: "live" as const, external_post_id: result.id };
  });
