import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Link2, Unlink, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { listMetaConnections, startMetaOAuth, handleMetaOAuthCallback, disconnectMeta, runMockMetaSync } from "@/lib/meta/connections.functions";

export const Route = createFileRoute("/_authenticated/dashboard/integrations/meta")({
  component: IntegrationsMetaPage,
});

const KINDS = [
  { kind: "facebook_page", label: "Facebook Page", description: "Publish posts and read engagement." },
  { kind: "instagram", label: "Instagram Business", description: "Publish reels, posts and stories." },
  { kind: "ad_account", label: "Meta Ad Account", description: "Run and manage paid campaigns." },
  { kind: "pixel", label: "Meta Pixel", description: "Track website conversions." },
  { kind: "capi", label: "Conversions API", description: "Server-side event tracking." },
] as const;

function statusBadge(c: any) {
  const status = c?.token_status as string | undefined;
  if (!c) return <Badge variant="outline">Not connected</Badge>;
  if (c.error_message) return <Badge variant="destructive">Sync failed</Badge>;
  if (status === "demo") return <Badge className="bg-amber-500/10 text-amber-700 border border-amber-500/30">Demo connected</Badge>;
  if (status === "connected") return <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">Connected</Badge>;
  if (status === "needs_reconnect") return <Badge variant="destructive">Needs reconnect</Badge>;
  if (status === "permission_missing") return <Badge variant="destructive">Permission missing</Badge>;
  if (status === "token_expired") return <Badge variant="destructive">Token expired</Badge>;
  if (status === "syncing") return <Badge variant="secondary">Syncing…</Badge>;
  return <Badge variant="outline">{status ?? "Unknown"}</Badge>;
}

function IntegrationsMetaPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("businesses").select("id, name").order("created_at", { ascending: false });
      setBusinesses(data ?? []);
      const url = new URL(window.location.href);
      const bid = url.searchParams.get("business_id");
      setBusinessId(bid ?? data?.[0]?.id ?? null);
    })();
  }, []);

  const list = useServerFn(listMetaConnections);
  const start = useServerFn(startMetaOAuth);
  const cb = useServerFn(handleMetaOAuthCallback);
  const dx = useServerFn(disconnectMeta);
  const sync = useServerFn(runMockMetaSync);
  const qc = useQueryClient();

  const conns = useQuery({
    queryKey: ["meta_conns", businessId],
    queryFn: () => list({ data: { business_id: businessId! } }),
    enabled: !!businessId,
  });

  // Demo callback handler — if returned with ?demo_callback=1, finalize.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("demo_callback") === "1" && businessId) {
      const kind = url.searchParams.get("kind") as any;
      cb({ data: { business_id: businessId, kind } })
        .then(() => {
          toast.success("Connected (demo)");
          qc.invalidateQueries({ queryKey: ["meta_conns", businessId] });
          url.searchParams.delete("demo_callback");
          url.searchParams.delete("kind");
          url.searchParams.delete("state");
          url.searchParams.delete("business_id");
          window.history.replaceState({}, "", url.toString());
        })
        .catch((e) => toast.error(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const connect = useMutation({
    mutationFn: async (kind: string) => start({ data: { business_id: businessId!, kind: kind as any } }),
    onSuccess: (r) => { window.location.href = r.redirect_url; },
    onError: (e: any) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: async (id: string) => dx({ data: { connection_id: id } }),
    onSuccess: () => { toast.success("Disconnected"); qc.invalidateQueries({ queryKey: ["meta_conns", businessId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const mockSync = useMutation({
    mutationFn: async () => sync({ data: { business_id: businessId! } }),
    onSuccess: () => { toast.success("Mock sync complete"); qc.invalidateQueries({ queryKey: ["meta_conns", businessId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const byKind = useMemo(() => {
    const map = new Map<string, any>();
    (conns.data?.connections ?? []).forEach((c: any) => map.set(c.kind, c));
    return map;
  }, [conns.data]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" /> Demo mode — no real Meta posts or ad spend will occur.
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Meta Integration</h1>
          <p className="text-sm text-muted-foreground">Connect Facebook, Instagram and ad accounts.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={businessId ?? ""} onChange={(e) => setBusinessId(e.target.value)}>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => mockSync.mutate()} disabled={!businessId || mockSync.isPending}>
            {mockSync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Run mock sync</span>
          </Button>
        </div>
      </div>

      {conns.isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {KINDS.map((k) => {
            const c = byKind.get(k.kind);
            return (
              <Card key={k.kind} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> {k.label}</div>
                    <p className="text-xs text-muted-foreground mt-1">{k.description}</p>
                  </div>
                  {statusBadge(c)}
                </div>
                {c?.metadata_json ? (
                  <pre className="text-[10px] bg-muted/50 rounded px-2 py-1 max-h-20 overflow-auto">{JSON.stringify(c.metadata_json, null, 2)}</pre>
                ) : null}
                {c?.last_synced_at ? (
                  <div className="text-xs text-muted-foreground">Last synced {new Date(c.last_synced_at).toLocaleString()}</div>
                ) : null}
                <div className="flex gap-2 mt-auto">
                  {!c ? (
                    <Button size="sm" onClick={() => connect.mutate(k.kind)} disabled={!businessId || connect.isPending}>
                      {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                      <span className="ml-2">Connect</span>
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => connect.mutate(k.kind)}>
                        <RefreshCw className="h-4 w-4 mr-2" /> Reconnect
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => disconnect.mutate(c.id)}>
                        <Unlink className="h-4 w-4 mr-2" /> Disconnect
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-4 text-sm text-muted-foreground">
        Tokens are encrypted at rest with pgcrypto and never sent to the browser.
        Switch <code className="px-1 bg-muted rounded">META_MODE=live</code> with valid <code className="px-1 bg-muted rounded">META_APP_ID</code> / <code className="px-1 bg-muted rounded">META_REDIRECT_URI</code> to use real Facebook OAuth.
        <div className="mt-2"><Link to="/dashboard/posts" className="underline">Go to Meta Posts →</Link></div>
      </Card>
    </div>
  );
}
