import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateBusiness } from "@/lib/ai/businessGen.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Wand2, Check, Upload, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/new")({
  validateSearch: (s: Record<string, unknown>) => ({
    idea: typeof s.idea === "string" ? s.idea : "",
  }),
  component: NewBusinessWizard,
});

const businessTypes = [
  "physical_product", "digital_product", "service", "course", "coaching", "membership", "event", "subscription", "other",
] as const;

const goals = [
  { v: "first_sale", label: "First sale" },
  { v: "leads", label: "Generate leads" },
  { v: "subscribers", label: "Sell subscriptions" },
  { v: "calls", label: "Book calls" },
  { v: "meta_ads", label: "Launch Meta ads" },
  { v: "email_list", label: "Grow email list" },
  { v: "event", label: "Promote event" },
  { v: "community", label: "Build community" },
];

const currencies = ["USD", "EUR", "GBP", "AED", "SAR", "BRL", "INR", "CAD", "AUD"];

const languages = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ar", label: "Arabic" },
  { code: "pt", label: "Portuguese" },
  { code: "hi", label: "Hindi" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "other", label: "Other" },
];

type Form = {
  name: string;
  type: typeof businessTypes[number];
  description: string;
  product_url: string;
  target_audience: string;
  pain_point: string;
  desired_result: string;
  country: string;
  language: string;
  price_one_time: string;
  price_subscription: string;
  free_trial: boolean;
  discount: string;
  currency: string;
  goal: string;
};

const empty: Form = {
  name: "",
  type: "physical_product",
  description: "",
  product_url: "",
  target_audience: "",
  pain_point: "",
  desired_result: "",
  country: "",
  language: "en",
  price_one_time: "",
  price_subscription: "",
  free_trial: false,
  discount: "",
  currency: "USD",
  goal: "first_sale",
};

