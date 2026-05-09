import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateContentImage, suggestPrompt } from "@/lib/content/studio.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Sparkles, Download, RefreshCw, Target as TargetIcon, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/content/image")({
  component: ImageGeneratorPage,
});

const GOALS = [
  { id: "high_converting_ad", label: "High converting ad", emoji: "🎯" },
  { id: "social_media_post", label: "Social media post", emoji: "📱" },
  { id: "product_showcase", label: "Product showcase", emoji: "📦" },
  { id: "viral_content", label: "Viral content", emoji: "🔥" },
  { id: "custom", label: "Custom", emoji: "✨" },
];

const FORMATS = [
  { id: "1_1", label: "Square (1:1)" },
  { id: "9_16", label: "Story (9:16)" },
  { id: "16_9", label: "Landscape (16:9)" },
] as const;

function ImageGeneratorPage() {
  const navigate = useNavigate();
  const generate = useServerFn(generateContentImage);
  const suggest = useServerFn(suggestPrompt);

  const [goal, setGoal] = useState("high_converting_ad");
  const [productId, setProductId] = useState<string>("none");
  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([]);
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<"1_1" | "9_16" | "16_9">("1_1");
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("products").select("id, title").order("created_at", { ascending: false }).limit(50);
      setProducts(data ?? []);
    })();
  }, []);

  const onSuggest = async () => {
    setSuggesting(true);
    try {
      const r = await suggest({ data: { goal: GOALS.find((g) => g.id === goal)?.label ?? goal, product_id: productId === "none" ? null : productId } });
      setPrompt(r.prompt);
    } catch (e: any) {
      toast.error(e?.message || "Could not suggest a prompt");
    } finally {
      setSuggesting(false);
    }
  };

  const onGenerate = async () => {
    if (!prompt.trim()) { toast.error("Describe the image you want."); return; }
    setLoading(true);
    setResultUrl(null);
    try {
      const r = await generate({ data: {
        goal: GOALS.find((g) => g.id === goal)?.label ?? goal,
        product_id: productId === "none" ? null : productId,
        prompt,
        format,
      } });
      setResultUrl(r.result_url);
      toast.success("Image ready!");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 flex items-center gap-2">
        <Info className="h-4 w-4" /> Demo mode — images are generated using a placeholder provider. Connect a real image provider (OpenAI, Fal, Stability) in settings to get production-quality results.
      </div>
      <Link to="/dashboard/content" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 mr-1" />Back to Studio
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Generate Image</h1>
        <p className="text-muted-foreground mt-1">Five quick steps to a hero-ready visual.</p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <Label className="text-base font-semibold">1. Choose your goal</Label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`p-3 rounded-lg border-2 text-sm text-center transition ${goal === g.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
              >
                <div className="text-xl mb-1">{g.emoji}</div>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">2. Choose product</Label>
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
            <Label className="text-base font-semibold">3. Describe your image</Label>
            <Button variant="ghost" size="sm" onClick={onSuggest} disabled={suggesting}>
              {suggesting ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Sparkles className="size-3.5 mr-1" />}
              Let AI suggest
            </Button>
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A premium ceramic mug on a marble counter with morning light…"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">4. Choose format</Label>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`p-3 rounded-lg border-2 text-sm transition ${format === f.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={onGenerate} disabled={loading} size="lg" className="w-full">
          {loading ? <><Loader2 className="size-4 mr-2 animate-spin" />Creating your image...</> : <><Sparkles className="size-4 mr-2" />Generate Image</>}
        </Button>
      </Card>

      {loading && (
        <Card className="p-8 text-center">
          <Loader2 className="size-10 mx-auto mb-3 text-primary animate-spin" />
          <p className="font-medium">Creating your image...</p>
          <p className="text-sm text-muted-foreground mt-1">This usually takes 10-20 seconds.</p>
        </Card>
      )}

      {resultUrl && !loading && (
        <Card className="p-4 space-y-4">
          <img src={resultUrl} alt="Generated" className="w-full rounded-lg" />
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
