import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  generateImage, listImages, regenerateImage, deleteImage, useImageAsStorefrontHero,
} from "@/lib/ai/imageGen.functions";
import {
  FORMAT_DIMENSIONS, TYPE_LABELS, STYLE_LABELS,
  type ImageFormat, type ImageType, type ImageStyle,
} from "@/lib/ai/imagePrompt";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Sparkles, Loader2, Download, Trash2, RefreshCw, ChevronDown, ChevronUp,
  ShoppingBag, Mail, Megaphone, ImageIcon, Wand2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/images/$businessId")({
  component: ImagesGenerator,
});

type Img = {
  id: string;
  file_url: string | null;
  prompt: string | null;
  status: string | null;
  metadata_json: any;
  created_at: string;
};

const TYPES: ImageType[] = ["product", "lifestyle", "social_post", "ad_creative", "reel_cover", "email_banner", "storefront_hero"];
const STYLES: ImageStyle[] = ["premium_studio", "lifestyle", "minimal", "luxury", "local_market", "creator_led", "bold_ad", "clean_ecommerce"];
const FORMATS: ImageFormat[] = ["1_1", "9_16", "16_9", "ad", "email_banner"];

function ImagesGenerator() {
  const { businessId } = Route.useParams();
  const navigate = useNavigate();
  const generateFn = useServerFn(generateImage);
  const listFn = useServerFn(listImages);
  const regenFn = useServerFn(regenerateImage);
  const delFn = useServerFn(deleteImage);
  const heroFn = useServerFn(useImageAsStorefrontHero);

  const [bizName, setBizName] = useState("");
  const [type, setType] = useState<ImageType>("product");
  const [style, setStyle] = useState<ImageStyle>("premium_studio");
  const [format, setFormat] = useState<ImageFormat>("1_1");
  const [brief, setBrief] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [items, setItems] = useState<Img[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [brandPreview, setBrandPreview] = useState<{ tone?: string; visual_style?: string; product?: string } | null>(null);

  useEffect(() => {
    supabase.from("businesses").select("name").eq("id", businessId).maybeSingle().then(({ data }) => setBizName(data?.name ?? ""));
    Promise.all([
      supabase.from("brand_profiles").select("tone, visual_style").eq("business_id", businessId).maybeSingle(),
      supabase.from("offers").select("name, description").eq("business_id", businessId).maybeSingle(),
    ]).then(([brand, offer]) => {
      setBrandPreview({
        tone: brand.data?.tone ?? undefined,
        visual_style: brand.data?.visual_style ?? undefined,
        product: offer.data?.name ?? undefined,
      });
    });
    refresh();
  }, [businessId]);

  const refresh = async () => {
    setItems(null);
    setCursor(null);
    try {
      const res: any = await listFn({ data: { business_id: businessId } });
      setItems(res.items);
      setCursor(res.next_cursor);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load gallery");
      setItems([]);
    }
  };

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res: any = await listFn({ data: { business_id: businessId, cursor } });
      setItems((prev) => [...(prev ?? []), ...res.items]);
      setCursor(res.next_cursor);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateFn({
        data: {
          business_id: businessId,
          type, style, format,
          brief,
          reference_url: referenceUrl ? referenceUrl : null,
        },
      });
      toast.success("Image generated");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleRegen = async (img: Img, promptOverride?: string) => {
    setItems((prev) => (prev ?? []).map((x) => x.id === img.id ? { ...x, status: "generating" } : x));
    try {
      await regenFn({ data: { image_id: img.id, prompt_override: promptOverride } });
      toast.success("Regenerated");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
      await refresh();
    }
  };

  const handleDelete = async (img: Img) => {
    if (!(await confirmDialog({ title: "Delete this image?", destructive: true, confirmText: "Delete" }))) return;
    try {
      await delFn({ data: { image_id: img.id } });
      setItems((prev) => (prev ?? []).filter((x) => x.id !== img.id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleUseAsHero = async (img: Img) => {
    try {
      await heroFn({ data: { image_id: img.id, business_id: businessId } });
      toast.success("Set as storefront hero");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleDraftEmail = (img: Img) => {
    toast.success("Image queued for next email draft", { description: "Email composer (Stage 6) will pick this up." });
  };
  const handleDraftPost = (img: Img) => {
    toast.success("Image queued for next Meta post", { description: "Meta composer (Stage 7) will pick this up." });
  };

  const handleDownload = (img: Img) => {
    if (!img.file_url) return;
    window.open(img.file_url, "_blank");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={() => navigate({ to: "/dashboard" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </button>
        <Link to="/dashboard/storefront/$businessId" params={{ businessId }} className="text-sm text-muted-foreground hover:text-foreground">Open storefront →</Link>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{bizName}</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">AI Images</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate brand-aware visuals. 1 credit per image.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
        {/* Form */}
        <div className="rounded-2xl border bg-card p-5 space-y-5 h-fit lg:sticky lg:top-4">
          <div>
            <Label>Image type</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setType(t)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${type === t ? "bg-foreground text-background" : "hover:bg-secondary"}`}>{TYPE_LABELS[t]}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>Format</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)} className={`rounded-xl border px-3 py-2 text-xs text-left transition-colors ${format === f ? "border-foreground bg-secondary" : "hover:bg-secondary/60"}`}>{FORMAT_DIMENSIONS[f].label}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>Style</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button key={s} type="button" onClick={() => setStyle(s)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${style === s ? "bg-foreground text-background" : "hover:bg-secondary"}`}>{STYLE_LABELS[s]}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>Extra direction (optional)</Label>
            <Textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. on a marble surface, golden hour" />
          </div>
          <div>
            <Label>Reference image URL (optional)</Label>
            <Input value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)} placeholder="https://..." />
          </div>

          {brandPreview && (
            <div className="rounded-xl border bg-background/50 p-3 text-xs space-y-1">
              <div className="font-medium text-foreground">Brand context</div>
              <div className="text-muted-foreground">Product: {brandPreview.product || "—"}</div>
              <div className="text-muted-foreground">Tone: {brandPreview.tone || "—"}</div>
              <div className="text-muted-foreground">Visual style: {brandPreview.visual_style || "—"}</div>
              <div className="text-muted-foreground/80 italic">No fake claims, certifications or before/after.</div>
            </div>
          )}

          <Button onClick={handleGenerate} disabled={generating} className="w-full bg-brand-gradient text-primary-foreground shadow-glow">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate (1 credit)
          </Button>
        </div>

        {/* Gallery */}
        <div className="space-y-4">
          {items === null ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-square w-full rounded-2xl" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border bg-card p-10 text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center mb-3">
                <ImageIcon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-medium">No images yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Pick a type, style and format on the left, then generate.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((img) => <ImageCard key={img.id} img={img} onRegen={handleRegen} onDelete={handleDelete} onHero={handleUseAsHero} onEmail={handleDraftEmail} onPost={handleDraftPost} onDownload={handleDownload} />)}
              </div>
              {cursor && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageCard({
  img, onRegen, onDelete, onHero, onEmail, onPost, onDownload,
}: {
  img: Img;
  onRegen: (img: Img, promptOverride?: string) => void;
  onDelete: (img: Img) => void;
  onHero: (img: Img) => void;
  onEmail: (img: Img) => void;
  onPost: (img: Img) => void;
  onDownload: (img: Img) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(img.prompt ?? "");
  const status = img.status ?? "ready";

  return (
    <div className="rounded-2xl border bg-card overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-secondary">
        {img.file_url && status === "ready" ? (
          <img src={img.file_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
            {status === "generating" ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Generating…</> : status === "failed" ? "Failed" : "Queued"}
          </div>
        )}
        <Badge className="absolute top-2 left-2 capitalize" variant={status === "ready" ? "default" : status === "failed" ? "destructive" : "secondary"}>{status}</Badge>
      </div>
      <div className="p-3 space-y-2 text-xs">
        <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Prompt
        </button>
        {open && (
          <div className="space-y-2">
            {editing ? (
              <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} className="text-xs" />
            ) : (
              <p className="text-muted-foreground whitespace-pre-wrap line-clamp-6">{img.prompt}</p>
            )}
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(false); onRegen(img, draft); }}>Save & regenerate</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(img.prompt ?? ""); }}>Cancel</Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Wand2 className="h-3 w-3" /> Edit prompt</Button>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button size="sm" variant="outline" onClick={() => onRegen(img)} disabled={status === "generating"}>
            <RefreshCw className="h-3 w-3" /> Regenerate
          </Button>
          <Button size="sm" variant="outline" onClick={() => onHero(img)} disabled={status !== "ready"}><ShoppingBag className="h-3 w-3" /> Use as hero</Button>
          <Button size="sm" variant="ghost" onClick={() => onEmail(img)} disabled={status !== "ready"}><Mail className="h-3 w-3" /> Email</Button>
          <Button size="sm" variant="ghost" onClick={() => onPost(img)} disabled={status !== "ready"}><Megaphone className="h-3 w-3" /> Post</Button>
          <Button size="sm" variant="ghost" onClick={() => onDownload(img)} disabled={status !== "ready"}><Download className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(img)}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
    </div>
  );
}
