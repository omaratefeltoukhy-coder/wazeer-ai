import { createFileRoute, Link } from "@tanstack/react-router";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAutomations, upsertAutomation, setAutomationStatus, deleteAutomation,
  TRIGGERS, ACTIONS, CONDITIONS, DELAYS,
} from "@/lib/ai/automation.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Plus, Workflow, Trash2, Play, Pause, Save } from "lucide-react";
import { toast } from "sonner";

type Step = {
  id: string;
  type: "delay" | "action" | "condition";
  delay?: typeof DELAYS[number];
  delay_custom?: string;
  action?: typeof ACTIONS[number];
  action_payload?: Record<string, any>;
  condition?: typeof CONDITIONS[number];
};

export const Route = createFileRoute("/_authenticated/dashboard/automations/$businessId")({
  component: AutomationBuilder,
});

const uid = () => Math.random().toString(36).slice(2, 10);

function emptyAutomation() {
  return {
    id: undefined as string | undefined,
    name: "New automation",
    trigger_type: "new_lead" as typeof TRIGGERS[number],
    status: "draft" as "draft" | "active" | "paused",
    steps_json: [
      { id: uid(), type: "delay", delay: "immediate" } as Step,
      { id: uid(), type: "action", action: "send_email", action_payload: { template: "" } } as Step,
    ],
  };
}

