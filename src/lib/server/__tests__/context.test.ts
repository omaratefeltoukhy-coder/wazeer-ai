import { describe, it, expect, vi } from "vitest";
import { loadWorkspaceId, loadBrandContext } from "../context";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabase(chain: Record<string, any>): SupabaseClient<any> {
  return {
    from: vi.fn(() => chain),
  } as any;
}

function mockMaybeSingle(data: any, error?: any) {
  return {
    select: vi.fn(() => mockMaybeSingle(data, error)),
    eq: vi.fn(() => mockMaybeSingle(data, error)),
    maybeSingle: vi.fn(() => Promise.resolve({ data, error })),
  };
}

describe("loadWorkspaceId", () => {
  it("returns workspace_id when business exists", async () => {
    const supabase = mockSupabase(
      mockMaybeSingle({ workspace_id: "ws-123" })
    );
    const result = await loadWorkspaceId(supabase, "biz-123");
    expect(result).toBe("ws-123");
  });

  it("throws when business is not found", async () => {
    const supabase = mockSupabase(mockMaybeSingle(null));
    await expect(loadWorkspaceId(supabase, "biz-missing")).rejects.toThrow(
      "Business not found"
    );
  });

  it("throws when query errors", async () => {
    const supabase = mockSupabase(
      mockMaybeSingle(null, { message: "DB down" })
    );
    await expect(loadWorkspaceId(supabase, "biz-123")).rejects.toThrow(
      "DB down"
    );
  });
});

describe("loadBrandContext", () => {
  it("returns full context when all tables have data", async () => {
    const biz = { name: "Acme", type: "ecommerce", description: "Widgets" };
    const brand = { brand_name: "ACME", tone: "bold" };
    const offer = { name: "Starter", price: 99 };
    const storefront = { slug: "acme", status: "published" };

    const supabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => {
              const map: Record<string, any> = {
                businesses: { data: biz },
                brand_profiles: { data: brand },
                offers: { data: offer },
                storefronts: { data: storefront },
              };
              return Promise.resolve(map[table] ?? { data: null });
            }),
          })),
        })),
      })),
    } as any;

    const ctx = await loadBrandContext(supabase, "biz-123");
    expect(ctx.biz?.name).toBe("Acme");
    expect(ctx.brand?.tone).toBe("bold");
    expect(ctx.offer?.price).toBe(99);
    expect(ctx.storefront?.slug).toBe("acme");
  });

  it("returns nulls when tables are empty", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
          })),
        })),
      })),
    } as any;

    const ctx = await loadBrandContext(supabase, "biz-123");
    expect(ctx.biz).toBeNull();
    expect(ctx.brand).toBeNull();
    expect(ctx.offer).toBeNull();
    expect(ctx.storefront).toBeNull();
  });
});
