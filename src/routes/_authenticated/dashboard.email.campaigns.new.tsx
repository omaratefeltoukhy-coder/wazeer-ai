import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { upsertCampaign, sendCampaign, generateCampaignSubject, generateCampaignBody } from "@/lib/email/marketing.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Sparkles, Loader2, Eye, Send, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/email/campaigns/new")({
  component: NewCampaignPage,
});

function NewCampaignPage() {
  const navigate = useNavigate();
  const upsert = useServerFn(upsertCampaign);
  const send = useServerFn(sendCampaign);
  const aiSubject = useServerFn(generateCampaignSubject);
  const aiBody = useServerFn(generateCampaignBody);

  const [name, setName] = useState("");
  const [audience, setAudience] = useState<"all" | "paid" | "free" | "manual">("all");
  const [manualEmails, setManualEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [goal, setGoal] = useState("");
  const [aiSubLoading, setAiSubLoading] = useState(false);
  const [aiBodyLoading, setAiBodyLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const onAiSubject = async () => {
    setAiSubLoading(true);
    try { const r = await aiSubject({ data: { goal } }); setSubject(r.subject); }
    catch (e: any) { toast.error(e?.message || "AI failed"); }
    finally { setAiSubLoading(false); }
  };
  const onAiBody = async () => {
    setAiBodyLoading(true);
    try { const r = await aiBody({ data: { subject, goal } }); setBody(r.body_html); }
    catch (e: any) { toast.error(e?.message || "AI failed"); }
    finally { setAiBodyLoading(false); }
  };

  const validate = () => {
    if (!name.trim()) return "Add a campaign name";
    if (!subject.trim()) return "Add a subject";
    if (!body.trim()) return "Add an email body";
    if (audience === "manual" && !manualEmails.trim()) return "Add at least one email";
    if (scheduleLater && !scheduledAt) return "Pick a schedule date";
    return null;
  };

  const handleSave = async (sendNow: boolean) => {
    const err = validate(); if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const r = await upsert({ data: {
        name, subject, body_html: body,
        audience_type: audience,
        manual_emails: audience === "manual" ? manualEmails.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : [],
        scheduled_at: scheduleLater ? new Date(scheduledAt).toISOString() : null,
      } });
      if (sendNow) {
        const s = await send({ data: { id: r.id } });
        if (s.mock) toast.warning(`Saved + simulated send to ${s.total} recipient(s). Add RESEND_API_KEY to send for real.`);
        else toast.success(`Sent to ${s.sent} recipient(s)${s.failed ? ` (${s.failed} failed)` : ""}`);
      } else if (scheduleLater) {
        toast.success("Campaign scheduled");
      } else {
        toast.success("Draft saved");
      }
      navigate({ to: "/dashboard/email/campaigns" });
    } catch (e: any) {
      toast.error(e?.message || "Could not save campaign");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/dashboard/email/campaigns" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 mr-1" />Back to campaigns
      </Link>

      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <Label className="text-base font-semibold">Campaign name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. November launch" />
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">1. Audience</Label>
          <Select value={audience} onValueChange={(v) => setAudience(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              <SelectItem value="paid">Paid members</SelectItem>
              <SelectItem value="free">Free members</SelectItem>
              <SelectItem value="manual">Manual list</SelectItem>
            </SelectContent>
          </Select>
          {audience === "manual" && (
            <Textarea value={manualEmails} onChange={(e) => setManualEmails(e.target.value)} rows={3} placeholder="one@email.com, two@email.com" />
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">Topic / goal (helps AI)</Label>
          <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Black Friday sale, 30% off…" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">2. Subject line</Label>
            <Button variant="ghost" size="sm" onClick={onAiSubject} disabled={aiSubLoading}>
              {aiSubLoading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Sparkles className="size-3.5 mr-1" />}
              AI generate
            </Button>
          </div>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Don't miss this…" maxLength={200} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">3. Email body (HTML)</Label>
            <Button variant="ghost" size="sm" onClick={onAiBody} disabled={aiBodyLoading}>
              {aiBodyLoading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Sparkles className="size-3.5 mr-1" />}
              AI write
            </Button>
          </div>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="<h2>Hello!</h2><p>…</p>" className="font-mono text-sm" />
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">4. Schedule</Label>
          <div className="flex gap-2">
            <Button variant={!scheduleLater ? "default" : "outline"} size="sm" onClick={() => setScheduleLater(false)}>Send now</Button>
            <Button variant={scheduleLater ? "default" : "outline"} size="sm" onClick={() => setScheduleLater(true)}>
              <Calendar className="size-3.5 mr-1" />Schedule
            </Button>
          </div>
          {scheduleLater && (
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          )}
        </div>

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}><Eye className="size-4 mr-2" />Preview</Button>
          {scheduleLater ? (
            <Button onClick={() => handleSave(false)} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Calendar className="size-4 mr-2" />}Schedule
            </Button>
          ) : (
            <Button onClick={() => handleSave(true)} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Send className="size-4 mr-2" />}Send now
            </Button>
          )}
        </div>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{subject || "(No subject)"}</DialogTitle></DialogHeader>
          <Tabs defaultValue="desktop">
            <TabsList><TabsTrigger value="desktop">Desktop</TabsTrigger><TabsTrigger value="mobile">Mobile</TabsTrigger></TabsList>
            <TabsContent value="desktop">
              <div className="border rounded-lg p-6 bg-white text-black">
                <div dangerouslySetInnerHTML={{ __html: body }} />
              </div>
            </TabsContent>
            <TabsContent value="mobile">
              <div className="mx-auto border rounded-lg p-4 bg-white text-black" style={{ maxWidth: 380 }}>
                <div dangerouslySetInnerHTML={{ __html: body }} />
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