function AutomationBuilder() {
  const { businessId } = Route.useParams();
  const [biz, setBiz] = useState<any>(null);
  const [items, setItems] = useState<any[] | null>(null);
  const [active, setActive] = useState<any>(null);
  const listFn = useServerFn(listAutomations);
  const saveFn = useServerFn(upsertAutomation);
  const statusFn = useServerFn(setAutomationStatus);
  const delFn = useServerFn(deleteAutomation);

  useEffect(() => {
    supabase.from("businesses").select("id, name").eq("id", businessId).maybeSingle().then(({ data }) => setBiz(data));
    refresh();
  }, [businessId]);

  async function refresh() {
    const r: any = await listFn({ data: { business_id: businessId } });
    setItems(r.automations);
    if (!active && r.automations?.[0]) setActive({ ...r.automations[0] });
  }

  function newOne() { setActive(emptyAutomation()); }

  async function save() {
    if (!active) return;
    try {
      const r: any = await saveFn({ data: {
        id: active.id, business_id: businessId, name: active.name,
        trigger_type: active.trigger_type, steps_json: active.steps_json, status: active.status,
      }});
      toast.success("Saved");
      setActive({ ...active, id: r.id });
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
  }

  async function toggleStatus() {
    if (!active?.id) return toast.error("Save first");
    const next = active.status === "active" ? "paused" : "active";
    try {
      await statusFn({ data: { id: active.id, status: next } });
      setActive({ ...active, status: next });
      toast.success(next === "active" ? "Automation started" : "Automation paused");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function remove() {
    if (!active?.id) return setActive(null);
    if (!(await confirmDialog({ title: "Delete automation?", destructive: true, confirmText: "Delete" }))) return;
    await delFn({ data: { id: active.id } });
    toast.success("Deleted"); setActive(null); refresh();
  }

  function addStep(type: Step["type"]) {
    const step: Step = type === "delay" ? { id: uid(), type, delay: "1d" }
      : type === "action" ? { id: uid(), type, action: "send_email", action_payload: {} }
      : { id: uid(), type, condition: "opened_email" };
    setActive({ ...active, steps_json: [...active.steps_json, step] });
  }
  function updateStep(id: string, patch: Partial<Step>) {
    setActive({ ...active, steps_json: active.steps_json.map((s: Step) => s.id === id ? { ...s, ...patch } : s) });
  }
  function removeStep(id: string) {
    setActive({ ...active, steps_json: active.steps_json.filter((s: Step) => s.id !== id) });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link to="/dashboard/automations" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
            <ChevronLeft className="h-4 w-4" /> Automations
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{biz?.name ?? "Business"}</span>
        </div>
        <Button onClick={newOne} className="bg-brand-gradient text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> New automation</Button>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-5">
        <aside className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Flows</div>
          {items === null ? <Skeleton className="h-16 w-full" /> : items.length === 0 ? (
            <div className="text-sm text-muted-foreground rounded-xl border bg-card p-3">No automations yet.</div>
          ) : items.map((a) => (
            <button key={a.id} onClick={() => setActive({ ...a })}
              className={`w-full text-left rounded-xl border bg-card p-3 hover:bg-secondary/50 ${active?.id === a.id ? "ring-2 ring-primary/50" : ""}`}>
              <div className="text-sm font-medium line-clamp-1">{a.name}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant="outline" className="text-[10px] capitalize">{a.status}</Badge>
                <span className="text-[11px] text-muted-foreground">{a.trigger_type?.replace(/_/g, " ")}</span>
              </div>
            </button>
          ))}
        </aside>

        <section className="min-w-0">
          {!active ? (
            <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
              <Workflow className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              Select or create an automation.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <Input value={active.name} onChange={(e) => setActive({ ...active, name: e.target.value })}
                    className="text-lg font-semibold border-0 shadow-none px-0 h-auto py-1 focus-visible:ring-0 max-w-md" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={toggleStatus} disabled={!active.id}>
                      {active.status === "active" ? <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</> : <><Play className="h-3.5 w-3.5 mr-1" /> Start</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={remove}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
                    <Button size="sm" onClick={save} className="bg-brand-gradient text-primary-foreground"><Save className="h-3.5 w-3.5 mr-1" /> Save</Button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Trigger</div>
                    <select value={active.trigger_type} onChange={(e) => setActive({ ...active, trigger_type: e.target.value })}
                      className="w-full rounded-md border bg-background px-2 py-2 text-sm">
                      {TRIGGERS.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
                    <Badge variant={active.status === "active" ? "default" : "outline"} className="capitalize">{active.status}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {active.steps_json.map((s: Step, i: number) => (
                  <div key={s.id} className="rounded-2xl border bg-card p-4 flex flex-wrap items-center gap-3">
                    <Badge variant="outline">#{i + 1}</Badge>
                    <Badge className="capitalize">{s.type}</Badge>
                    {s.type === "delay" && (
                      <>
                        <select value={s.delay} onChange={(e) => updateStep(s.id, { delay: e.target.value as any })}
                          className="rounded-md border bg-background px-2 py-2 text-sm">
                          {DELAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        {s.delay === "custom" && (
                          <Input value={s.delay_custom ?? ""} onChange={(e) => updateStep(s.id, { delay_custom: e.target.value })}
                            placeholder="e.g. 36h, 5d" className="w-40" />
                        )}
                      </>
                    )}
                    {s.type === "action" && (
                      <>
                        <select value={s.action} onChange={(e) => updateStep(s.id, { action: e.target.value as any })}
                          className="rounded-md border bg-background px-2 py-2 text-sm">
                          {ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
                        </select>
                        {s.action === "send_email" && (
                          <Input value={s.action_payload?.template ?? ""} onChange={(e) => updateStep(s.id, { action_payload: { ...(s.action_payload ?? {}), template: e.target.value } })}
                            placeholder="Email template / campaign id" className="w-72" />
                        )}
                        {s.action === "add_tag" && (
                          <Input value={s.action_payload?.tag ?? ""} onChange={(e) => updateStep(s.id, { action_payload: { ...(s.action_payload ?? {}), tag: e.target.value } })}
                            placeholder="Tag name" className="w-48" />
                        )}
                      </>
                    )}
                    {s.type === "condition" && (
                      <select value={s.condition} onChange={(e) => updateStep(s.id, { condition: e.target.value as any })}
                        className="rounded-md border bg-background px-2 py-2 text-sm">
                        {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                      </select>
                    )}
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => removeStep(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => addStep("delay")}>+ Delay</Button>
                  <Button size="sm" variant="outline" onClick={() => addStep("action")}>+ Action</Button>
                  <Button size="sm" variant="outline" onClick={() => addStep("condition")}>+ Condition</Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
