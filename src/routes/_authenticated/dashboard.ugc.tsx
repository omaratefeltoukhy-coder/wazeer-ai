import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listUgcScripts, PLATFORMS, PLATFORM_LABEL, type Platform } from "@/lib/ai/ugcScript.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileVideo, Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/ugc")({
  component: UgcScriptsList,
});

type Row = {
  id: string;
  business_id: string;
  title: string | null;
  platform: string | null;
  performance_score: number | null;
  status: string | null;
  script_json: any;
  created_at: string;
};

function UgcScriptsList() {
  const listFn = useServerFn(listUgcScripts);
  const [items, setItems] = useState<Row[] | null>(null);
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [filterBiz, setFilterBiz] = useState<string>("");
  const [filterPlatform, setFilterPlatform] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "score">("recent");

  useEffect(() => {
    supabase.from("businesses").select("id, name").order("created_at", { ascending: false })
      .then(({ data }) => setBusinesses(data ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    listFn({ data: {
      business_id: filterBiz || null,
      platform: (filterPlatform as Platform) || null,
      search: search || undefined,
      sort,
    } })
      .then((res: any) => { if (!cancelled) setItems(res.items); })
      .catch((e: any) => { if (!cancelled) { toast.error(e?.message ?? "Failed to load"); setItems([]); } });
    return () => { cancelled = true; };
  }, [filterBiz, filterPlatform, search, sort]);

  const bizName = (id: string) => businesses.find((b) => b.id === id)?.name ?? "Business";

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">UGC Scripts</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-written, brand-aware scripts for short-form video. 2 credits per script.</p>
      </div>

      {businesses.length === 0 ? (
        <EmptyNoBusinesses />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title…" className="pl-8 w-56" />
            </div>
            <select value={filterBiz} onChange={(e) => setFilterBiz(e.target.value)} className="rounded-md border bg-background px-2 py-2 text-sm">
              <option value="">All businesses</option>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} className="rounded-md border bg-background px-2 py-2 text-sm">
              <option value="">All platforms</option>
              {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="rounded-md border bg-background px-2 py-2 text-sm">
              <option value="recent">Sort: Most recent</option>
              <option value="score">Sort: Highest score</option>
            </select>
            <div className="ml-auto flex gap-2">
              {businesses.slice(0, 1).map((b) => (
                <Link key={b.id} to="/dashboard/ugc/$businessId" params={{ businessId: b.id }}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient text-primary-foreground px-3 py-2 text-sm font-medium shadow-glow">
                  <Plus className="h-4 w-4" /> New script
                </Link>
              ))}
            </div>
          </div>

          {items === null ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0,1,2,3,4,5].map((i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyNoScripts />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((r) => {
                const sj = (r.script_json ?? {}) as any;
                return (
                  <Link
                    key={r.id}
                    to="/dashboard/ugc/$businessId"
                    params={{ businessId: r.business_id }}
                    search={{ scriptId: r.id } as any}
                    className="rounded-2xl border bg-card p-4 hover:bg-secondary/40 transition-colors flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium leading-tight line-clamp-2">{r.title ?? "Untitled"}</h3>
                      {typeof r.performance_score === "number" && (
                        <Badge variant={r.performance_score >= 75 ? "default" : "secondary"}>{r.performance_score}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {r.platform && <Badge variant="outline">{PLATFORM_LABEL[r.platform as Platform] ?? r.platform}</Badge>}
                      {sj.length_s && <Badge variant="outline">{sj.length_s}s</Badge>}
                      <Badge variant="outline" className="capitalize">{r.status ?? "draft"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">{sj.hook_3s ?? sj.spoken_script ?? ""}</p>
                    <div className="text-xs text-muted-foreground mt-auto">{bizName(r.business_id)}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyNoBusinesses() {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center mb-3">
        <FileVideo className="h-5 w-5 text-primary-foreground" />
      </div>
      <h3 className="font-medium">Create a business first</h3>
      <p className="text-sm text-muted-foreground mt-1">UGC scripts are written from your brand profile.</p>
      <Link to="/dashboard/new" className="inline-flex items-center gap-2 mt-4 rounded-lg bg-brand-gradient text-primary-foreground px-3 py-2 text-sm font-medium shadow-glow">
        <Plus className="h-4 w-4" /> New business
      </Link>
    </div>
  );
}

function EmptyNoScripts() {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center mb-3">
        <FileVideo className="h-5 w-5 text-primary-foreground" />
      </div>
      <h3 className="font-medium">No scripts yet</h3>
      <p className="text-sm text-muted-foreground mt-1">Open a business above to generate your first script.</p>
    </div>
  );
}
