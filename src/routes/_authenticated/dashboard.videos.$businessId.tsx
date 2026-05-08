import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listUgcVideos, getUgcVideo, updateStoryboard, regenerateStoryboardScene,
  renderUgcVideo, pollUgcVideoJob, useVideoForMeta, deleteUgcVideo,
} from "@/lib/ai/ugcVideo.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Sparkles, Loader2, RefreshCw, Trash2, Save, Download,
  Megaphone, ImagePlus, PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({ videoId: z.string().uuid().optional() }).partial();

export const Route = createFileRoute("/_authenticated/dashboard/videos/$businessId")({
  validateSearch: (s) => searchSchema.parse(s),
  component: VideoEditor,
});

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  rendering: "secondary",
  ready: "default",
  failed: "destructive",
  posted: "outline",
};

function VideoEditor() {
  const { businessId } = Route.useParams();
  const search = useSearch({ from: "/_authenticated/dashboard/videos/$businessId" });

  const listFn = useServerFn(listUgcVideos);
  const getFn = useServerFn(getUgcVideo);
  const updateFn = useServerFn(updateStoryboard);
  const regenSceneFn = useServerFn(regenerateStoryboardScene);
  const renderFn = useServerFn(renderUgcVideo);
  const pollFn = useServerFn(pollUgcVideoJob);
  const useMetaFn = useServerFn(useVideoForMeta);
  const delFn = useServerFn(deleteUgcVideo);

  const [bizName, setBizName] = useState("");
  const [items, setItems] = useState<any[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(search.videoId ?? null);
  const [active, setActive] = useState<any | null>(null);
  const [scriptInfo, setScriptInfo] = useState<{ title?: string; platform?: string } | null>(null);
  const [savingScene, setSavingScene] = useState<number | null>(null);
  const [rendering, setRendering] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshList = async () => {
    setItems(null);
    try {
      const res: any = await listFn({ data: { business_id: businessId } });
      setItems(res.items);
      if (!activeId && res.items.length > 0) setActiveId(res.items[0].id);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); setItems([]); }
  };

  useEffect(() => {
    supabase.from("businesses").select("name").eq("id", businessId).maybeSingle()
      .then(({ data }) => setBizName(data?.name ?? ""));
    refreshList();
  }, [businessId]);

  const loadActive = async (id: string) => {
    try {
      const res: any = await getFn({ data: { video_id: id } });
      setActive(res.video);
      setScriptInfo(res.script ? { title: res.script.title, platform: res.script.platform } : null);
    } catch (e: any) { toast.error(e?.message ?? "Failed to load"); }
  };

  useEffect(() => {
    if (!activeId) { setActive(null); return; }
    setActive(null);
    loadActive(activeId);
  }, [activeId]);

  // Poll while rendering
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (active?.status !== "rendering") return;
    pollRef.current = setInterval(async () => {
      try {
        const res: any = await pollFn({ data: { video_id: active.id } });
        if (res.status === "ready") {
          toast.success("Video ready");
          await loadActive(active.id);
          await refreshList();
        } else if (res.status === "failed") {
          toast.error("Render failed");
          await loadActive(active.id);
        }
      } catch {}
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [active?.id, active?.status]);

  const handleSave = async () => {
    if (!active) return;
    try {
      await updateFn({ data: { video_id: active.id, storyboard_json: active.storyboard_json } });
      toast.success("Saved");
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
  };

  const handleRegenScene = async (scene_no: number) => {
    if (!active) return;
    setSavingScene(scene_no);
    try {
      const res: any = await regenSceneFn({ data: { video_id: active.id, scene_no } });
      const sb = active.storyboard_json ?? {};
      setActive({ ...active, storyboard_json: { ...sb, scene_prompts: (sb.scene_prompts ?? []).map((s: any) => s.scene_no === scene_no ? res.scene : s) } });
      toast.success("Scene regenerated");
    } catch (e: any) { toast.error(e?.message ?? "Regenerate failed"); }
    finally { setSavingScene(null); }
  };

  const handleRender = async () => {
    if (!active) return;
    if (!(await confirmDialog({ title: "Render this video?", description: "10 credits will be used.", confirmText: "Render" }))) return;
    setRendering(true);
    try {
      await handleSave();
      await renderFn({ data: { video_id: active.id } });
      toast.success("Render started");
      await loadActive(active.id);
      await refreshList();
    } catch (e: any) { toast.error(e?.message ?? "Render failed"); }
    finally { setRendering(false); }
  };

  const handleDelete = async () => {
    if (!active) return;
    if (!(await confirmDialog({ title: "Delete this video?", destructive: true, confirmText: "Delete" }))) return;
    try {
      await delFn({ data: { video_id: active.id } });
      toast.success("Deleted");
      setActiveId(null);
      await refreshList();
    } catch (e: any) { toast.error(e?.message ?? "Delete failed"); }
  };

  const handleUseFor = async (target: "post" | "ad") => {
    if (!active) return;
    try {
      await useMetaFn({ data: { video_id: active.id, target } });
      toast.success(target === "ad" ? "Drafted to a Meta ad placeholder" : "Drafted to a Meta post placeholder", {
        description: "Stage 7 (Meta) will pick this up.",
      });
      await loadActive(active.id);
      await refreshList();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/dashboard/videos" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> All videos
        </Link>
        <div className="text-sm text-muted-foreground">{bizName}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px,1fr]">
        {/* Left: list */}
        <div className="rounded-2xl border bg-card p-3 space-y-1.5 max-h-[80vh] overflow-y-auto">
          <div className="px-2 py-1 text-xs uppercase tracking-wide text-muted-foreground">Your videos</div>
          {items === null ? (
            <div className="space-y-2 p-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">No videos yet. Generate one from a UGC script.</div>
          ) : (
            items.map((r: any) => {
              const sb = r.storyboard_json ?? {};
              return (
                <button key={r.id} onClick={() => setActiveId(r.id)}
                  className={`w-full text-left rounded-lg p-2.5 text-sm transition-colors ${activeId === r.id ? "bg-secondary" : "hover:bg-secondary/60"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium line-clamp-1">{sb.script_title ?? "Untitled"}</span>
                    <Badge variant={STATUS_COLORS[r.status] ?? "secondary"} className="capitalize shrink-0">{r.status}</Badge>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: detail */}
        <div className="space-y-4">
          {!activeId ? (
            <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
              Pick a video on the left or open one from a UGC script.
            </div>
          ) : !active ? (
            <Skeleton className="h-[60vh] w-full rounded-2xl" />
          ) : (
            <VideoDetail
              video={active}
              scriptInfo={scriptInfo}
              onChange={setActive}
              onSave={handleSave}
              onRegenScene={handleRegenScene}
              onRender={handleRender}
              onDelete={handleDelete}
              onUseFor={handleUseFor}
              rendering={rendering}
              savingScene={savingScene}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function VideoDetail({
  video, scriptInfo, onChange, onSave, onRegenScene, onRender, onDelete, onUseFor, rendering, savingScene,
}: any) {
  const sb = video.storyboard_json ?? {};
  const setSB = (patch: any) => onChange({ ...video, storyboard_json: { ...sb, ...patch } });
  const setScene = (n: number, patch: any) => setSB({
    scene_prompts: (sb.scene_prompts ?? []).map((s: any) => s.scene_no === n ? { ...s, ...patch } : s),
  });

  return (
    <div className="grid lg:grid-cols-[1fr,360px] gap-4">
      {/* Storyboard editor (left on desktop) */}
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Storyboard</div>
              <h2 className="text-xl font-semibold mt-1">{sb.script_title ?? "Untitled"}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant={STATUS_COLORS[video.status] ?? "secondary"} className="capitalize">{video.status}</Badge>
                <Badge variant="outline">{(sb.aspect_ratio ?? "9_16").replace("_", ":")}</Badge>
                {scriptInfo?.platform && <Badge variant="outline">{scriptInfo.platform}</Badge>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={onSave}><Save className="h-3.5 w-3.5" /> Save</Button>
              <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          {(sb.scene_prompts ?? []).map((s: any) => (
            <div key={s.scene_no} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">Scene {s.scene_no} · {s.duration_s}s</div>
                <Button size="sm" variant="outline" onClick={() => onRegenScene(s.scene_no)} disabled={savingScene === s.scene_no || video.status === "rendering"}>
                  {savingScene === s.scene_no ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Regenerate (2 credits)
                </Button>
              </div>
              <div>
                <Label className="text-xs">Text-to-video prompt</Label>
                <Textarea rows={3} className="mt-1 text-sm" value={s.prompt ?? ""} onChange={(e) => setScene(s.scene_no, { prompt: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">On-screen text</Label>
                  <Input className="mt-1 text-sm" value={s.on_screen_text ?? ""} onChange={(e) => setScene(s.scene_no, { on_screen_text: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Voiceover</Label>
                  <Input className="mt-1 text-sm" value={s.voiceover ?? ""} onChange={(e) => setScene(s.scene_no, { voiceover: e.target.value })} />
                </div>
              </div>
            </div>
          ))}

          <div className="grid sm:grid-cols-2 gap-2 pt-2">
            <div>
              <Label className="text-xs">Captions</Label>
              <Textarea rows={3} className="mt-1 text-sm" value={sb.captions ?? ""} onChange={(e) => setSB({ captions: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Hashtags (comma-separated)</Label>
              <Input className="mt-1 text-sm" value={(sb.hashtags ?? []).join(", ")} onChange={(e) => setSB({ hashtags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </div>
          </div>
        </div>
      </div>

      {/* Right: preview + actions */}
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-3">
          <div className="aspect-[9/16] rounded-xl overflow-hidden bg-secondary grid place-items-center relative">
            {video.video_url && video.status !== "rendering" ? (
              <video src={video.video_url} controls className="absolute inset-0 h-full w-full object-cover" />
            ) : video.status === "rendering" ? (
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <div className="text-xs text-muted-foreground mt-2">Rendering…</div>
              </div>
            ) : video.status === "failed" ? (
              <div className="text-center px-4">
                <div className="text-sm font-medium text-destructive">Render failed</div>
                {video.error_message && <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{video.error_message}</div>}
              </div>
            ) : (
              <div className="text-center">
                <PlayCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                <div className="text-xs text-muted-foreground mt-2">Approve & render to preview</div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <Button onClick={onRender} disabled={rendering || video.status === "rendering"} className="w-full bg-brand-gradient text-primary-foreground shadow-glow">
            {rendering || video.status === "rendering" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {video.status === "ready" ? "Re-render (10 credits)" : "Approve & render (10 credits)"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">Mock provider · swap with VIDEO_PROVIDER env</p>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">When ready</div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => onUseFor("post")} disabled={video.status !== "ready"}>
            <ImagePlus className="h-3.5 w-3.5" /> Use in Meta post
          </Button>
          <Button variant="outline" size="sm" className="w-full" onClick={() => onUseFor("ad")} disabled={video.status !== "ready"}>
            <Megaphone className="h-3.5 w-3.5" /> Use in Meta ad
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => video.video_url && window.open(video.video_url, "_blank")} disabled={video.status !== "ready"}>
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        </div>
      </div>
    </div>
  );
}
