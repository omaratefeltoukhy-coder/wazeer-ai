import { createFileRoute, Link } from "@tanstack/react-router";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listContacts, upsertContact, deleteContact, setContactTags, importContactsCsv, getContactTimeline } from "@/lib/crm/contacts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search, Trash2, Upload, X, Users, Mail, Phone, Tag, Clock, DollarSign, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/contacts/$businessId")({
  component: ContactsDetail,
});

type Contact = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  source: string | null;
  status: string | null;
  tags_json: string[] | null;
  unsubscribed_at: string | null;
  created_at: string;
};

type Stats = { total: number; active: number; unsub: number; suppressed: number; new30: number };
type TagAgg = { tag: string; count: number };

const emptyForm = { id: "", email: "", name: "", phone: "", source: "manual", tags: "", consent: false };

function ContactsDetail() {
  const { businessId } = Route.useParams();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tags, setTags] = useState<TagAgg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "unsubscribed" | "suppressed">("all");

  const [form, setForm] = useState({ ...emptyForm });
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importConsent, setImportConsent] = useState(false);

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<any>(null);

  const callList = useServerFn(listContacts);
  const callUpsert = useServerFn(upsertContact);
  const callDelete = useServerFn(deleteContact);
  const callSetTags = useServerFn(setContactTags);
  const callImport = useServerFn(importContactsCsv);
  const callTimeline = useServerFn(getContactTimeline);

  const load = async () => {
    setLoading(true);
    try {
      const r = await callList({ data: { business_id: businessId, search, tag: activeTag, status: statusFilter, limit: 200 } });
      setContacts(r.contacts as Contact[]);
      setStats(r.stats as Stats);
      setTags(r.tags as TagAgg[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [businessId, activeTag, statusFilter]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search]);

  useEffect(() => {
    if (!drawerId) { setDrawer(null); return; }
    (async () => {
      try {
        const r = await callTimeline({ data: { business_id: businessId, id: drawerId } });
        setDrawer(r);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load timeline");
      }
    })();
    // eslint-disable-next-line
  }, [drawerId]);

  const openNew = () => { setForm({ ...emptyForm }); setEditorOpen(true); };
  const openEdit = (c: Contact) => {
    setForm({
      id: c.id, email: c.email ?? "", name: c.name ?? "", phone: c.phone ?? "",
      source: c.source ?? "manual", tags: (c.tags_json ?? []).join(", "), consent: false,
    });
    setEditorOpen(true);
  };

  const onSave = async () => {
    try {
      await callUpsert({ data: {
        business_id: businessId,
        id: form.id || undefined,
        email: form.email || null,
        name: form.name || null,
        phone: form.phone || null,
        source: form.source || null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        status: "active",
        consent: !!form.consent,
      } });
      toast.success(form.id ? "Contact updated" : "Contact added");
      setEditorOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const onDelete = async (id: string) => {
    if (!(await confirmDialog({ title: "Delete contact?", description: "This cannot be undone.", destructive: true, confirmText: "Delete" }))) return;
    try {
      await callDelete({ data: { business_id: businessId, id } });
      toast.success("Contact deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const onRemoveTag = async (c: Contact, tag: string) => {
    const next = (c.tags_json ?? []).filter((t) => t !== tag);
    try {
      await callSetTags({ data: { business_id: businessId, id: c.id, tags: next } });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tag update failed");
    }
  };

  const onImport = async () => {
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const idx = (k: string) => header.indexOf(k);
    const rows = lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      return {
        email: idx("email") >= 0 ? cells[idx("email")] : null,
        name: idx("name") >= 0 ? cells[idx("name")] : null,
        phone: idx("phone") >= 0 ? cells[idx("phone")] : null,
        tags: idx("tags") >= 0 && cells[idx("tags")] ? cells[idx("tags")].split("|").map((t) => t.trim()).filter(Boolean) : [],
      };
    });
    if (!rows.length) return;
    try {
      const r = await callImport({ data: { business_id: businessId, rows, consent: importConsent } });
      toast.success(`Imported ${r.imported} contacts (${r.skipped} skipped)`);
      setImportOpen(false);
      setCsvText("");
      setImportConsent(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  };

  const filtered = useMemo(() => contacts ?? [], [contacts]);

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link to="/dashboard/contacts" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3 w-3" /> All contacts</Link>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Contacts</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import CSV</Button>
          <Button onClick={openNew} className="bg-brand-gradient text-primary-foreground shadow-glow"><Plus className="h-4 w-4" /> Add contact</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total", value: stats?.total ?? 0, icon: Users },
          { label: "Active", value: stats?.active ?? 0, icon: Users },
          { label: "Unsubscribed", value: stats?.unsub ?? 0, icon: Mail },
          { label: "New (30d)", value: stats?.new30 ?? 0, icon: Plus },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</span><s.icon className="h-4 w-4 text-muted-foreground" /></div>
            <div className="mt-2 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or phone" className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-lg border bg-background px-3 py-2 text-sm h-9">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="suppressed">Suppressed</option>
        </select>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Tag className="h-3 w-3" /> Tags:</span>
          <button onClick={() => setActiveTag("")} className={`text-xs rounded-full px-2 py-1 border ${activeTag === "" ? "bg-secondary" : "bg-card hover:bg-secondary/60"}`}>All</button>
          {tags.map((t) => (
            <button key={t.tag} onClick={() => setActiveTag(t.tag)} className={`text-xs rounded-full px-2 py-1 border ${activeTag === t.tag ? "bg-secondary" : "bg-card hover:bg-secondary/60"}`}>
              {t.tag} <span className="text-muted-foreground">({t.count})</span>
            </button>
          ))}
        </div>
      )}

      {loading && contacts === null ? (
        <div className="space-y-2">{[0,1,2,3].map(i=><Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center mb-3"><Users className="h-5 w-5 text-primary-foreground" /></div>
          <h3 className="font-medium">No contacts yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Add a contact manually or import from CSV.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr_2fr_1.2fr_1.5fr_auto] px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b">
            <div>Name</div><div>Email</div><div>Phone</div><div>Tags</div><div></div>
          </div>
          {filtered.map((c) => (
            <div key={c.id} className="grid md:grid-cols-[2fr_2fr_1.2fr_1.5fr_auto] gap-2 px-4 py-3 text-sm border-b last:border-b-0 hover:bg-secondary/30">
              <button className="text-left font-medium truncate" onClick={() => setDrawerId(c.id)}>
                {c.name || "Unnamed contact"}
                {c.unsubscribed_at && <Badge variant="outline" className="ml-2">Unsub</Badge>}
              </button>
              <div className="truncate text-muted-foreground inline-flex items-center gap-1.5"><Mail className="h-3 w-3" /> {c.email || "—"}</div>
              <div className="truncate text-muted-foreground inline-flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone || "—"}</div>
              <div className="flex flex-wrap items-center gap-1">
                {(c.tags_json ?? []).slice(0, 4).map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs gap-1">
                    {t}
                    <button onClick={() => onRemoveTag(c, t)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
                {(c.tags_json ?? []).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <div className="flex items-center justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Edit contact" : "Add contact"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Source</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="lead, vip, newsletter" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} /> Has given marketing consent</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={onSave} className="bg-brand-gradient text-primary-foreground">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import contacts (CSV)</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Headers: <code>email,name,phone,tags</code>. Tags separated by <code>|</code>.</p>
          <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={8} placeholder={"email,name,phone,tags\njane@acme.com,Jane,+15550101,lead|vip"} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={importConsent} onChange={(e) => setImportConsent(e.target.checked)} /> All imported contacts have opted in to marketing</label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={onImport} className="bg-brand-gradient text-primary-foreground"><Upload className="h-4 w-4" /> Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timeline drawer */}
      <Dialog open={!!drawerId} onOpenChange={(o) => !o && setDrawerId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{drawer?.contact?.name || drawer?.contact?.email || "Contact"}</DialogTitle></DialogHeader>
          {!drawer ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Lifetime value</div><div className="text-xl font-semibold inline-flex items-center gap-1"><DollarSign className="h-4 w-4" /> {Number(drawer.lifetime_value).toFixed(2)}</div></div>
                <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Orders</div><div className="text-xl font-semibold">{drawer.orders.length}</div></div>
                <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Status</div><div className="text-sm font-medium capitalize">{drawer.contact.unsubscribed_at ? "Unsubscribed" : drawer.contact.status || "active"}</div></div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 inline-flex items-center gap-1"><Clock className="h-4 w-4" /> Activity timeline</h4>
                {drawer.timeline.length === 0 ? (
                  <div className="text-sm text-muted-foreground rounded-xl border p-4">No activity yet.</div>
                ) : (
                  <ol className="space-y-2 max-h-72 overflow-y-auto pr-2">
                    {drawer.timeline.map((t: any, i: number) => (
                      <li key={i} className="flex items-start justify-between gap-3 text-sm rounded-lg border p-2">
                        <div>
                          <div className="font-medium capitalize">{t.label}</div>
                          <div className="text-xs text-muted-foreground">{new Date(t.at).toLocaleString()}</div>
                        </div>
                        <Badge variant="outline" className="capitalize">{t.kind.replace(/_/g, " ")}</Badge>
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
