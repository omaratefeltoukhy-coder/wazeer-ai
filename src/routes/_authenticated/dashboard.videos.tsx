import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listUgcVideos } from "@/lib/ai/ugcVideo.functions";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Video as VideoIcon, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/videos")({
  component: VideosList,
});

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  rendering: "secondary",
  ready: "default",
  failed: "destructive",
  posted: "outline",
};

function VideosList() {
  const listFn = useServerFn(listUgcVideos);
  const [items, setItems] = useState<any[] | null>(null);
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [filterBiz, setFilterBiz] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  useEffect(() => {
    supabase.from("businesses").select("id, name").order("created_at", { ascending: false })
      .then(({ data }) => setBusinesses(data ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    listFn({ data: { business_id: filterBiz || null, status: filterStatus || null } })
      .then((res: any) => { if (!cancelled) setItems(res.items); })
      .catch((e: any) => { if (!cancelled) { toast.error(e?.message ?? "Failed"); setItems([]); } });
    return () => { cancelled = true; };
  }, [filterBiz, filterStatus]);

  const bizName = (id: string) => businesses.find((b) => b.id === id)?.name ?? "Business";

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">AI UGC Videos</h1>
        <p className="text-sm text-muted-foreground mt-1">Storyboard your scripts and render videos. 10 credits per render.</p>
      </div>

      {businesses.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center mb-3">
            <VideoIcon className="h-5 w-5 text-primary-foreground" />
          </div>
          <h3 className="font-medium">Create a business first</h3>
          <Link to="/dashboard/new" search={{ idea: "" }} className="inline-flex items-center gap-2 mt-4 rounded-lg bg-brand-gradient text-primary-foreground px-3 py-2 text-sm font-medium shadow-glow">
            <Plus className="h-4 w-4" /> New business
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <select value={filterBiz} onChange={(e) => setFilterBiz(e.target.value)} className="rounded-md border bg-background px-2 py-2 text-sm">
              <option value="">All businesses</option>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-md border bg-background px-2 py-2 text-sm">
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="rendering">Rendering</option>
              <option value="ready">Ready</option>
              <option value="failed">Failed</option>
              <option value="posted">Posted / used</option>
            </select>
          </div>

          {items === null ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0,1,2,3].map((i) => <Skeleton key={i} className="aspect-[9/16] w-full rounded-2xl" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyVideos />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((v) => {
                const sb = v.storyboard_json ?? {};
                const usedFor = sb.used_for as string | undefined;
                const statusLabel = v.status === "posted" && usedFor === "ad" ? "used in ad" : v.status === "posted" ? "used in post" : v.status;
                return (
                  <Link
                    key={v.id}
                    to="/dashboard/videos/$businessId"
                    params={{ businessId: v.business_id }}
                    search={{ videoId: v.id } as any}
                    className="rounded-2xl border bg-card overflow-hidden hover:bg-secondary/40 transition-colors flex flex-col"
                  >
                    <div className="aspect-[9/16] bg-secondary relative grid place-items-center">
                      {v.video_url && v.status === "ready" ? (
                        <video src={v.video_url} className="absolute inset-0 h-full w-full object-cover" muted />
                      ) : (
                        <VideoIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                      <Badge className="absolute top-2 left-2 capitalize" variant={STATUS_COLORS[v.status] ?? "secondary"}>{statusLabel}</Badge>
                    </div>
                    <div className="p-3 text-xs">
                      <div className="font-medium line-clamp-1">{sb.script_title ?? "Untitled"}</div>
                      <div className="text-muted-foreground mt-0.5">{bizName(v.business_id)}</div>
                    </div>
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

function EmptyVideos() {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center mb-3">
        <VideoIcon className="h-5 w-5 text-primary-foreground" />
      </div>
      <h3 className="font-medium">No videos yet</h3>
      <p className="text-sm text-muted-foreground mt-1">Generate a UGC script, then click <strong>Turn into AI video</strong>.</p>
      <Link to="/dashboard/ugc" className="inline-flex items-center gap-2 mt-4 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-secondary">
        Go to UGC scripts
      </Link>
    </div>
  );
}
