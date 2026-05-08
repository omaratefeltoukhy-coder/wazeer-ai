// Video-generation provider abstraction (server only — uses process.env).
// Swap providers with VIDEO_PROVIDER env: "mock" | "runway" | "fal" | "pika" | "lovable".
// Today only "mock" is implemented end-to-end. Others are stubs that throw —
// implementing one is a single fetch + poll call.

export type VideoFormat = "9_16" | "1_1" | "16_9";

export type RenderInput = {
  scene_prompts: { scene_no: number; prompt: string; duration_s: number }[];
  format: VideoFormat;
  voiceover?: string | null;
  seed?: string;
};

export type RenderJob = {
  provider: string;
  job_id: string;
  status: "queued" | "rendering" | "ready" | "failed";
  video_url?: string | null;
  finishes_at?: number; // epoch ms — when mock will be "ready"
  error?: string | null;
};

export type VideoProvider = {
  id: string;
  start: (input: RenderInput) => Promise<RenderJob>;
  poll: (job_id: string, started_at: number) => Promise<RenderJob>;
};

const FORMAT_SEED_DIMS: Record<VideoFormat, { w: number; h: number }> = {
  "9_16": { w: 540, h: 960 },
  "1_1": { w: 720, h: 720 },
  "16_9": { w: 960, h: 540 },
};

// Deterministic placeholder MP4 used in mock mode (Google sample bucket).
// Picked from the standard Google "test videos" set so previews work offline-friendly.
const SAMPLE_VIDEO_URLS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
];

function pickUrl(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % SAMPLE_VIDEO_URLS.length;
  return SAMPLE_VIDEO_URLS[idx];
}

const mockProvider: VideoProvider = {
  id: "mock",
  start: async ({ seed, format }) => {
    const s = seed || Math.random().toString(36).slice(2, 10);
    // Mock 8–12s render delay
    const renderMs = 8000 + Math.floor(Math.random() * 4000);
    return {
      provider: "mock",
      job_id: `mock_${s}`,
      status: "rendering",
      video_url: null,
      finishes_at: Date.now() + renderMs,
      error: null,
    };
  },
  poll: async (job_id, started_at) => {
    // Re-derive deterministic finish window from started_at (caller persists it).
    const renderMs = 9000;
    const finishes_at = started_at + renderMs;
    const seed = job_id.replace(/^mock_/, "");
    if (Date.now() >= finishes_at) {
      return { provider: "mock", job_id, status: "ready", video_url: pickUrl(seed) };
    }
    return { provider: "mock", job_id, status: "rendering", video_url: null, finishes_at };
  },
};

const stubProvider = (id: string): VideoProvider => ({
  id,
  start: async () => {
    throw new Error(`Video provider "${id}" not configured. Set VIDEO_PROVIDER=mock or implement it.`);
  },
  poll: async () => {
    throw new Error(`Video provider "${id}" not configured.`);
  },
});

export function getVideoProvider(): VideoProvider {
  const id = (process.env.VIDEO_PROVIDER || "mock").toLowerCase();
  switch (id) {
    case "mock": return mockProvider;
    case "runway":
    case "fal":
    case "pika":
    case "lovable":
      return stubProvider(id);
    default: return mockProvider;
  }
}

export const FORMAT_DIMENSIONS = FORMAT_SEED_DIMS;
