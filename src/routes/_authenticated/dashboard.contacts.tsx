import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Users, Search, Filter, Download, Plus, Mail, Phone, DollarSign, Calendar, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/contacts")({
  component: MembersPage,
});

type Contact = {
  id: string;
  business_id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  source: string | null;
  status: string | null;
  tags_json: string[] | null;
  unsubscribed_at: string | null;
  created_at: string;
};

type Txn = {
  id: string;
  workspace_id: string;
  product_id: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
};

type Member = {
  key: string; // email lowercased or contact id
  contact?: Contact;
  email: string | null;
  name: string | null;
  phone: string | null;
  joined: string;
  tags: string[];
  ltv: number;
  orders: Txn[];
  status: "paid" | "free" | "abandoned";
};

type Tab = "all" | "free" | "paid" | "abandoned";

function MembersPage() {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [primaryBusinessId, setPrimaryBusinessId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [sortBy, setSortBy] = useState<"joined" | "ltv" | "name">("joined");

  const [openMember, setOpenMember] = useState<Member | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", tags: "" });

  const load = async () => {
    setLoading(true);
    try {
      const { data: bz } = await supabase.from("businesses").select("id").order("created_at", { ascending: true });
      const ids = (bz ?? []).map((b: any) => b.id);
      setBusinessIds(ids);
      setPrimaryBusinessId(ids[0] ?? null);
      const [{ data: cs }, { data: ts }] = await Promise.all([
        ids.length ? supabase.from("contacts").select("*").in("business_id", ids).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as Contact[] }),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      ]);
      setContacts((cs as Contact[]) ?? []);
      setTxns((ts as Txn[]) ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const members = useMemo<Member[]>(() => {
    const map = new Map<string, Member>();
    for (const c of contacts) {
      const key = (c.email || c.id).toLowerCase();
      map.set(key, {
        key,
        contact: c,
        email: c.email,
        name: c.name,
        phone: c.phone,
        joined: c.created_at,
        tags: Array.isArray(c.tags_json) ? c.tags_json : [],
        ltv: 0,
        orders: [],
        status: "free",
      });
    }
    for (const t of txns) {
      if (!t.buyer_email) continue;
      const key = t.buyer_email.toLowerCase();
      let m = map.get(key);
      if (!m) {
        m = {
          key, email: t.buyer_email, name: t.buyer_name, phone: null,
          joined: t.created_at, tags: [], ltv: 0, orders: [], status: "free",
        };
        map.set(key, m);
      }
      m.orders.push(t);
      if (t.status === "completed" || t.status === "paid") {
        m.ltv += Number(t.amount) || 0;
        m.status = "paid";
      } else if (m.status !== "paid" && (t.status === "pending" || t.status === "abandoned" || t.status === "failed")) {
        m.status = "abandoned";
      }
    }
    return Array.from(map.values());
  }, [contacts, txns]);

  const counts = useMemo(() => ({
    all: members.length,
    free: members.filter((m) => m.status === "free").length,
    paid: members.filter((m) => m.status === "paid").length,
    abandoned: members.filter((m) => m.status === "abandoned").length,
  }), [members]);

  const filtered = useMemo(() => {
    const since = (() => {
      if (dateFilter === "all") return 0;
      const d = dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 90;
      return Date.now() - d * 86400000;
    })();
    const s = search.trim().toLowerCase();
    const list = members.filter((m) => {
      if (tab !== "all" && m.status !== tab) return false;
      if (since && new Date(m.joined).getTime() < since) return false;
      if (s) {
        const hay = `${m.name ?? ""} ${m.email ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      if (sortBy === "ltv") return b.ltv - a.ltv;
      if (sortBy === "name") return (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "");
      return new Date(b.joined).getTime() - new Date(a.joined).getTime();
    });
    return list;
  }, [members, tab, search, dateFilter, sortBy]);

  const exportCsv = () => {
    const headers = ["Name", "Email", "Phone", "Status", "LTV", "Orders", "Tags", "Joined"];
    const rows = filtered.map((m) => [
      m.name ?? "", m.email ?? "", m.phone ?? "", m.status,
      m.ltv.toFixed(2), m.orders.length, m.tags.join("|"), m.joined,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onAdd = async () => {
    if (!primaryBusinessId) { toast.error("Create a business first"); return; }
    if (!form.email && !form.phone) { toast.error("Email or phone required"); return; }
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("contacts").insert({
      business_id: primaryBusinessId,
      email: form.email || null,
      name: form.name || null,
      phone: form.phone || null,
      source: "manual",
      status: "active",
      tags_json: tags as never,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Customer added");
    setAddOpen(false);
    setForm({ name: "", email: "", phone: "", tags: "" });
    load();
  };

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: "all", label: "All", n: counts.all },
    { id: "free", label: "Free", n: counts.free },
    { id: "paid", label: "Paid", n: counts.paid },
    { id: "abandoned", label: "Abandoned Checkout", n: counts.abandoned },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">Free members, paying customers, and abandoned checkouts in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
          <Button onClick={() => setAddOpen(true)} className="bg-brand-gradient text-primary-foreground shadow-glow"><Plus className="h-4 w-4" /> Add customer</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t-md -mb-px border-b-2 transition-colors ${tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label} <span className="ml-1 text-xs text-muted-foreground">({t.n})</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" className="pl-9" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline"><Filter className="h-4 w-4" /> Filter</Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3">
            <div>
              <Label className="text-xs">Date joined</Label>
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as never)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                <option value="all">All time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Sort by</Label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as never)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                <option value="joined">Recently joined</option>
                <option value="ltv">Highest LTV</option>
                <option value="name">Name (A–Z)</option>
              </select>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center mb-3"><Users className="h-5 w-5 text-primary-foreground" /></div>
          <h3 className="font-medium">No customers yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Customers will appear here as they sign up or buy from you.</p>
          <Button onClick={() => setAddOpen(true)} className="mt-4 bg-brand-gradient text-primary-foreground"><Plus className="h-4 w-4" /> Add your first customer</Button>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b">
            <div>Name</div><div>Email</div><div>Status</div><div>LTV</div><div>Joined</div><div></div>
          </div>
          {filtered.map((m) => (
            <button
              key={m.key}
              onClick={() => setOpenMember(m)}
              className="w-full text-left grid md:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-2 px-4 py-3 text-sm border-b last:border-b-0 hover:bg-secondary/30 items-center"
            >
              <div className="font-medium truncate">{m.name || "Unnamed customer"}</div>
              <div className="truncate text-muted-foreground inline-flex items-center gap-1.5"><Mail className="h-3 w-3" /> {m.email || "—"}</div>
              <div><StatusBadge status={m.status} /></div>
              <div className="font-medium">${m.ltv.toFixed(2)}</div>
              <div className="text-muted-foreground">{new Date(m.joined).toLocaleDateString()}</div>
              <div className="text-xs text-muted-foreground">{m.orders.length} orders</div>
            </button>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, newsletter" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={onAdd} className="bg-brand-gradient text-primary-foreground">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member detail */}
      <Dialog open={!!openMember} onOpenChange={(o) => !o && setOpenMember(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {openMember?.name || openMember?.email || "Customer"}
              {openMember && <StatusBadge status={openMember.status} />}
            </DialogTitle>
          </DialogHeader>
          {openMember && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <Stat icon={DollarSign} label="Lifetime value" value={`$${openMember.ltv.toFixed(2)}`} />
                <Stat icon={ShoppingBag} label="Orders" value={openMember.orders.length} />
                <Stat icon={Calendar} label="Joined" value={new Date(openMember.joined).toLocaleDateString()} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Email</div><div className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" /> {openMember.email || "—"}</div></div>
                <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Phone</div><div className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" /> {openMember.phone || "—"}</div></div>
              </div>
              {openMember.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {openMember.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold mb-2">Order history</h4>
                {openMember.orders.length === 0 ? (
                  <div className="text-sm text-muted-foreground rounded-xl border p-4">No orders yet.</div>
                ) : (
                  <ol className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {openMember.orders.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 text-sm rounded-lg border p-3">
                        <div>
                          <div className="font-medium">${Number(o.amount).toFixed(2)} {o.currency}</div>
                          <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                        </div>
                        <Badge variant="outline" className="capitalize">{o.status}</Badge>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: Member["status"] }) {
  const map: Record<Member["status"], { label: string; cls: string }> = {
    paid: { label: "Paid", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
    free: { label: "Free", cls: "bg-secondary text-foreground border-border" },
    abandoned: { label: "Abandoned", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  };
  const m = map[status];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground inline-flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
