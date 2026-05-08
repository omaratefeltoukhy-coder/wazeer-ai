import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Wand2 } from "lucide-react";
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

  useEffect(() => {
    supabase
      .from("workspace_members")
      .select("workspace_id")
      .limit(1)
      .single()
      .then(({ data }) => setWorkspaceId(data?.workspace_id ?? null));
  }, []);

  const update = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const generate = async () => {
    if (!workspaceId) return toast.error("Workspace not ready");
    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");

      // 1) Insert business (real DB save)
      const { data: biz, error: bizErr } = await supabase
        .from("businesses")
        .insert({
          workspace_id: workspaceId,
          user_id: uid,
          name: form.name,
          type: form.type,
          description: form.description,
          target_audience: form.target_audience,
          pain_point: form.pain_point,
          desired_result: form.desired_result,
          goal: form.goal,
          country: form.country || null,
        })
        .select("id")
        .single();
      if (bizErr) throw bizErr;
      const businessId = biz.id;

      // 2) Mock AI generation → save brand profile, offer, storefront draft
      const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `biz-${businessId.slice(0, 6)}`;

      await Promise.all([
        supabase.from("brand_profiles").insert({
          business_id: businessId,
          brand_name: form.name,
          tone: "Confident, warm, modern",
          visual_style: "Clean, premium, minimal",
          positioning: `Helps ${form.target_audience || "customers"} achieve ${form.desired_result || "their goal"}`,
          benefits_json: [form.desired_result, "Saves time", "Easy to start"].filter(Boolean),
          pain_points_json: [form.pain_point].filter(Boolean),
        }),
        supabase.from("offers").insert({
          business_id: businessId,
          name: `${form.name} — Starter Offer`,
          type: form.type,
          description: form.description,
          price: 49,
          currency: "USD",
          billing_interval: form.type === "saas" || form.type === "course" ? "month" : null,
          status: "draft",
        }),
        supabase.from("storefronts").insert({
          business_id: businessId,
          slug,
          title: form.name,
          status: "draft",
          content_json: {
            hero: { headline: form.name, sub: form.description },
            sections: ["hero", "benefits", "offer", "faq"],
          },
        }),
      ]);

      toast.success("Business created");
      navigate({ to: "/dashboard" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
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
