import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkIntegrations, type IntegrationStatus } from "@/lib/integrations/status.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, XCircle, AlertCircle, ExternalLink, RefreshCw,
  Database, Sparkles, Mail, CreditCard, Share2, Image, Video, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/integrations/status")({
  component: IntegrationsStatusPage,
});

const categoryIcons: Record<string, typeof Database> = {
  Core: Database,
  AI: Sparkles,
  Communication: Mail,
  Payments: CreditCard,
  Social: Share2,
};

const categoryColors: Record<string, string> = {
  Core: "bg-blue-500/10 text-blue-600",
  AI: "bg-purple-500/10 text-purple-600",
  Communication: "bg-emerald-500/10 text-emerald-600",
  Payments: "bg-amber-500/10 text-amber-600",
  Social: "bg-royal/10 text-royal",
};

function StatusIcon({ status }: { status: IntegrationStatus["status"] }) {
  if (status === "connected") return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "error") return <XCircle className="h-5 w-5 text-destructive" />;
  return <AlertCircle className="h-5 w-5 text-amber-500" />;
}

function StatusBadge({ status }: { status: IntegrationStatus["status"] }) {
  if (status === "connected") return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">Connected</Badge>;
  if (status === "error") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="outline" className="text-amber-600 border-amber-300">Not configured</Badge>;
}

function IntegrationsStatusPage() {
  const [data, setData] = useState<{ integrations: IntegrationStatus[]; summary: { connected: number; notConfigured: number; errors: number; total: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const checkFn = useServerFn(checkIntegrations);

  const load = async () => {
    setLoading(true);
    try {
      const result = await checkFn({ data: undefined });
      setData(result);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const connectedPct = data ? Math.round((data.summary.connected / data.summary.total) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <div>
        <Link to="/dashboard/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to settings
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your APIs to unlock real payments, email delivery, social publishing, and AI generation.
        </p>
      </div>

      {loading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Summary card */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Setup progress</div>
                <div className="text-2xl font-bold mt-1">
                  {data.summary.connected} of {data.summary.total} connected
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.summary.notConfigured} not configured · {data.summary.errors} errors
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Progress value={connectedPct} className="h-3" />
                <div className="text-right text-xs text-muted-foreground mt-1">{connectedPct}%</div>
              </div>
              <Button variant="outline" size="sm" onClick={load} className="shrink-0">
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>
          </Card>

          {/* Integration cards */}
          <div className="space-y-4">
            {data.integrations.map((integration) => {
              const Icon = categoryIcons[integration.category] || Database;
              const catColor = categoryColors[integration.category] || "bg-secondary text-muted-foreground";

              return (
                <Card key={integration.id} className="p-5">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${catColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{integration.name}</h3>
                        <StatusBadge status={integration.status} />
                        <Badge variant="outline" className="text-[10px] uppercase">{integration.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{integration.message}</p>

                      {integration.status !== "connected" && (
                        <div className="mt-3 rounded-lg bg-secondary/40 p-3 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">How to connect</div>
                          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                            <li>
                              Sign up at{" "}
                              <a href={integration.setupUrl} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline inline-flex items-center gap-0.5">
                                {new URL(integration.setupUrl).hostname} <ExternalLink className="h-3 w-3" />
                              </a>
                            </li>
                            <li>Get your API key from the dashboard</li>
                            <li>Add these environment variables:</li>
                          </ol>
                          <code className="block rounded bg-background border px-3 py-2 text-xs font-mono text-foreground">
                            {integration.envVar}
                          </code>
                          <div className="flex gap-2 mt-2">
                            <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                              <a href={integration.setupUrl} target="_blank" rel="noopener noreferrer">
                                Sign up <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                              <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer">
                                Docs <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <StatusIcon status={integration.status} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="rounded-xl border border-dashed p-5 text-center">
            <p className="text-sm text-muted-foreground">
              All integrations work in <strong>demo mode</strong> until you add real API keys.
              No functionality is blocked — you can build and preview everything.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Copy <code className="text-foreground">.env.example</code> to <code className="text-foreground">.env</code> and fill in your keys.
              Restart the dev server after adding keys.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
