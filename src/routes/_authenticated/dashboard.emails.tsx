import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/emails")({
  component: EmailsList,
});

type Biz = { id: string; name: string };
type Campaign = { id: string; business_id: string; name: string; type: string | null; status: string | null; updated_at: string };

function EmailsList() {
  const [businesses, setBusinesses] = useState<Biz[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    (async () => {
      const { data: bz } = await supabase.from("businesses").select("id, name").order("created_at", { ascending: false });
      setBusinesses(bz ?? []);
      const { data: cs, error } = await supabase.from("email_campaigns")
        .select("id, business_id, name, type, status, updated_at").order("updated_at", { ascending: false });
      if (error) toast.error(error.message);
      setCampaigns((cs ?? []) as any);
    })();
  }, []);

  if (businesses === null) {
    return <div className="p-6 max-w-7xl mx-auto"><Skeleton className="h-10 w-60 mb-4" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2].map(i=><Skeleton key={i} className="h-36 w-full rounded-2xl" />)}</div></div>;
  }

  const bizName = (id: string) => businesses.find((b) => b.id === id)?.name ?? "Business";

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 flex items-center gap-2">
        <Info className="h-4 w-4" /> Demo mode — emails are sent via Resend sandbox. Add a real API key in Integrations to deliver to actual inboxes.
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Email Campaigns</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-written sequences, automations, and analytics. 3 credits per sequence.</p>
      </div>

      {businesses.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center mb-3">
            <Mail className="h-5 w-5 text-primary-foreground" />
          </div>
          <h3 className="font-medium">Create a business first</h3>
          <Link to="/dashboard/new" search={{ idea: "" }} className="inline-flex items-center gap-2 mt-4 rounded-lg bg-brand-gradient text-primary-foreground px-3 py-2 text-sm font-medium shadow-glow">
            <Plus className="h-4 w-4" /> New business
          </Link>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Businesses</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {businesses.map((b) => (
                <Link key={b.id} to="/dashboard/emails/$businessId" params={{ businessId: b.id }}
                  className="rounded-2xl border bg-card p-4 hover:bg-secondary/40 transition-colors flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-muted-foreground">Open campaigns &amp; automations</div>
                  </div>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Recent campaigns</h2>
            {campaigns.length === 0 ? (
              <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">No campaigns yet. Open a business to generate one.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((c) => (
                  <Link key={c.id} to="/dashboard/emails/$businessId" params={{ businessId: c.business_id }}
                    search={{ campaignId: c.id } as any}
                    className="rounded-2xl border bg-card p-4 hover:bg-secondary/40 transition-colors space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="font-medium leading-tight line-clamp-2">{c.name}</div>
                      <Badge variant="outline" className="capitalize">{c.status ?? "draft"}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {c.type && <Badge variant="secondary" className="capitalize">{c.type.replace(/_/g, " ")}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{bizName(c.business_id)}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
