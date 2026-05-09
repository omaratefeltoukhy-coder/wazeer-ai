import crypto from "crypto";

export function verifyResendSignature(
  secret: string,
  rawBody: string,
  signature: string
): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function parseResendPayload(rawBody: string): {
  ok: true;
  payload: { type: string; data: { id: string } };
} | { ok: false; error: string } {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
  const p = payload as Record<string, unknown>;
  if (!p.type || !p.data || !(p.data as Record<string, unknown>).id) {
    return { ok: false, error: "Invalid payload" };
  }
  return {
    ok: true,
    payload: p as { type: string; data: { id: string } },
  };
}
