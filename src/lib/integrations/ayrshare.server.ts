// Ayrshare bridge — posts to Facebook, Instagram, LinkedIn, etc.
// No Meta business verification needed. Sign up: https://www.ayrshare.com

const AYRSHARE_BASE = "https://app.ayrshare.com/api";

function getKey(): string {
  const key = process.env.AYRSHARE_API_KEY;
  if (!key) throw new Error("AYRSHARE_API_KEY not configured");
  return key;
}

export async function publishViaAyrshare(opts: {
  text: string;
  platforms: ("facebook" | "instagram")[];
  mediaUrl?: string | null;
}) {
  const key = getKey();

  const body: Record<string, any> = {
    post: opts.text,
    platforms: opts.platforms,
  };

  if (opts.mediaUrl) {
    body.mediaUrls = [opts.mediaUrl];
  }

  const res = await fetch(`${AYRSHARE_BASE}/post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status === "error") {
    const msg = json?.message || json?.errors?.[0]?.message || `Ayrshare error (${res.status})`;
    throw new Error(msg);
  }

  // Ayrshare returns an array of post results per platform
  const posts = json?.posts ?? [];
  const firstId = posts[0]?.id || posts[0]?.postId || json?.id;
  return { id: firstId || `ayr_${Date.now()}`, posts };
}
