import { describe, it, expect, vi, beforeEach } from "vitest";
import { withBillingGuard } from "../billing";

const mockConsumeCredits = vi.fn();
const mockRefundCredits = vi.fn();
const mockRequireEntitlement = vi.fn();
const mockCheckUsageCap = vi.fn();
const mockIncrementUsage = vi.fn();
const mockLoadWorkspaceId = vi.fn();

vi.mock("@/lib/billing/guard.server", () => ({
  consumeCredits: (...args: any[]) => mockConsumeCredits(...args),
  refundCredits: (...args: any[]) => mockRefundCredits(...args),
  requireEntitlement: (...args: any[]) => mockRequireEntitlement(...args),
  checkUsageCap: (...args: any[]) => mockCheckUsageCap(...args),
  incrementUsage: (...args: any[]) => mockIncrementUsage(...args),
}));

vi.mock("../context", () => ({
  loadWorkspaceId: (...args: any[]) => mockLoadWorkspaceId(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadWorkspaceId.mockResolvedValue("ws-123");
  mockRequireEntitlement.mockResolvedValue(undefined);
  mockCheckUsageCap.mockResolvedValue(undefined);
  mockConsumeCredits.mockResolvedValue(undefined);
  mockRefundCredits.mockResolvedValue(undefined);
  mockIncrementUsage.mockResolvedValue(undefined);
});

describe("withBillingGuard", () => {
  it("consumes credits, runs fn, and increments usage on success", async () => {
    const supabase = {} as any;
    const fn = vi.fn().mockResolvedValue({ result: "ok" });

    const result = await withBillingGuard(supabase, "biz-123", {
      feature: "meta_posts",
      creditAction: "meta_post",
    }, fn);

    expect(mockLoadWorkspaceId).toHaveBeenCalledWith(supabase, "biz-123");
    expect(mockRequireEntitlement).toHaveBeenCalledWith("ws-123", "meta_posts");
    expect(mockCheckUsageCap).toHaveBeenCalledWith("ws-123", "meta_posts");
    expect(mockConsumeCredits).toHaveBeenCalledWith("ws-123", "meta_post", expect.objectContaining({ business_id: "biz-123" }));
    expect(fn).toHaveBeenCalled();
    expect(mockIncrementUsage).toHaveBeenCalledWith("ws-123", "meta_posts");
    expect(result).toEqual({ result: "ok" });
  });

  it("refunds credits and re-throws when fn fails", async () => {
    const supabase = {} as any;
    const fn = vi.fn().mockRejectedValue(new Error("AI failed"));

    await expect(
      withBillingGuard(supabase, "biz-123", {
        feature: "meta_posts",
        creditAction: "meta_post",
      }, fn)
    ).rejects.toThrow("AI failed");

    expect(mockConsumeCredits).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
    expect(mockRefundCredits).toHaveBeenCalledWith("ws-123", "meta_post", expect.objectContaining({ business_id: "biz-123", reason: "handler_error" }));
    expect(mockIncrementUsage).not.toHaveBeenCalled();
  });

  it("does not run fn if entitlement check fails", async () => {
    mockRequireEntitlement.mockRejectedValue(new Error("Plan missing feature"));
    const supabase = {} as any;
    const fn = vi.fn();

    await expect(
      withBillingGuard(supabase, "biz-123", {
        feature: "meta_ads",
        creditAction: "meta_ad",
      }, fn)
    ).rejects.toThrow("Plan missing feature");

    expect(mockConsumeCredits).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
    expect(mockRefundCredits).not.toHaveBeenCalled();
  });

  it("passes custom metadata through to consume and refund", async () => {
    const supabase = {} as any;
    const fn = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(
      withBillingGuard(supabase, "biz-123", {
        feature: "ai_images",
        creditAction: "ai_image",
        metadata: { prompt: "test" },
      }, fn)
    ).rejects.toThrow("boom");

    expect(mockConsumeCredits).toHaveBeenCalledWith(
      "ws-123",
      "ai_image",
      expect.objectContaining({ business_id: "biz-123", prompt: "test" })
    );
    expect(mockRefundCredits).toHaveBeenCalledWith(
      "ws-123",
      "ai_image",
      expect.objectContaining({ business_id: "biz-123", prompt: "test", reason: "handler_error" })
    );
  });
});
