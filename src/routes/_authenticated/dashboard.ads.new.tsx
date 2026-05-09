import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { confirmDialog } from "@/components/ui/confirm";
import { Check, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, X, Rocket, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/ads/new")({
  component: NewCampaignWizard,
});

const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Australia", "Germany", "France",
  "Spain", "Italy", "Netherlands", "Sweden", "Brazil", "Mexico", "Japan", "India",
  "United Arab Emirates", "Saudi Arabia", "South Africa",
];

type Variant = { image_url?: string; headline: string; caption: string };

function NewCampaignWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [name, setName] = useState("New Campaign");
  const [productId, setProductId] = useState<string>("brand");
  const [audience, setAudience] = useState("new_customers");
  const [locations, setLocations] = useState<string[]>(["United States"]);
  const [locQuery, setLocQuery] = useState("");
  const [budgetDaily, setBudgetDaily] = useState(20);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [variants, setVariants] = useState<Variant[]>([{ headline: "", caption: "" }]);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: prods } = await supabase.from("products").select("id,title").order("created_at", { ascending: false });
      setProducts(prods ?? []);
      const { data: imgs } = await supabase.from("ai_content").select("id,result_url,prompt").eq("content_type", "image").not("result_url", "is", null).order("created_at", { ascending: false }).limit(20);
      setImages(imgs ?? []);
    })();
  }, []);

  const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
  const total = budgetDaily * days;

  const addVariant = () => variants.length < 4 && setVariants([...variants, { headline: "", caption: "" }]);
  const updateVariant = (i: number, patch: Partial<Variant>) => {
    setVariants(variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  };
  const removeVariant = (i: number) => setVariants(variants.filter((_, idx) => idx !== i));

  const generateAICopy = (i: number) => {
    const product = products.find((p) => p.id === productId);
    const headline = product ? `Discover ${product.title} today` : "Transform your business today";
    const caption = "Join thousands who've already made the switch. Limited-time offer inside. âœ¨";
    updateVariant(i, { headline, caption });
    toast.success("AI copy generated");
  };

  const launch = async () => {
    // Risky action â€” explicit approval required. Show the user the actual
    // spend they're committing to before anything is written.
    const productLabel = productId === "brand"
      ? "brand awareness"
      : products.find((p) => p.id === productId)?.title ?? "your product";
    const ok = await confirmDialog({
      title: "Save campaign as draft?",
      description: `"${name}" will run for ${days} days at $${budgetDaily.toFixed(2)}/day â€” total budget $${total.toFixed(2)}. The campaign saves as a DRAFT and will not spend money until you connect Meta and explicitly publish it. Promoting: ${productLabel}. Locations: ${locations.join(", ")}.`,
      confirmText: "Save as draft",
    });
    if (!ok) return;

    setLaunching(true);
    try {
      const { data: ws } = await supabase.from("workspaces").select("id").limit(1).maybeSingle();
      const { data: userRes } = await supabase.auth.getUser();
      if (!ws || !userRes.user) throw new Error("Workspace not ready");
      const { data, error } = await supabase.from("ad_campaigns").insert({
        workspace_id: ws.id,
        user_id: userRes.user.id,
        product_id: productId === "brand" ? null : productId,
        name,
        audience_type: audience,
        status: "draft",
        budget_daily: budgetDaily,
        start_date: startDate,
        end_date: endDate,
        locations,
        ad_variants: variants,
      }).select("id").single();
      if (error) throw error;
      toast.success("Campaign saved as draft. Connect Meta to launch.");
      navigate({ to: "/dashboard/ads/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save campaign");
    } finally {
      setLaunching(false);
    }
  };

  const filteredCountries = COUNTRIES.filter((c) => c.toLowerCase().includes(locQuery.toLowerCase()));
  const toggleLoc = (c: string) => setLocations(locations.includes(c) ? locations.filter((x) => x !== c) : [...locations, c]);

  const steps = ["Product", "Audience", "Budget", "Creative", "Review"];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 flex items-center gap-2">
        <Info className="h-4 w-4" /> Demo mode â€” this campaign will be saved as a draft. Real Meta ad spend will only occur after you connect a live Meta ad account and explicitly launch.
      </div>
      <div>
        <Link to="/dashboard/ads" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to campaigns
        </Link>
        <h1 className="text-2xl font-semibold mt-2">New Campaign</h1>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full grid place-items-center font-medium ${
              step > i + 1 ? "bg-primary text-primary-foreground" : step === i + 1 ? "bg-primary/20 text-primary" : "bg-muted"
            }`}>{step > i + 1 ? <Check className="h-3.5 w-3.5" /> : i + 1}</div>
            <span className={step === i + 1 ? "font-medium" : "text-muted-foreground"}>{s}</span>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <Card className="p-6 space-y-4">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Campaign name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Promote</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="brand">General brand awareness</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Who do you want to reach?</Label>
              <RadioGroup value={audience} onValueChange={setAudience} className="mt-2 space-y-2">
                {[
                  { v: "new_customers", l: "New potential customers" },
                  { v: "existing", l: "My existing members" },
                  { v: "lookalike", l: "Lookalike of my buyers" },
                ].map((o) => (
                  <label key={o.v} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-secondary/40">
                    <RadioGroupItem value={o.v} /> {o.l}
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label>Locations</Label>
              <Input placeholder="Search countries..." value={locQuery} onChange={(e) => setLocQuery(e.target.value)} className="mb-2" />
              <div className="flex flex-wrap gap-1.5 mb-2">
                {locations.map((c) => (
                  <Badge key={c} variant="secondary" className="cursor-pointer" onClick={() => toggleLoc(c)}>
                    {c} <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                {filteredCountries.map((c) => (
                  <button key={c} type="button" onClick={() => toggleLoc(c)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary/40 ${locations.includes(c) ? "bg-primary/10" : ""}`}>
                    {locations.includes(c) && <Check className="h-3.5 w-3.5 inline mr-1" />}
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label>Daily budget (USD)</Label>
              <Input type="number" min={1} value={budgetDaily} onChange={(e) => setBudgetDaily(Number(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>End date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <div className="text-muted-foreground">Total budget ({days} days)</div>
              <div className="text-2xl font-semibold mt-1">${total.toFixed(2)}</div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Ad variants ({variants.length}/4)</Label>
              <Button size="sm" variant="outline" onClick={addVariant} disabled={variants.length >= 4}>
                + Add variant
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {variants.map((v, i) => (
                <Card key={i} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Ad #{i + 1}</span>
                    {variants.length > 1 && (
                      <button onClick={() => removeVariant(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Select value={v.image_url ?? ""} onValueChange={(val) => updateVariant(i, { image_url: val })}>
                    <SelectTrigger><SelectValue placeholder="Select image" /></SelectTrigger>
                    <SelectContent>
                      {images.length === 0 && <SelectItem value="none" disabled>No images yet</SelectItem>}
                      {images.map((img) => (
                        <SelectItem key={img.id} value={img.result_url}>
                          {img.prompt?.slice(0, 40) ?? "Image"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {v.image_url ? (
                    <img src={v.image_url} alt="" className="w-full h-32 object-cover rounded" />
                  ) : (
                    <div className="w-full h-32 bg-muted rounded grid place-items-center text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                  <Input placeholder="Headline" value={v.headline} onChange={(e) => updateVariant(i, { headline: e.target.value })} />
                  <Textarea placeholder="Caption" rows={2} value={v.caption} onChange={(e) => updateVariant(i, { caption: e.target.value })} />
                  <Button size="sm" variant="ghost" className="w-full" onClick={() => generateAICopy(i)}>
                    âœ¨ AI generate copy
                  </Button>
                </Card>
              ))}
            </div>
            <Link to="/dashboard/content/image" className="text-sm text-primary hover:underline">
              + Generate new images in Content Studio
            </Link>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Review your campaign</h3>
            <div className="space-y-2 text-sm">
              <Row label="Name" value={name} />
              <Row label="Promoting" value={productId === "brand" ? "Brand awareness" : products.find((p) => p.id === productId)?.title ?? "â€”"} />
              <Row label="Audience" value={audience.replace("_", " ")} />
              <Row label="Locations" value={locations.join(", ")} />
              <Row label="Schedule" value={`${startDate} â†’ ${endDate} (${days} days)`} />
              <Row label="Daily budget" value={`$${budgetDaily}`} />
              <Row label="Total budget" value={`$${total.toFixed(2)}`} />
              <Row label="Ad variants" value={String(variants.length)} />
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
              Saves as a draft. Wazeer will never charge your ad account until you connect Meta and explicitly approve the launch.
            </div>
            <div className="flex gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setShowMetaModal(true)}>Connect Meta Account</Button>
              <Button onClick={launch} disabled={launching} className="flex-1">
                {launching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Rocket className="h-4 w-4 mr-1" />}
                Approve &amp; save campaign
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 1}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step < 5 && (
          <Button onClick={() => setStep(step + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={showMetaModal} onOpenChange={setShowMetaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Meta integration coming soon</DialogTitle>
            <DialogDescription>
              Your campaign will be saved as a draft. Once you connect your Meta Ads account, it will launch automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowMetaModal(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
