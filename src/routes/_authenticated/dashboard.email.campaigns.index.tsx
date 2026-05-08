import { createFileRoute, Link } from "@tanstack/react-router";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listCampaigns, deleteCampaign } from "@/lib/email/marketing.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/email/campaigns/")({
  component: CampaignsPage,
});

function CampaignsPage() {
  const list = useServerFn(listCampaigns);
  const del = useServerFn(deleteCampaign);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { const r = await list(); setItems(r.items); }
    catch (e: any) { setError(e?.message || "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onDelete = async (id: string) => {
    if (!(await confirmDialog({ title: "Delete this campaign?", destructive: true, confirmText: "Delete" }))) return;
    try { await del({ data: { id } }); setItems((p) => p.filter((x) => x.id !== id)); toast.success("Deleted"); }
    catch (e: any) { toast.error(e?.message || "Delete failed"); }
  };

  const rate = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Link to="/dashboard/email/campaigns/new">
          <Button><Plus className="size-4 mr-2" />New Campaign</Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : error ? (
        <Card className="p-8 text-center"><p className="text-muted-foreground mb-3">{error}</p><Button variant="outline" onClick={load}>Retry</Button></Card>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <Mail className="size-10 mx-auto mb-3 text-primary" />
          <h3 className="text-lg font-semibold">No campaigns sent.</h3>
          <p className="text-muted-foreground mt-1 mb-4">Write your first email.</p>
          <Link to="/dashboard/email/campaigns/new"><Button>Create campaign</Button></Link>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Open rate</TableHead>
                <TableHead>Click rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to="/dashboard/email/campaigns/$id" params={{ id: c.id }} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted-foreground line-clamp-1">{c.subject}</div>
                  </TableCell>
                  <TableCell>{c.recipients_count}</TableCell>
                  <TableCell className="text-sm">{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{rate(c.opens_count, c.recipients_count)}</TableCell>
                  <TableCell>{rate(c.clicks_count, c.recipients_count)}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "sent" ? "default" : c.status === "scheduled" ? "secondary" : "outline"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onDelete(c.id)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
