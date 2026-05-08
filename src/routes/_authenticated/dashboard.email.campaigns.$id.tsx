import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCampaign, getCampaignStats } from "@/lib/email/marketing.functions";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/email/campaigns/$id")({
  component: CampaignDetailPage,
});

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const get = useServerFn(getCampaign);
  const stats = useServerFn(getCampaignStats);
  const [campaign, setCampaign] = useState<any | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, s] = await Promise.all([get({ data: { id } }), stats({ data: { id } })]);
        setCampaign(c.campaign);
        setCounts(s.counts);
      } finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>;
  if (!campaign) return <p className="text-muted-foreground">Campaign not found.</p>;

  const total = campaign.recipients_count || 1;
  const rate = (n: number) => `${Math.round((n / total) * 100)}%`;
  const c = counts ?? {};

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
        <Badge variant={campaign.status === "sent" ? "default" : "outline"}>{campaign.status}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Recipients" value={String(campaign.recipients_count)} />
        <StatCard label="Open rate" value={rate(c.opened ?? 0)} />
        <StatCard label="Click rate" value={rate(c.clicked ?? 0)} />
        <StatCard label="Bounce rate" value={rate(c.bounced ?? 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="Unsubscribes" value={String(c.unsubscribed ?? 0)} />
        <StatCard label="Failed" value={String(c.failed ?? 0)} />
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-3">Email preview</h3>
        <div className="border rounded-lg p-6 bg-white text-black">
          <div dangerouslySetInnerHTML={{ __html: campaign.body_html ?? "" }} />
        </div>
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
