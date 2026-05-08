import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  generateUgcScript, listUgcScripts, getUgcScript, updateUgcScript,
  regenerateUgcScene, duplicateUgcScript, deleteUgcScript,
  PLATFORMS, PLATFORM_LABEL, LENGTHS, type Platform, type Length,
} from "@/lib/ai/ugcScript.functions";
import { generateStoryboard } from "@/lib/ai/ugcVideo.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Sparkles, Loader2, Copy, RefreshCw, Trash2, Wand2, Film, Save,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({ scriptId: z.string().uuid().optional() }).partial();

export const Route = createFileRoute("/_authenticated/dashboard/ugc/$businessId")({
  validateSearch: (s) => searchSchema.parse(s),
  component: UgcScriptEditor,
});

type Row = {
  id: string;
  title: string | null;
  platform: string | null;
  performance_score: number | null;
  status: string | null;
  script_json: any;
};

function UgcScriptEditor() {
  const { businessId } = Route.useParams();
  const search = useSearch({ from: "/_authenticated/dashboard/ugc/$businessId" });

  const genFn = useServerFn(generateUgcScript);
  const listFn = useServerFn(listUgcScripts);
  const getFn = useServerFn(getUgcScript);
  const updateFn = useServerFn(updateUgcScript);
  const regenSceneFn = useServerFn(regenerateUgcScene);
  const dupFn = useServerFn(duplicateUgcScript);
  const delFn = useServerFn(deleteUgcScript);
  const storyboardFn = useServerFn(generateStoryboard);

  const [bizName, setBizName] = useState("");
  const [items, setItems] = useState<Row[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(search.scriptId ?? null);
  const [active, setActive] = useState<Row | null>(null);
  const [generating, setGenerating] = useState(false);
  const [savingScene, setSavingScene] = useState<number | null>(null);
  const [storyboardLoading, setStoryboardLoading] = useState(false);

  const [platform, setPlatform] = useState<Platform>("instagram_reels");
  const [length_s, setLength] = useState<Length>(30);
  const [brief, setBrief] = useState("");

  const refreshList = async () => {
    setItems(null);
    try {
      const res: any = await listFn({ data: { business_id: businessId } });
      setItems(res.items);
      if (!activeId && res.items.length > 0) setActiveId(res.items[0].id);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
      setItems([]);
    }
  };

  useEffect(() => {
    supabase.from("businesses").select("name").eq("id", businessId).maybeSingle()
      .then(({ data }) => setBizName(data?.name ?? ""));
    refreshList();
  }, [businessId]);

  useEffect(() => {
    if (!activeId) { setActive(null); return; }
    let cancelled = false;
    setActive(null);
    getFn({ data: { script_id: activeId } })
      .then((res: any) => { if (!cancelled) setActive(res.script); })
      .catch((e: any) => { if (!cancelled) toast.error(e?.message ?? "Failed to load script"); });
    return () => { cancelled = true; };
  }, [activeId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res: any = await genFn({ data: { business_id: businessId, platform, length_s, brief } });
      toast.success("Script generated");
      setActiveId(res.id);
      await refreshList();
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const updateActive = (next: Row) => setActive(next);

  const saveActive = async (showToast = true) => {
    if (!active) return;
    try {
      await updateFn({ data: { script_id: active.id, title: active.title ?? undefined, script_json: active.script_json } });
      if (showToast) toast.success("Saved");
      setItems((prev) => (prev ?? []).map((r) => r.id === active.id ? active : r));
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
  };

  const handleRegenScene = async (scene_no: number) => {
    if (!active) return;
    setSavingScene(scene_no);
    try {
      const res: any = await regenSceneFn({ data: { script_id: active.id, scene_no } });
      const next = { ...active, script_json: { ...active.script_json, scenes: (active.script_json.scenes ?? []).map((s: any) => s.scene_no === scene_no ? res.scene : s) } };
      setActive(next);
      toast.success("Scene regenerated");
    } catch (e: any) { toast.error(e?.message ?? "Regenerate failed"); }
    finally { setSavingScene(null); }
  };

  const handleDuplicate = async () => {
    if (!active) return;
    try {
      const res: any = await dupFn({ data: { script_id: active.id } });
      toast.success("Duplicated");
      setActiveId(res.id);
      await refreshList();
    } catch (e: any) { toast.error(e?.message ?? "Duplicate failed"); }
  };

  const handleDelete = async () => {
    if (!active) return;
    if (!(await confirmDialog({ title: "Delete this script?", destructive: true, confirmText: "Delete" }))) return;
    try {
      await delFn({ data: { script_id: active.id } });
      toast.success("Deleted");
      setActiveId(null);
      await refreshList();
    } catch (e: any) { toast.error(e?.message ?? "Delete failed"); }
  };

  const handleCopy = async () => {
    if (!active) return;
    const sj = active.script_json ?? {};
    const text = `${active.title}\n\nHook (3s): ${sj.hook_3s}\n\n${sj.spoken_script}\n\nOn-screen: ${sj.on_screen_text}\n\nCTA: ${sj.cta}`;
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleTurnIntoVideo = async () => {
    if (!active) return;
    setStoryboardLoading(true);
    try {
      const res: any = await storyboardFn({ data: { script_id: active.id, aspect_ratio: "9_16" } });
      toast.success("Storyboard ready");
      window.location.href = `/dashboard/videos/${businessId}?videoId=${res.id}`;
    } catch (e: any) { toast.error(e?.message ?? "Storyboard failed"); }
    finally { setStoryboardLoading(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/dashboard/ugc" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> All scripts
        </Link>
        <div className="text-sm text-muted-foreground">{bizName}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        {/* Generator + list */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">New script</h2>
              <p className="text-xs text-muted-foreground mt-1">2 credits · brand-aware</p>
            </div>
            <div>
              <Label>Platform</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => (
                  <button key={p} type="button" onClick={() => setPlatform(p)} className={`rounded-full border px-2.5 py-1 text-xs ${platform === p ? "bg-foreground text-background" : "hover:bg-secondary"}`}>{PLATFORM_LABEL[p]}</button>
                ))}
              </div>
            </div>
            <div>
              <Label>Length</Label>
              <div className="mt-2 flex gap-1.5">
                {LENGTHS.map((l) => (
                  <button key={l} type="button" onClick={() => setLength(l)} className={`rounded-full border px-3 py-1 text-xs ${length_s === l ? "bg-foreground text-background" : "hover:bg-secondary"}`}>{l}s</button>
                ))}
              </div>
            </div>
            <div>
              <Label>Direction (optional)</Label>
              <Textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. POV creator unboxing, fast cuts" />
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="w-full bg-brand-gradient text-primary-foreground shadow-glow">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate (2 credits)
            </Button>
          </div>

          <div className="rounded-2xl border bg-card p-3 space-y-1.5 max-h-[60vh] overflow-y-auto">
            <div className="px-2 py-1 text-xs uppercase tracking-wide text-muted-foreground">Your scripts</div>
            {items === null ? (
              <div className="space-y-2 p-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">No scripts yet. Generate your first one above.</div>
            ) : (
              items.map((r) => {
                const sj = (r.script_json ?? {}) as any;
                return (
                  <button
                    key={r.id} onClick={() => setActiveId(r.id)}
                    className={`w-full text-left rounded-lg p-2.5 text-sm transition-colors ${activeId === r.id ? "bg-secondary" : "hover:bg-secondary/60"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium line-clamp-1">{r.title ?? "Untitled"}</span>
                      {typeof r.performance_score === "number" && (
                        <Badge variant={r.performance_score >= 75 ? "default" : "secondary"} className="shrink-0">{r.performance_score}</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                      <span>{PLATFORM_LABEL[r.platform as Platform] ?? r.platform}</span>
                      {sj.length_s && <span>· {sj.length_s}s</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="space-y-4">
          {!activeId ? (
            <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
              Pick a script on the left or generate a new one.
            </div>
          ) : !active ? (
            <Skeleton className="h-[60vh] w-full rounded-2xl" />
          ) : (
            <ScriptDetail
              row={active}
              onChange={updateActive}
              onSave={() => saveActive(true)}
              onCopy={handleCopy}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onRegenScene={handleRegenScene}
              onTurnIntoVideo={handleTurnIntoVideo}
              storyboardLoading={storyboardLoading}
              savingScene={savingScene}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ScriptDetail({
  row, onChange, onSave, onCopy, onDuplicate, onDelete, onRegenScene, onTurnIntoVideo, storyboardLoading, savingScene,
}: {
  row: Row;
  onChange: (r: Row) => void;
  onSave: () => void; onCopy: () => void; onDuplicate: () => void; onDelete: () => void;
  onRegenScene: (n: number) => void;
  onTurnIntoVideo: () => void;
  storyboardLoading: boolean;
  savingScene: number | null;
}) {
  const sj = row.script_json ?? {};
  const setSJ = (patch: any) => onChange({ ...row, script_json: { ...sj, ...patch } });
  const setScene = (n: number, patch: any) => setSJ({
    scenes: (sj.scenes ?? []).map((s: any) => s.scene_no === n ? { ...s, ...patch } : s),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <Input
              value={row.title ?? ""}
              onChange={(e) => onChange({ ...row, title: e.target.value })}
              className="text-xl font-semibold"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="outline">{PLATFORM_LABEL[row.platform as Platform] ?? row.platform}</Badge>
              {sj.length_s && <Badge variant="outline">{sj.length_s}s</Badge>}
              {typeof row.performance_score === "number" && (
                <Badge variant={row.performance_score >= 75 ? "default" : "secondary"}>Score {row.performance_score}</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onCopy}><Copy className="h-3.5 w-3.5" /> Copy</Button>
            <Button variant="outline" size="sm" onClick={onSave}><Save className="h-3.5 w-3.5" /> Save</Button>
            <Button variant="outline" size="sm" onClick={onDuplicate}><Wand2 className="h-3.5 w-3.5" /> Duplicate</Button>
            <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Hook (first 3s)" value={sj.hook_3s ?? ""} onChange={(v) => setSJ({ hook_3s: v })} rows={2} />
          <Field label="CTA" value={sj.cta ?? ""} onChange={(v) => setSJ({ cta: v })} rows={2} />
          <Field label="Target customer" value={sj.target_customer ?? ""} onChange={(v) => setSJ({ target_customer: v })} rows={2} />
          <Field label="Creator direction" value={sj.creator_direction ?? ""} onChange={(v) => setSJ({ creator_direction: v })} rows={2} />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <h3 className="font-medium">Scenes</h3>
        <div className="space-y-3">
          {(sj.scenes ?? []).map((s: any) => (
            <div key={s.scene_no} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">Scene {s.scene_no} · {s.duration_s}s</div>
                <Button size="sm" variant="outline" onClick={() => onRegenScene(s.scene_no)} disabled={savingScene === s.scene_no}>
                  {savingScene === s.scene_no ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Regenerate (1 credit)
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <Field label="Visual" value={s.visual ?? ""} onChange={(v) => setScene(s.scene_no, { visual: v })} rows={2} />
                <Field label="B-roll" value={s.b_roll ?? ""} onChange={(v) => setScene(s.scene_no, { b_roll: v })} rows={2} />
                <Field label="On-screen text" value={s.on_screen_text ?? ""} onChange={(v) => setScene(s.scene_no, { on_screen_text: v })} rows={2} />
                <Field label="Voiceover" value={s.voiceover ?? ""} onChange={(v) => setScene(s.scene_no, { voiceover: v })} rows={2} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <h3 className="font-medium">Spoken script & on-screen</h3>
        <Field label="Spoken script" value={sj.spoken_script ?? ""} onChange={(v) => setSJ({ spoken_script: v })} rows={6} />
        <Field label="On-screen text overlay" value={sj.on_screen_text ?? ""} onChange={(v) => setSJ({ on_screen_text: v })} rows={3} />
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-2">
        <h3 className="font-medium">Why it could work</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sj.why_it_could_work ?? ""}</p>
        {sj.score_reasoning && <p className="text-xs text-muted-foreground italic">Score reasoning: {sj.score_reasoning}</p>}
      </div>

      <div className="sticky bottom-3 z-10 rounded-2xl border bg-card/95 backdrop-blur p-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground">Approve before publish · no auto-posting</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSave}><Save className="h-3.5 w-3.5" /> Save changes</Button>
          <Button size="sm" onClick={onTurnIntoVideo} disabled={storyboardLoading} className="bg-brand-gradient text-primary-foreground shadow-glow">
            {storyboardLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
            Turn into AI video
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 text-sm" />
    </div>
  );
}
