import { describe, it, expect } from "vitest";
import { verifyResendSignature, parseResendPayload } from "../webhook.server";
import crypto from "crypto";

describe("verifyResendSignature", () => {
  const secret = "test-secret";

  it("returns true for a valid signature", () => {
    const body = JSON.stringify({ type: "email.sent", data: { id: "evt-1" } });
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyResendSignature(secret, body, sig)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    const body = JSON.stringify({ type: "email.sent", data: { id: "evt-1" } });
    expect(verifyResendSignature(secret, body, "wrong-sig")).toBe(false);
  });

  it("returns false for a tampered body", () => {
    const body = JSON.stringify({ type: "email.sent", data: { id: "evt-1" } });
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyResendSignature(secret, body + "tamper", sig)).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const body = JSON.stringify({ type: "email.sent", data: { id: "evt-1" } });
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyResendSignature("wrong-secret", body, sig)).toBe(false);
  });
});

describe("parseResendPayload", () => {
  it("parses a valid payload", () => {
    const body = JSON.stringify({ type: "email.sent", data: { id: "evt-1" } });
    const result = parseResendPayload(body);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.type).toBe("email.sent");
      expect(result.payload.data.id).toBe("evt-1");
    }
  });

  it("rejects invalid JSON", () => {
    const result = parseResendPayload("not-json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Invalid JSON");
  });

  it("rejects missing type", () => {
    const result = parseResendPayload(JSON.stringify({ data: { id: "evt-1" } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Invalid payload");
  });

  it("rejects missing data.id", () => {
    const result = parseResendPayload(JSON.stringify({ type: "email.sent", data: {} }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Invalid payload");
  });
});