function NewBusinessWizard() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(empty);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const generateFn = useServerFn(generateBusiness);

  // Prefill from hero input
  useEffect(() => {
    const idea = search.idea || (() => { try { return sessionStorage.getItem("wazeer_hero_idea") || ""; } catch { return ""; } })();
    const hint = (() => { try { return sessionStorage.getItem("wazeer_hero_file_name") || ""; } catch { return ""; } })();
    if (idea) {
      setForm((f) => ({ ...f, description: idea }));
      try { sessionStorage.removeItem("wazeer_hero_idea"); sessionStorage.removeItem("wazeer_hero_file_name"); } catch { /* ignore */ }
    }
    if (hint) setFileName(hint);
  }, [search.idea]);

  const generationSteps = [
    "Understanding your business",
    "Creating your offer",
    "Building your storefront",
    "Generating starter creative ideas",
    "Writing UGC scripts",
    "Creating UGC video plan",
    "Writing email sequence",
    "Preparing Meta post / ad drafts",
    "Setting up dashboard",
  ];

  const loadWorkspace = async (): Promise<string | null> => {
    const { data: m } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .limit(1)
      .maybeSingle();
    if (m?.workspace_id) {
      setWorkspaceId(m.workspace_id);
      return m.workspace_id;
    }
    return null;
  };

  useEffect(() => { void loadWorkspace(); }, []);

  useEffect(() => {
    if (!submitting) return;
    setProgressIdx(0);
    const t = setInterval(() => setProgressIdx((i) => Math.min(i + 1, generationSteps.length - 1)), 1200);
    return () => clearInterval(t);
  }, [submitting]);

  const update = (k: keyof Form) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const generate = async () => {
    let wsId = workspaceId;
    if (!wsId) wsId = await loadWorkspace();
    if (!wsId) {
      toast.error("Your workspace isn't ready yet. Please refresh the page and try again.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await generateFn({
        data: {
          workspace_id: wsId,
          name: form.name,
          type: form.type,
          description: form.description,
          product_url: form.product_url || undefined,
          target_audience: form.target_audience,
          pain_point: form.pain_point,
          desired_result: form.desired_result,
          goal: form.goal,
          country: form.country,
          currency: form.currency,
          language: form.language,
          price_one_time: form.price_one_time ? Number(form.price_one_time) : undefined,
          price_subscription: form.price_subscription ? Number(form.price_subscription) : undefined,
          free_trial: form.free_trial,
          discount: form.discount || undefined,
        },
      });
      toast.success("Your business is ready!");
      navigate({ to: "/dashboard/storefront/$businessId", params: { businessId: res.business_id } });
    } catch (e) {
      let msg: string;
      if (e instanceof Response) {
        try { msg = (await e.text()) || `${e.status} ${e.statusText}`; } catch { msg = `${e.status} ${e.statusText}`; }
      } else {
        msg = e instanceof Error ? e.message : String(e);
      }
      console.error("[generateBusiness] failed:", e);
      toast.error(msg || "Could not generate your business. Please try again.");
      setSubmitting(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      toast.error("File too large", { description: "Max 25MB." });
      return;
    }
    setFileName(f.name);
  };

  const clearFile = () => setFileName(null);

  const steps = [
    {
      title: "What are you launching?",
      content: (
        <div className="space-y-4">
          <div>
            <Label>Business name <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input value={form.name} onChange={(e) => update("name")(e.target.value)} placeholder="e.g. Aura Candles" />
          </div>
          <div>
            <Label>One-sentence description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => update("description")(e.target.value)} placeholder="What you sell, in one or two sentences." />
          </div>
          <div>
            <Label>Product / service URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input value={form.product_url} onChange={(e) => update("product_url")(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label>Upload image or video <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="mt-2 flex items-center gap-2">
              <Input type="file" accept="image/*,video/*" onChange={handleFile} />
              {fileName && (
                <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                  <span className="max-w-[140px] truncate">{fileName}</span>
                  <button type="button" onClick={clearFile} className="hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
      valid: form.description.length > 5,
    },
    {
      title: "What type of offer?",
      content: (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {businessTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update("type")(t)}
                className={`rounded-full border px-3 py-1.5 text-sm capitalize transition-colors ${
                  form.type === t ? "bg-foreground text-background" : "hover:bg-secondary"
                }`}
              >
                {t.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      ),
      valid: true,
    },
    {
      title: "Who is it for?",
      content: (
        <div className="space-y-4">
          <div>
            <Label>Target audience</Label>
            <Input value={form.target_audience} onChange={(e) => update("target_audience")(e.target.value)} placeholder="e.g. busy moms in the UAE" />
          </div>
          <div>
            <Label>Main pain point</Label>
            <Textarea rows={2} value={form.pain_point} onChange={(e) => update("pain_point")(e.target.value)} placeholder="What problem do they have?" />
          </div>
          <div>
            <Label>Desired result</Label>
            <Textarea rows={2} value={form.desired_result} onChange={(e) => update("desired_result")(e.target.value)} placeholder="What outcome do they pay for?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Region / country</Label>
              <Input value={form.country} onChange={(e) => update("country")(e.target.value)} placeholder="e.g. UAE" />
            </div>
            <div>
              <Label>Language</Label>
              <select
                value={form.language}
                onChange={(e) => update("language")(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ),
      valid: form.target_audience.length > 1 && form.desired_result.length > 1,
    },
    {
      title: "Pricing",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>One-time price <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="number" min={0} value={form.price_one_time} onChange={(e) => update("price_one_time")(e.target.value)} placeholder="49" />
            </div>
            <div>
              <Label>Subscription price <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="number" min={0} value={form.price_subscription} onChange={(e) => update("price_subscription")(e.target.value)} placeholder="29 / month" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input id="free_trial" type="checkbox" checked={form.free_trial} onChange={(e) => update("free_trial")(e.target.checked)} className="h-4 w-4" />
            <Label htmlFor="free_trial" className="font-normal">Include a free trial</Label>
          </div>
          <div>
            <Label>Discount / offer <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input value={form.discount} onChange={(e) => update("discount")(e.target.value)} placeholder="e.g. 20% off first month" />
          </div>
          <div>
            <Label>Currency</Label>
            <select
              value={form.currency}
              onChange={(e) => update("currency")(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      ),
      valid: true,
    },
    {
      title: "What's your goal?",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {goals.map((g) => (
              <button
                key={g.v}
                type="button"
                onClick={() => update("goal")(g.v)}
                className={`rounded-xl border px-3 py-3 text-sm text-left transition-colors ${
                  form.goal === g.v ? "border-foreground bg-secondary" : "hover:bg-secondary/60"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      ),
      valid: true,
    },
    {
      title: "Review & generate",
      content: (
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-center">Ready to build {form.name || "your business"}?</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">Type</div>
              <div className="font-medium capitalize">{form.type.replace("_", " ")}</div>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">Goal</div>
              <div className="font-medium">{goals.find((g) => g.v === form.goal)?.label}</div>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">Audience</div>
              <div className="font-medium">{form.target_audience || "—"}</div>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">Language</div>
              <div className="font-medium">{languages.find((l) => l.code === form.language)?.label}</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            We'll create your brand profile, offer, storefront draft, content ideas, UGC scripts, email sequence, and Meta drafts. You can edit everything next.
          </p>
          <p className="text-xs text-muted-foreground text-center">
            This uses <span className="font-medium text-foreground">3 AI credits</span>. Credits are refunded if generation fails.
          </p>
        </div>
      ),
      valid: true,
    },
  ];

  const cur = steps[step];

  if (submitting) {
    return (
      <div className="p-6 lg:p-10 max-w-xl mx-auto min-h-[80vh] flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-2xl bg-brand-gradient grid place-items-center shadow-glow mb-6 animate-pulse">
          <Sparkles className="h-7 w-7 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-semibold mb-1">Building {form.name || "your business"}…</h2>
        <p className="text-sm text-muted-foreground mb-8">Wazeer AI is doing the work. This takes ~30–60 seconds.</p>
        <ul className="w-full max-w-sm space-y-3 text-left">
          {generationSteps.map((label, i) => {
            const done = i < progressIdx;
            const active = i === progressIdx;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className={`h-6 w-6 rounded-full grid place-items-center border ${done ? "bg-brand-gradient border-transparent text-primary-foreground" : active ? "border-foreground" : "border-border text-muted-foreground"}`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                </span>
                <span className={done || active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto">
      <button onClick={() => navigate({ to: "/dashboard" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </button>

      <div className="mb-6 flex items-center gap-1.5">
        {steps.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-gradient" : "bg-secondary"}`} />
        ))}
      </div>

      <h1 className="text-2xl font-semibold mb-1">{cur.title}</h1>
      <p className="text-sm text-muted-foreground mb-6">Step {step + 1} of {steps.length}</p>

      <div>{cur.content}</div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!cur.valid}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={generate} disabled={submitting} className="bg-brand-gradient text-primary-foreground shadow-glow">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Generate business
          </Button>
        )}
      </div>
    </div>
  );
}
