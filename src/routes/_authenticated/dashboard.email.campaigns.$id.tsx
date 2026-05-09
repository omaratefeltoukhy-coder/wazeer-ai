import { createFileRoute, Link } from "@tanstack/react-router";
import { confirmDialog } from "@/components/ui/confirm";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCampaign, getCampaignStats, sendCampaign } from "@/lib/email/marketing.functions";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/email/campaigns/$id")({
  component: CampaignDetailPage,
});

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const get = useServerFn(getCampaign);
  const stats = useServerFn(getCampaignStats);
  const send = useServerFn(sendCampaign);
  const [campaign, setCampaign] = useState<any | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([get({ data: { id } }), stats({ data: { id } })]);
      setCampaign(c.campaign);
      setCounts(s.counts);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleSend = async () => {
    if (!campaign) return;
    if (!(await confirmDialog({ title: "Send campaign?", description: `This will send to ${campaign.recipients_count || "all"} eligible contacts.`, confirmText: "Send" }))) return;
    setSending(true);
    try {
      const r: any = await send({ data: { id: campaign.id } });
      if (r.mock) {
        toast.warning(`Simulated send to ${r.total} recipient(s). Add RESEND_API_KEY to send for real.`);
      } else {
        toast.success(`Sent to ${r.sent} recipient(s)${r.failed ? ` (${r.failed} failed)` : ""}`);
      }
      load();
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>;
  if (!campaign) return <p className="text-muted-foreground">Campaign not found.</p>;

  const total = campaign.recipients_count || 1;
  const rate = (n: number) => `${Math.round((n / total) * 100)}%`;
  const c = counts ?? {};
  const canSend = campaign.status === "draft" || campaign.status === "scheduled";

  return (
    <div className="space-y-6">
      <Link to="/dashboard/email/campaigns" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 mr-1" />Back to campaigns
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{campaign.name}</h2>
          <p className="text-muted-foreground">{campaign.subject}</p>
        </div>
        <div className="flex items-center gap-2">
          {canSend && (
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Send className="size-4 mr-1" />}
              {sending ? "Sending…" : "Send now"}
            </Button>
          )}
          <Badge variant={campaign.status === "sent" ? "default" : "outline"}>{campaign.status}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Recipients" value={String(campaign.recipients_count)} />
        <StatCard label="Sent" value={String(c.sent ?? 0)} />
        <StatCard label="Open rate" value={rate(c.opened ?? 0)} />
        <StatCard label="Click rate" value={rate(c.clicked ?? 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="Bounce rate" value={rate(c.bounced ?? 0)} />
        <StatCard label="Failed" value={String(c.failed ?? 0)} />
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-3">Email preview</h3>
        {/* Sandboxed iframe — any <script> in stored body_html is contained. */}
        <iframe
          title="Email preview"
          srcDoc={campaign.body_html ?? ""}
          sandbox=""
          referrerPolicy="no-referrer"
          className="border rounded-lg w-full h-[600px] bg-white"
        />
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}
