import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateBusiness } from "@/lib/ai/businessGen.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Wand2, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/new")({
  component: NewBusinessWizard,
});

const businessTypes = [
  "physical_product", "digital_product", "service", "subscription", "course", "coaching", "membership", "event", "other",
] as const;

const goals = [
  { v: "sales", label: "Get more sales" },
  { v: "leads", label: "Capture leads" },
  { v: "subscribers", label: "Grow subscribers" },
  { v: "awareness", label: "Build brand awareness" },
];

type Form = {
  name: string;
  type: typeof businessTypes[number];
  description: string;
  target_audience: string;
  pain_point: string;
  desired_result: string;
  goal: string;
  country: string;
};

const empty: Form = {
  name: "",
  type: "physical_product",
  description: "",
  target_audience: "",
  pain_point: "",
  desired_result: "",
  goal: "sales",
  country: "",
};

function NewBusinessWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(empty);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const generateFn = useServerFn(generateBusiness);

  const generationSteps = [
    "Analyzing your business",
    "Crafting brand voice & positioning",
    "Designing your opening offer",
    "Writing your storefront",
    "Generating Wazeer AI recommendations",
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
    const t = setInterval(() => setProgressIdx((i) => Math.min(i + 1, generationSteps.length - 1)), 1500);
    return () => clearInterval(t);
  }, [submitting]);

  const update = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

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
          target_audience: form.target_audience,
          pain_point: form.pain_point,
          desired_result: form.desired_result,
          goal: form.goal,
          country: form.country,
          currency: "USD",
          language: "en",
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


  const steps = [
    {
      title: "What are you launching?",
      content: (
        <div className="space-y-4">
          <div>
            <Label>Business name</Label>
            <Input value={form.name} onChange={(e) => update("name")(e.target.value)} placeholder="e.g. Aura Candles" />
          </div>
          <div>
            <Label>Type</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {businessTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update("type")(t)}
                  className={`rounded-full border px-3 py-1.5 text-sm capitalize transition-colors ${
                    form.type === t ? "bg-foreground text-background" : "hover:bg-secondary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Short description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => update("description")(e.target.value)} placeholder="What you sell, in one or two sentences." />
          </div>
        </div>
      ),
      valid: form.name.length > 1 && form.description.length > 5,
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
            <Label>Their main pain point</Label>
            <Textarea rows={2} value={form.pain_point} onChange={(e) => update("pain_point")(e.target.value)} placeholder="What problem do they have?" />
          </div>
          <div>
            <Label>Result they want</Label>
            <Textarea rows={2} value={form.desired_result} onChange={(e) => update("desired_result")(e.target.value)} placeholder="What outcome do they pay for?" />
          </div>
        </div>
      ),
      valid: form.target_audience.length > 1,
    },
    {
      title: "Goal & country",
      content: (
        <div className="space-y-4">
          <div>
            <Label>Primary goal</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
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
          <div>
            <Label>Country (optional)</Label>
            <Input value={form.country} onChange={(e) => update("country")(e.target.value)} placeholder="e.g. UAE" />
          </div>
        </div>
      ),
      valid: true,
    },
    {
      title: "Generate",
      content: (
        <div className="rounded-2xl border bg-card p-6 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Ready to launch {form.name || "your business"}?</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            We'll create your brand profile, an opening offer, and a storefront draft. You can edit everything next.
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
        <p className="text-sm text-muted-foreground mb-8">Wazeer AI is doing the work. This takes ~20–40 seconds.</p>
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
