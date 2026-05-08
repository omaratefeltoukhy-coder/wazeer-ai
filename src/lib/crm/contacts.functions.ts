import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAccess(supabase: any, businessId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, workspace_id, name")
    .eq("id", businessId)
    .maybeSingle();
  if (error || !data) throw new Error("Business not found or access denied");
  return data as { id: string; workspace_id: string; name: string };
}

async function audit(workspace_id: string, business_id: string, user_id: string | null, action: string, entity: string, entity_id: string | null, metadata: Record<string, unknown> = {}) {
  await supabaseAdmin.from("audit_logs").insert({
    workspace_id, business_id, user_id, action, entity, entity_id,
    metadata_json: metadata as never,
  });
}

export const listContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    business_id: z.string().uuid(),
    search: z.string().optional().default(""),
    tag: z.string().optional().default(""),
    status: z.enum(["all", "active", "unsubscribed", "suppressed"]).optional().default("all"),
    limit: z.number().int().min(1).max(500).default(100),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, data.business_id);
    let q = supabaseAdmin.from("contacts").select("*").eq("business_id", data.business_id).order("created_at", { ascending: false }).limit(data.limit);
    if (data.search.trim()) {
      const s = data.search.trim();
      q = q.or(`email.ilike.%${s}%,name.ilike.%${s}%,phone.ilike.%${s}%`);
    }
    if (data.status === "active") q = q.is("unsubscribed_at", null).neq("status", "suppressed");
    if (data.status === "unsubscribed") q = q.not("unsubscribed_at", "is", null);
    if (data.status === "suppressed") q = q.eq("status", "suppressed");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let filtered = rows ?? [];
    if (data.tag) filtered = filtered.filter((r) => Array.isArray(r.tags_json) && (r.tags_json as string[]).includes(data.tag));

    // Aggregate stats
    const { data: all } = await supabaseAdmin.from("contacts").select("status, unsubscribed_at, created_at, tags_json").eq("business_id", data.business_id);
    const tagCounts: Record<string, number> = {};
    let active = 0, unsub = 0, suppressed = 0;
    const since30 = Date.now() - 30 * 86400000;
    let new30 = 0;
    for (const c of all ?? []) {
      if (c.status === "suppressed") suppressed++;
      else if (c.unsubscribed_at) unsub++;
      else active++;
      if (c.created_at && new Date(c.created_at).getTime() > since30) new30++;
      if (Array.isArray(c.tags_json)) for (const t of c.tags_json as string[]) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }
    const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
    return { contacts: filtered, stats: { total: (all ?? []).length, active, unsub, suppressed, new30 }, tags };
  });

export const upsertContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    business_id: z.string().uuid(),
    id: z.string().uuid().optional(),
    email: z.string().email().optional().nullable(),
    name: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    source: z.string().optional().nullable(),
    tags: z.array(z.string()).optional().default([]),
    status: z.string().optional().default("active"),
    consent: z.boolean().optional().default(false),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const biz = await assertAccess(context.supabase, data.business_id);
    if (!data.email && !data.phone) throw new Error("Email or phone is required");
    const payload: Record<string, unknown> = {
      business_id: biz.id,
      email: data.email ?? null,
      name: data.name ?? null,
      phone: data.phone ?? null,
      source: data.source ?? "manual",
      tags_json: data.tags,
      status: data.status,
      consent_at: data.consent ? new Date().toISOString() : undefined,
    };
    let row;
    if (data.id) {
      const { data: r, error } = await supabaseAdmin.from("contacts").update(payload as never).eq("id", data.id).eq("business_id", biz.id).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      row = r;
    } else {
      const { data: r, error } = await supabaseAdmin.from("contacts").insert(payload as never).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      row = r;
    }
    await audit(biz.workspace_id, biz.id, context.userId, data.id ? "update_contact" : "create_contact", "contacts", (row as any)?.id ?? null);
    return row;
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ business_id: z.string().uuid(), id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const biz = await assertAccess(context.supabase, data.business_id);
    const { error } = await supabaseAdmin.from("contacts").delete().eq("id", data.id).eq("business_id", biz.id);
    if (error) throw new Error(error.message);
    await audit(biz.workspace_id, biz.id, context.userId, "delete_contact", "contacts", data.id);
    return { ok: true };
  });

export const setContactTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ business_id: z.string().uuid(), id: z.string().uuid(), tags: z.array(z.string()) }).parse(input))
  .handler(async ({ data, context }) => {
    const biz = await assertAccess(context.supabase, data.business_id);
    const { error } = await supabaseAdmin.from("contacts").update({ tags_json: data.tags } as never).eq("id", data.id).eq("business_id", biz.id);
    if (error) throw new Error(error.message);
    await audit(biz.workspace_id, biz.id, context.userId, "set_contact_tags", "contacts", data.id, { tags: data.tags });
    return { ok: true };
  });

export const importContactsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    business_id: z.string().uuid(),
    rows: z.array(z.object({
      email: z.string().optional().nullable(),
      name: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      tags: z.array(z.string()).optional().default([]),
    })).min(1).max(2000),
    consent: z.boolean().default(false),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const biz = await assertAccess(context.supabase, data.business_id);
    const now = new Date().toISOString();
    const inserts = data.rows
      .filter((r) => (r.email && r.email.includes("@")) || r.phone)
      .map((r) => ({
        business_id: biz.id,
        email: r.email ?? null,
        name: r.name ?? null,
        phone: r.phone ?? null,
        source: "csv_import",
        tags_json: r.tags ?? [],
        status: "active",
        consent_at: data.consent ? now : null,
      }));
    if (!inserts.length) return { imported: 0, skipped: data.rows.length };
    const { error } = await supabaseAdmin.from("contacts").insert(inserts as never);
    if (error) throw new Error(error.message);
    await audit(biz.workspace_id, biz.id, context.userId, "import_contacts", "contacts", null, { count: inserts.length });
    return { imported: inserts.length, skipped: data.rows.length - inserts.length };
  });

export const getContactTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ business_id: z.string().uuid(), id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const biz = await assertAccess(context.supabase, data.business_id);
    const [{ data: contact }, { data: events }, { data: orders }] = await Promise.all([
      supabaseAdmin.from("contacts").select("*").eq("id", data.id).eq("business_id", biz.id).maybeSingle(),
      supabaseAdmin.from("email_events").select("event_type, created_at, metadata_json, campaign_id").eq("business_id", biz.id).eq("contact_id", data.id).order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("orders").select("id, amount, currency, payment_status, created_at, offer_id").eq("business_id", biz.id).eq("customer_id", data.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (!contact) throw new Error("Contact not found");

    const lifetimeValue = (orders ?? []).filter((o) => o.payment_status === "paid").reduce((s, o) => s + Number(o.amount ?? 0), 0);
    const timeline: Array<{ kind: string; at: string; label: string; meta?: any }> = [];
    for (const e of events ?? []) timeline.push({ kind: `email_${e.event_type}`, at: e.created_at, label: `Email ${e.event_type}`, meta: e.metadata_json });
    for (const o of orders ?? []) timeline.push({ kind: `order_${o.payment_status}`, at: o.created_at, label: `${o.payment_status === "paid" ? "Paid" : "Pending"} order ${Number(o.amount ?? 0).toFixed(2)} ${o.currency || "USD"}`, meta: { id: o.id } });
    timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return { contact, timeline, orders: orders ?? [], lifetime_value: lifetimeValue };
  });
