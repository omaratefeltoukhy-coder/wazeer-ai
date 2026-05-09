import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateContentVideo, generateVideoScript } from "@/lib/content/studio.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Sparkles, Download, RefreshCw, Target as TargetIcon, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/content/video")({
  component: VideoGeneratorPage,
});

const STYLES = [
  { id: "ai_presenter", label: "AI Presenter", desc: "Talking head avatar" },
  { id: "text_on_screen", label: "Text on Screen", desc: "Captions over b-roll" },
] as const;

const GOALS = [
  { id: "ad", label: "Ad" },
  { id: "social_post", label: "Social Post" },
  { id: "product_demo", label: "Product Demo" },
];

function VideoGeneratorPage() {
  const navigate = useNavigate();
  const generate = useServerFn(generateContentVideo);
  const writeScript = useServerFn(generateVideoScript);

  const [productId, setProductId] = useState("none");
  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([]);
  const [script, setScript] = useState("");
  const [style, setStyle] = useState<"ai_presenter" | "text_on_screen">("ai_presenter");
  const [goal, setGoal] = useState("ad");
  const [scripting, setScripting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("products").select("id, title").order("created_at", { ascending: false }).limit(50);
      setProducts(data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!loading) return;
    setProgress(5);
    const id = setInterval(() => setProgress((p) => Math.min(p + 3, 95)), 1500);
    return () => clearInterval(id);
  }, [loading]);

  const onWriteScript = async () => {
    setScripting(true);
    try {
      const r = await writeScript({ data: { goal: GOALS.find((g) => g.id === goal)?.label ?? goal, product_id: productId === "none" ? null : productId } });
      setScript(r.script);
    } catch (e: any) {
      toast.error(e?.message || "Could not write a script");
    } finally {
      setScripting(false);
    }
  };

  const onGenerate = async () => {
    if (!script.trim()) { toast.error("Add a script first."); return; }
    setLoading(true);
    setResultUrl(null);
    try {
      const r = await generate({ data: { script, style, goal: GOALS.find((g) => g.id === goal)?.label ?? goal, product_id: productId === "none" ? null : productId } });
      setProgress(100);
      setResultUrl(r.result_url);
      toast.success("Video ready!");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 flex items-center gap-2">
        <Info className="h-4 w-4" /> Demo mode — videos use sample clips. Connect a real video provider (Runway, Fal, Pika) in settings to generate production videos.
      </div>
      <Link to="/dashboard/content" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 mr-1" />Back to Studio
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Generate Video</h1>
        <p className="text-muted-foreground mt-1">From script to playable video in under a minute.</p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <Label className="text-base font-semibold">Product</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No product / General</SelectItem>
              {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">1. Script</Label>
            <Button variant="ghost" size="sm" onClick={onWriteScript} disabled={scripting}>
              {scripting ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Sparkles className="size-3.5 mr-1" />}
              AI write script
            </Button>
          </div>
          <Textarea value={script} onChange={(e) => setScript(e.target.value)} rows={6} placeholder="Hook the viewer in the first second…" />
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">2. Style</Label>
          <div className="grid grid-cols-2 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`p-3 rounded-lg border-2 text-left transition ${style === s.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
              >
                <div className="font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">3. Goal</Label>
          <div className="grid grid-cols-3 gap-2">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`p-3 rounded-lg border-2 text-sm transition ${goal === g.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={onGenerate} disabled={loading} size="lg" className="w-full">
          {loading ? <><Loader2 className="size-4 mr-2 animate-spin" />Generating your video...</> : <><Sparkles className="size-4 mr-2" />Generate Video</>}
        </Button>
      </Card>

      {loading && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Generating your video...</span>
            <span className="text-muted-foreground">~60 seconds</span>
          </div>
          <Progress value={progress} />
        </Card>
      )}

      {resultUrl && !loading && (
        <Card className="p-4 space-y-4">
          <video src={resultUrl} controls className="w-full rounded-lg" />
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={onGenerate}><RefreshCw className="size-4 mr-2" />Regenerate</Button>
            <a href={resultUrl} target="_blank" rel="noreferrer" download>
              <Button variant="outline"><Download className="size-4 mr-2" />Download</Button>
            </a>
            <Button onClick={() => navigate({ to: "/dashboard/ads" })}>
              <TargetIcon className="size-4 mr-2" />Use in Ads
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
