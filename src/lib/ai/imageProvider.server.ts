// Image-generation provider abstraction.
// Swap providers by setting IMAGE_PROVIDER env var ("mock" | "lovable" | "openai" | "fal" | "stability").
// Today only "mock" is implemented end-to-end. The others are stubs that throw,
// so changing the env flag + filling in one fetch call is enough to go live.

export type ImageFormat = "1_1" | "9_16" | "16_9" | "ad" | "email_banner";
export type ImageType =
  | "product"
  | "lifestyle"
  | "social_post"
  | "ad_creative"
  | "reel_cover"
  | "email_banner"
  | "storefront_hero";
export type ImageStyle =
  | "premium_studio"
  | "lifestyle"
  | "minimal"
  | "luxury"
  | "local_market"
  | "creator_led"
  | "bold_ad"
  | "clean_ecommerce";

export const FORMAT_DIMENSIONS: Record<ImageFormat, { w: number; h: number; label: string }> = {
  "1_1": { w: 1024, h: 1024, label: "1:1 Square" },
  "9_16": { w: 1080, h: 1920, label: "9:16 Story / Reel" },
  "16_9": { w: 1920, h: 1080, label: "16:9 Landscape" },
  ad: { w: 1200, h: 628, label: "Meta ad" },
  email_banner: { w: 1200, h: 600, label: "Email banner" },
};

export const TYPE_LABELS: Record<ImageType, string> = {
  product: "Product photo",
  lifestyle: "Lifestyle shot",
  social_post: "Social post",
  ad_creative: "Ad creative",
  reel_cover: "Story / Reel cover",
  email_banner: "Email banner",
  storefront_hero: "Storefront hero",
};

export const STYLE_LABELS: Record<ImageStyle, string> = {
  premium_studio: "Premium studio",
  lifestyle: "Lifestyle",
  minimal: "Minimal",
  luxury: "Luxury",
  local_market: "Local market",
  creator_led: "Creator-led",
  bold_ad: "Bold ad",
  clean_ecommerce: "Clean ecommerce",
};

export type BrandContext = {
  brand_name?: string | null;
  tone?: string | null;
  visual_style?: string | null;
  positioning?: string | null;
  audience?: string | null;
  product_name?: string | null;
  product_description?: string | null;
};

export type ComposePromptInput = {
  type: ImageType;
  style: ImageStyle;
  format: ImageFormat;
  brand: BrandContext;
  user_brief?: string;
  reference_url?: string | null;
};

export function composePrompt(input: ComposePromptInput): string {
  const { brand, type, style, format, user_brief } = input;
  const dims = FORMAT_DIMENSIONS[format];
  const lines = [
    `${TYPE_LABELS[type]} for ${brand.brand_name ?? brand.product_name ?? "the brand"}.`,
    brand.product_description ? `Subject: ${brand.product_description}.` : "",
    brand.positioning ? `Positioning: ${brand.positioning}.` : "",
    brand.audience ? `Audience: ${brand.audience}.` : "",
    `Visual direction: ${STYLE_LABELS[style]}${brand.visual_style ? ` — also: ${brand.visual_style}` : ""}.`,
    brand.tone ? `Mood / tone: ${brand.tone}.` : "",
    `Format: ${dims.label} (${dims.w}x${dims.h}).`,
    user_brief ? `Extra direction: ${user_brief}.` : "",
    // Safety / honesty rails — enforced via prompt for all providers.
    "Do not add any text, logos, certification marks, awards, claims, before/after panels, medical, financial, or legal language. Preserve real product identity — do not invent labels, packaging, or accessories that are not described.",
  ];
  return lines.filter(Boolean).join(" ");
}

export type GenerateInput = {
  prompt: string;
  format: ImageFormat;
  reference_url?: string | null;
  seed?: string;
};

export type GenerateResult = {
  file_url: string;
  status: "ready" | "queued" | "failed";
  provider: string;
  raw?: Record<string, unknown>;
};

export type ImageProvider = {
  id: string;
  generate: (input: GenerateInput) => Promise<GenerateResult>;
};

const mockProvider: ImageProvider = {
  id: "mock",
  generate: async ({ format, seed }) => {
    const dims = FORMAT_DIMENSIONS[format];
    const s = seed || Math.random().toString(36).slice(2, 10);
    // Simulated 2-3s generation latency.
    await new Promise((r) => setTimeout(r, 2000 + Math.floor(Math.random() * 1000)));
    return {
      file_url: `https://picsum.photos/seed/${encodeURIComponent(s)}/${dims.w}/${dims.h}`,
      status: "ready",
      provider: "mock",
    };
  },
};

const stubProvider = (id: string): ImageProvider => ({
  id,
  generate: async () => {
    throw new Error(`Image provider "${id}" is not configured yet. Set IMAGE_PROVIDER=mock or implement it.`);
  },
});

export function getImageProvider(): ImageProvider {
  const id = (process.env.IMAGE_PROVIDER || "mock").toLowerCase();
  switch (id) {
    case "mock":
      return mockProvider;
    case "lovable":
    case "openai":
    case "fal":
    case "stability":
      return stubProvider(id);
    default:
      return mockProvider;
  }
}
