import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { confirmDialog } from "@/components/ui/confirm";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Sparkles, CheckCircle2, Send, Calendar, Trash2 } from "lucide-react";
import {
  generateMetaPost, listMetaPosts, updateMetaPost, approveMetaPost,
  publishMetaPost, scheduleMetaPost, deleteMetaPost, POST_TYPES, PLATFORMS,
} from "@/lib/meta/posts.functions";
import { listMetaConnections } from "@/lib/meta/connections.functions";

export const Route = createFileRoute("/_authenticated/dashboard/posts/$businessId")({
  component: PostsBusinessPage,
});

function statusBadge(s: string, a: string) {
  if (a !== "approved") return <Badge variant="outline">Needs approval</Badge>;
  if (s === "draft") return <Badge variant="secondary">Approved · Draft</Badge>;
  if (s === "scheduled") return <Badge className="bg-blue-500/10 text-blue-700 border border-blue-500/30">Scheduled</Badge>;
  if (s === "published") return <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">Published</Badge>;
  if (s === "failed") return <Badge variant="destructive">Failed</Badge>;
  return <Badge>{s}</Badge>;
}

function PostsBusinessPage() {
  const { businessId } = Route.useParams();
  const list = useServerFn(listMetaPosts);
  const gen = useServerFn(generateMetaPost);
  const upd = useServerFn(updateMetaPost);
  const apr = useServerFn(approveMetaPost);
  const pub = useServerFn(publishMetaPost);
  const sch = useServerFn(scheduleMetaPost);
  const del = useServerFn(deleteMetaPost);
  const listConns = useServerFn(listMetaConnections);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<{ platform?: string; status?: string }>({});
  const [postType, setPostType] = useState<string>("feed");
  const [platform, setPlatform] = useState<string>("instagram");
  const [brief, setBrief] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ caption: string; hashtags: string; cta_text: string }>({ caption: "", hashtags: "", cta_text: "" });
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);

  const posts = useQuery({
    queryKey: ["meta_posts", businessId],
    queryFn: () => list({ data: { business_id: businessId } }),
  });

  const connections = useQuery({
    queryKey: ["meta_conns", businessId],
    queryFn: () => listConns({ data: { business_id: businessId } }),
  });

  const fbConn = useMemo(() => {
    return (connections.data?.connections ?? []).find((c: any) => c.kind === "facebook_page");
  }, [connections.data]);

  const igConn = useMemo(() => {
    return (connections.data?.connections ?? []).find((c: any) => c.kind === "instagram");
  }, [connections.data]);

  const hasRealConnection = useMemo(() => {
    return (connections.data?.connections ?? []).some((c: any) =>
      c.token_status === "connected" && (c.page_id || c.instagram_account_id)
    );
  }, [connections.data]);

  const isDemoMode = useMemo(() => {
    return (connections.data?.connections ?? []).every((c: any) => c.token_status === "demo");
  }, [connections.data]);

  const generate = useMutation({
    mutationFn: () => gen({ data: { business_id: businessId, post_type: postType as any, platform: platform as any, brief } }),
    onSuccess: () => { toast.success("Post generated"); setBrief(""); qc.invalidateQueries({ queryKey: ["meta_posts", businessId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: (vars: { post_id: string; patch: any }) => upd({ data: vars }),
    onSuccess: () => { toast.success("Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["meta_posts", businessId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: (post_id: string) => apr({ data: { post_id } }),
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: ["meta_posts", businessId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: (post_id: string) => pub({ data: { post_id } }),
    onSuccess: (r) => {
      if (r.mode === "live") {
        toast.success("Published to Meta", { description: `Post ID: ${r.external_post_id}` });
      } else {
        toast.success("Published (demo mode)");
      }
      qc.invalidateQueries({ queryKey: ["meta_posts", businessId] });
    },
    onError: (e: any) => {
      const msg = e?.message || "";
      if (msg.includes("reconnect") || msg.includes("Token expired") || msg.includes("Permission denied")) {
        toast.error("Publishing failed", {
          description: (
            <div className="space-y-2">
              <p>{msg}</p>
              <Link to="/dashboard/integrations/meta" className="text-primary underline text-sm">Go to Integrations →</Link>
            </div>
          ),
          duration: 8000,
        });
      } else {
        toast.error(msg);
      }
    },
  });

  const schedule = useMutation({
    mutationFn: (vars: { post_id: string; scheduled_at: string }) => sch({ data: vars }),
    onSuccess: () => { toast.success("Scheduled"); setScheduleFor(null); qc.invalidateQueries({ queryKey: ["meta_posts", businessId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (post_id: string) => del({ data: { post_id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["meta_posts", businessId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return (posts.data?.posts ?? []).filter((p: any) =>
      (!filter.platform || p.platform === filter.platform) &&
      (!filter.status || p.status === filter.status));
  }, [posts.data, filter]);

  const getConnectionForPost = (p: any) => {
    if (p.platform === "facebook") return fbConn;
    if (p.platform === "instagram") return igConn;
    return undefined;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Status banner */}
      {hasRealConnection ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Meta connected — posts will publish to your real accounts.
        </div>
      ) : isDemoMode ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Demo mode — publishing creates a mock external_post_id.
          <Link to="/dashboard/integrations/meta" className="ml-auto underline text-amber-900">Connect Meta →</Link>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> No Meta connection — publishing will be simulated.
          <Link to="/dashboard/integrations/meta" className="ml-auto underline text-amber-900">Connect Meta →</Link>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Meta Posts</h1>
          <p className="text-sm text-muted-foreground">Approval required before publishing.</p>
        </div>
        <Link to="/dashboard/posts" className="text-sm underline">All businesses</Link>
      </div>

      <Card className="p-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={postType} onValueChange={setPostType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{POST_TYPES.map(p => <SelectItem key={p} value={p}>{p.replace(/_/g," ")}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="ml-2">Generate (1 credit)</span>
        </Button>
        <Textarea className="md:col-span-3" rows={2} placeholder="Optional brief…" value={brief} onChange={(e) => setBrief(e.target.value)} />
      </Card>

      <div className="flex items-center gap-2">
        <Select value={filter.platform ?? "all"} onValueChange={(v) => setFilter((f) => ({ ...f, platform: v === "all" ? undefined : v }))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Platform" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filter.status ?? "all"} onValueChange={(v) => setFilter((f) => ({ ...f, status: v === "all" ? undefined : v }))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {posts.isLoading ? (
        <div className="grid gap-3">{[0,1,2].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No posts yet. Generate your first above.</Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p: any) => {
            const isEdit = editing === p.id;
            const postConn = getConnectionForPost(p);
            const canPublishLive = postConn?.token_status === "connected" && (postConn?.page_id || postConn?.instagram_account_id);
            return (
              <Card key={p.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="capitalize">{p.platform}</Badge>
                    <Badge variant="outline" className="capitalize">{(p.post_type ?? "—").replace(/_/g, " ")}</Badge>
                    {statusBadge(p.status, p.approval_status)}
                    {p.external_post_id && p.status === "published" && (
                      <Badge variant="outline" className="text-[10px]">{p.external_post_id.startsWith("demo_") ? "demo" : "live"}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
                </div>

                {p.error_message && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{p.error_message}</span>
                  </div>
                )}

                {isEdit ? (
                  <div className="space-y-2">
                    <Textarea rows={4} value={draft.caption} onChange={(e) => setDraft(d => ({ ...d, caption: e.target.value }))} />
                    <Input value={draft.hashtags} onChange={(e) => setDraft(d => ({ ...d, hashtags: e.target.value }))} placeholder="Hashtags" />
                    <Input value={draft.cta_text} onChange={(e) => setDraft(d => ({ ...d, cta_text: e.target.value }))} placeholder="CTA" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => save.mutate({ post_id: p.id, patch: draft })} disabled={save.isPending}>
                        {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{p.caption}</p>
                    {p.hashtags && <p className="text-xs text-muted-foreground">{p.hashtags}</p>}
                    {p.cta_text && <p className="text-xs"><span className="text-muted-foreground">CTA:</span> {p.cta_text}</p>}
                  </>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {!isEdit && (
                    <Button size="sm" variant="outline" onClick={() => { setEditing(p.id); setDraft({ caption: p.caption ?? "", hashtags: p.hashtags ?? "", cta_text: p.cta_text ?? "" }); }}>
                      Edit
                    </Button>
                  )}
                  {p.approval_status !== "approved" && (
                    <Button size="sm" variant="outline" onClick={() => approve.mutate(p.id)} disabled={approve.isPending}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  )}
                  {p.approval_status === "approved" && p.status !== "published" && (
                    <>
                      <Button
                        size="sm"
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: `Publish to ${p.platform}?`,
                            description: canPublishLive
                              ? `This will publish the post immediately to your connected ${p.platform} account. You can't unpublish from here once it's live.`
                              : `No live connection for ${p.platform}. This will create a demo post only. Connect Meta in Integrations to publish for real.`,
                            confirmText: canPublishLive ? "Publish now" : "Publish (demo)",
                          });
                          if (ok) publish.mutate(p.id);
                        }}
                        disabled={publish.isPending}
                      >
                        {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        <span className="ml-1">Publish</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setScheduleFor(p.id)}>
                        <Calendar className="h-4 w-4 mr-1" /> Schedule
                      </Button>
                    </>
                  )}
                  {p.status === "failed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => publish.mutate(p.id)}
                      disabled={publish.isPending}
                    >
                      {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                      Retry
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => remove.mutate(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!scheduleFor} onOpenChange={(o) => !o && setScheduleFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule post</DialogTitle>
            <DialogDescription>Pick a date and time. Approval required.</DialogDescription>
          </DialogHeader>
          <Input type="datetime-local" id="sched" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduleFor(null)}>Cancel</Button>
            <Button onClick={() => {
              const v = (document.getElementById("sched") as HTMLInputElement).value;
              if (!v) return toast.error("Pick a time");
              schedule.mutate({ post_id: scheduleFor!, scheduled_at: new Date(v).toISOString() });
            }}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
