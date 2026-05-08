import { createFileRoute, Link } from "@tanstack/react-router";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listContent, deleteContent } from "@/lib/content/studio.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Image as ImageIcon, Video, FileText, Plus, Sparkles, Trash2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/content/")({
  component: ContentStudioPage,
});

type Filter = "all" | "image" | "video" | "ugc";

type ContentItem = {
  id: string;
  content_type: "image" | "video" | "ugc";
  goal: string | null;
  prompt: string | null;
  result_url: string | null;
  script_text: string | null;
  metadata: any;
  status: string;
  created_at: string;
};

function ContentStudioPage() {
  const list = useServerFn(listContent);
  const del = useServerFn(deleteContent);
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (f: Filter) => {
    setLoading(true);
    setError(null);
    try {
      const r = await list({ data: { filter: f, limit: 60 } });
      setItems(r.items as ContentItem[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filter); }, [filter]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this creation?")) return;
    try {
      await del({ data: { id } });
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">AI Content Studio</h1>
          <p className="text-muted-foreground mt-1">Create images, videos, and UGC scripts in seconds.</p>
        </div>
        <Link to="/dashboard/content/image">
          <Button><Plus className="size-4 mr-2" />Create new</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CreateCard
          to="/dashboard/content/image"
          icon={<ImageIcon className="size-6" />}
          title="Generate Image"
          desc="Hi-converting product, ad, lifestyle visuals."
          gradient="from-fuchsia-500/15 to-purple-500/5"
        />
        <CreateCard
          to="/dashboard/content/video"
          icon={<Video className="size-6" />}
          title="Generate Video"
          desc="Short videos with AI presenter or text-on-screen."
          gradient="from-sky-500/15 to-blue-500/5"
        />
        <CreateCard
          to="/dashboard/content/ugc"
          icon={<FileText className="size-6" />}
          title="Write UGC Script"
          desc="Hooks, stories, CTAs ready to film."
          gradient="from-emerald-500/15 to-teal-500/5"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Recent creations</h2>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="image">Images</TabsTrigger>
              <TabsTrigger value="video">Videos</TabsTrigger>
              <TabsTrigger value="ugc">Scripts</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" onClick={() => load(filter)}>Retry</Button>
          </Card>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center">
            <Sparkles className="size-10 mx-auto mb-3 text-primary" />
            <h3 className="text-lg font-semibold">No content created yet.</h3>
            <p className="text-muted-foreground mt-1 mb-4">Generate your first image in 30 seconds.</p>
            <Link to="/dashboard/content/image"><Button>Get started</Button></Link>
          </Card>
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
            {items.map((item) => (
              <CreationCard key={item.id} item={item} onDelete={() => onDelete(item.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateCard({ to, icon, title, desc, gradient }: { to: string; icon: React.ReactNode; title: string; desc: string; gradient: string }) {
  return (
    <Link to={to}>
      <Card className={`p-6 h-full hover:shadow-lg transition-all bg-gradient-to-br ${gradient} border-2 hover:border-primary/40`}>
        <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">{icon}</div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </Card>
    </Link>
  );
}

function CreationCard({ item, onDelete }: { item: ContentItem; onDelete: () => void }) {
  const isImage = item.content_type === "image";
  const isVideo = item.content_type === "video";
  return (
    <div className="mb-3 break-inside-avoid">
      <Card className="overflow-hidden group">
        {isImage && item.result_url ? (
          <img src={item.result_url} alt={item.prompt ?? ""} className="w-full h-auto" loading="lazy" />
        ) : isVideo && item.result_url ? (
          <video src={item.result_url} controls className="w-full h-auto" />
        ) : (
          <div className="p-4 bg-muted/30">
            <div className="text-xs uppercase text-muted-foreground mb-2">{item.goal ?? "Script"}</div>
            <pre className="text-sm whitespace-pre-wrap line-clamp-[12] font-sans">{item.script_text ?? item.prompt}</pre>
          </div>
        )}
        <div className="p-3 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground capitalize">{item.content_type} · {new Date(item.created_at).toLocaleDateString()}</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            {item.result_url && (
              <a href={item.result_url} target="_blank" rel="noreferrer" download>
                <Button variant="ghost" size="icon" className="size-8"><Download className="size-3.5" /></Button>
              </a>
            )}
            <Button variant="ghost" size="icon" className="size-8" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
