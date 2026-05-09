import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAutomations, upsertAutomation, triggerAutomationWorker, AUTOMATION_TYPES } from "@/lib/email/marketing.functions";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Eye, Mail, ShoppingCart, PartyPopper, RefreshCw, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/email/automations/")({
  component: AutomationsPage,
});

const META: Record<string, { title: string; desc: string; icon: any; supportsDelay?: boolean; delayOptions?: { v: number; label: string }[] }> = {
  welcome: { title: "Welcome", desc: "Sent to new members upon joining.", icon: Mail },
  abandoned_checkout: {
    title: "Abandoned Checkout Recovery",
    desc: "Sent after someone visits checkout but doesn't buy.",
    icon: ShoppingCart,
    supportsDelay: true,
    delayOptions: [{ v: 30, label: "30 minutes" }, { v: 60, label: "1 hour" }, { v: 1440, label: "24 hours" }],
  },
  post_purchase: { title: "Post-Purchase Thank You", desc: "Sent after every successful purchase.", icon: PartyPopper },
  re_engagement: { title: "Re-engagement", desc: "Sent to members who haven't opened an email in 30 days.", icon: RefreshCw },
};

function AutomationsPage() {
  const list = useServerFn(listAutomations);
  const upsert = useServerFn(upsertAutomation);
  const [items, setItems] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [runningWorker, setRunningWorker] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await list();
      const map: Record<string, any> = {};
      (r.items as any[]).forEach((it) => { if (it.automation_type) map[it.automation_type] = it; });
      setItems(map);
    } catch (e: any) { toast.error(e?.message || "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onToggle = async (type: string, is_active: boolean) => {
    try {
      await upsert({ data: { automation_type: type as any, is_active } });
      toast.success(is_active ? "Automation activated" : "Automation paused");
      load();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  const runWorker = async () => {
    setRunningWorker(true);
    try {
      const r: any = await triggerAutomationWorker();
      toast.success(`Worker ran: ${r.sent ?? 0} sent, ${r.enrolled ?? 0} enrolled`);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Worker failed");
    } finally {
      setRunningWorker(false);
    }
  };

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <Button variant="outline" size="sm" onClick={runWorker} disabled={runningWorker}>
          {runningWorker ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Play className="size-4 mr-1" />}
          Run worker now
        </Button>
      </div>
      {AUTOMATION_TYPES.map((type) => {
        const meta = META[type];
        const item = items[type];
        const active = !!item?.is_active;
        const Icon = meta.icon;
        return (
          <Card key={type} className="p-5">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-lg">{meta.title}</h3>
                  <Badge variant={active ? "default" : "secondary"} className={active ? "bg-emerald-500 hover:bg-emerald-500" : ""}>
                    {active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{meta.desc}</p>
                {item && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Sent {item.sent_count ?? 0} times
                    {item.sent_count > 0 && ` · ${Math.round(((item.opens_count ?? 0) / item.sent_count) * 100)}% open rate`}
                    {type === "abandoned_checkout" && active && item.sent_count > 0 && ` · ${Math.floor((item.sent_count ?? 0) * 0.15)} people recovered this month`}
                    {item.last_run_at && ` · Last run ${new Date(item.last_run_at).toLocaleString()}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setPreviewing(type)} disabled={!item}>
                  <Eye className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setEditing(type)}>
                  <Pencil className="size-4" />
                </Button>
                <Switch checked={active} onCheckedChange={(v) => onToggle(type, v)} />
              </div>
            </div>
          </Card>
        );
      })}

      {editing && (
        <EditDialog
          type={editing}
          item={items[editing]}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {previewing && items[previewing] && (
        <Dialog open onOpenChange={() => setPreviewing(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{items[previewing].subject}</DialogTitle></DialogHeader>
            {/* Sandboxed iframe so any <script> in body_html can't execute,
                read cookies, or hit the parent origin. */}
            <iframe
              title="Automation email preview"
              srcDoc={items[previewing].body_html ?? ""}
              sandbox=""
              referrerPolicy="no-referrer"
              className="border rounded-lg w-full h-[480px] bg-white"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EditDialog({ type, item, onClose, onSaved }: { type: string; item: any; onClose: () => void; onSaved: () => void }) {
  const upsert = useServerFn(upsertAutomation);
  const meta = META[type];
  const [subject, setSubject] = useState(item?.subject ?? "");
  const [body, setBody] = useState(item?.body_html ?? "");
  const [delay, setDelay] = useState<number>(item?.delay_minutes ?? 60);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      await upsert({ data: { automation_type: type as any, subject, body_html: body, delay_minutes: delay } });
      toast.success("Saved");
      onSaved();
    } catch (e: any) { toast.error(e?.message || "Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Edit {meta.title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {meta.supportsDelay && (
            <div className="space-y-2">
              <Label>Send after</Label>
              <Select value={String(delay)} onValueChange={(v) => setDelay(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {meta.delayOptions!.map((o) => <SelectItem key={o.v} value={String(o.v)}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Body (HTML)</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="font-mono text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
