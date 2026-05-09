import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI } from "@/lib/ai/gateway";

export type IntegrationStatus = {
  id: string;
  name: string;
  category: string;
  status: "connected" | "not_configured" | "error";
  message: string;
  envVar: string;
  setupUrl: string;
  docsUrl: string;
};

export const checkIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const results: IntegrationStatus[] = [];

    // ── Supabase ──
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    results.push({
      id: "supabase",
      name: "Supabase",
      category: "Core",
      status: supabaseUrl && supabaseKey ? "connected" : "not_configured",
      message: supabaseUrl && supabaseKey ? "Database connected" : "Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY",
      envVar: "SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY",
      setupUrl: "https://supabase.com/dashboard",
      docsUrl: "https://supabase.com/docs",
    });

    // ── AI Generation (OpenAI / Lovable fallback) ──
    const openaiKey = process.env.OPENAI_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;
    let aiStatus: IntegrationStatus["status"] = "not_configured";
    let aiMsg = "Add OPENAI_API_KEY for AI generation";
    let aiName = "AI Generation (OpenAI)";
    let aiEnv = "OPENAI_API_KEY";
    let aiSetup = "https://platform.openai.com/api-keys";
    if (openaiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${openaiKey}` },
        });
        aiStatus = res.ok ? "connected" : "error";
        aiMsg = res.ok ? "OpenAI ready" : `Auth failed (${res.status})`;
      } catch {
        aiStatus = "error";
        aiMsg = "OpenAI API unreachable";
      }
    } else if (lovableKey) {
      try {
        await callAI({ messages: [{ role: "user", content: "test" }] });
        aiStatus = "connected";
        aiMsg = "Lovable AI ready";
        aiName = "AI Generation (Lovable)";
        aiEnv = "LOVABLE_API_KEY";
        aiSetup = "https://cloud.lovable.dev/";
      } catch {
        aiStatus = "error";
        aiMsg = "Lovable AI gateway unreachable";
      }
    }
    results.push({
      id: "ai",
      name: aiName,
      category: "AI",
      status: aiStatus,
      message: aiMsg,
      envVar: aiEnv,
      setupUrl: aiSetup,
      docsUrl: "https://platform.openai.com/docs",
    });

    // ── Resend Email ──
    const resendKey = process.env.RESEND_API_KEY;
    let resendStatus: IntegrationStatus["status"] = "not_configured";
    let resendMsg = "Add RESEND_API_KEY to send real emails";
    if (resendKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "HEAD",
          headers: { Authorization: `Bearer ${resendKey}` },
        });
        resendStatus = res.status === 405 || res.ok ? "connected" : "error";
        resendMsg = resendStatus === "connected" ? "Email delivery ready" : `Auth failed (${res.status})`;
      } catch {
        resendStatus = "error";
        resendMsg = "Resend API unreachable";
      }
    }
    results.push({
      id: "resend",
      name: "Email (Resend)",
      category: "Communication",
      status: resendStatus,
      message: resendMsg,
      envVar: "RESEND_API_KEY",
      setupUrl: "https://resend.com/signup",
      docsUrl: "https://resend.com/docs",
    });

    // ── Stripe Payments (primary) ──
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const stripePub = process.env.STRIPE_PUBLISHABLE_KEY;
    const hasStripe = stripeKey && stripePub;
    results.push({
      id: "stripe",
      name: "Payments (Stripe)",
      category: "Payments",
      status: hasStripe ? "connected" : "not_configured",
      message: hasStripe
        ? `Stripe ${stripeKey?.startsWith("sk_test") ? "test" : "live"} mode`
        : "Add Stripe keys to collect real money (recommended for UAE)",
      envVar: "STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY",
      setupUrl: "https://dashboard.stripe.com/register",
      docsUrl: "https://stripe.com/docs",
    });

    // ── Paddle Payments (optional backup) ──
    const paddleClientToken = process.env.VITE_PAYMENTS_CLIENT_TOKEN;
    const paddleSandboxKey = process.env.PADDLE_SANDBOX_API_KEY;
    const paddleLiveKey = process.env.PADDLE_LIVE_API_KEY;
    const hasPaddle = paddleClientToken && (paddleSandboxKey || paddleLiveKey);
    results.push({
      id: "paddle",
      name: "Payments (Paddle)",
      category: "Payments",
      status: hasPaddle ? "connected" : "not_configured",
      message: hasPaddle
        ? `Paddle ${paddleClientToken?.startsWith("test_") ? "sandbox" : "live"} configured`
        : "Optional backup. Stripe is recommended for UAE.",
      envVar: "VITE_PAYMENTS_CLIENT_TOKEN, PADDLE_SANDBOX_API_KEY",
      setupUrl: "https://sandbox-vendors.paddle.com/signup",
      docsUrl: "https://developer.paddle.com/",
    });

    // ── Meta (Facebook/Instagram) ──
    const metaAppId = process.env.META_APP_ID;
    const metaAppSecret = process.env.META_APP_SECRET;
    const metaEncryptionKey = process.env.META_TOKEN_ENCRYPTION_KEY;
    const metaRedirectUri = process.env.META_REDIRECT_URI;
    const hasMeta = metaAppId && metaAppSecret && metaEncryptionKey && metaRedirectUri;
    results.push({
      id: "meta",
      name: "Meta (Facebook/Instagram)",
      category: "Social",
      status: hasMeta ? "connected" : "not_configured",
      message: hasMeta
        ? "Meta Graph API ready. Connect a Page in Integrations."
        : "Add META_APP_ID, META_APP_SECRET, META_TOKEN_ENCRYPTION_KEY to publish posts",
      envVar: "META_APP_ID, META_APP_SECRET, META_TOKEN_ENCRYPTION_KEY",
      setupUrl: "https://developers.facebook.com/apps/",
      docsUrl: "https://developers.facebook.com/docs/graph-api/",
    });

    // ── Image Generation ──
    const imageProvider = process.env.IMAGE_PROVIDER || "mock";
    const imgOpenaiKey = process.env.OPENAI_API_KEY;
    const falKey = process.env.FAL_API_KEY;
    const hasImageProvider = imageProvider !== "mock" && (imgOpenaiKey || falKey || process.env.STABILITY_API_KEY);
    results.push({
      id: "images",
      name: "AI Images",
      category: "AI",
      status: hasImageProvider ? "connected" : "not_configured",
      message: hasImageProvider
        ? `Using ${imageProvider} for image generation`
        : "Using mock images. Set IMAGE_PROVIDER and provider API key for real images.",
      envVar: "IMAGE_PROVIDER, OPENAI_API_KEY, FAL_API_KEY, STABILITY_API_KEY",
      setupUrl: "https://platform.openai.com/api-keys",
      docsUrl: "https://platform.openai.com/docs/guides/images",
    });

    // ── Video Generation ──
    const videoProvider = process.env.VIDEO_PROVIDER || "mock";
    const hasVideoProvider = videoProvider !== "mock" && (process.env.RUNWAY_API_KEY || process.env.FAL_VIDEO_API_KEY || process.env.PIKA_API_KEY);
    results.push({
      id: "videos",
      name: "AI Videos",
      category: "AI",
      status: hasVideoProvider ? "connected" : "not_configured",
      message: hasVideoProvider
        ? `Using ${videoProvider} for video generation`
        : "Using mock videos. Set VIDEO_PROVIDER and provider API key for real videos.",
      envVar: "VIDEO_PROVIDER, RUNWAY_API_KEY, FAL_VIDEO_API_KEY, PIKA_API_KEY",
      setupUrl: "https://runwayml.com/",
      docsUrl: "https://docs.runwayml.com/",
    });

    return {
      integrations: results,
      summary: {
        connected: results.filter((r) => r.status === "connected").length,
        notConfigured: results.filter((r) => r.status === "not_configured").length,
        errors: results.filter((r) => r.status === "error").length,
        total: results.length,
      },
    };
  });
