import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getStorefrontByBusiness,
  updateStorefront,
  regenerateStorefrontSection,
  setStorefrontPublishStatus,
} from "@/lib/ai/storefront.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ExternalLink, Globe, Loader2, RefreshCw, Save, Sparkles, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/storefront/$businessId")({
  component: StorefrontEditor,
});

type Hero = { headline: string; sub: string; cta: string };
type Bullet = { title: string; body: string };
type Step = { step: string; body: string };
type Faq = { q: string; a: string };
type SF = {
  title?: string;
  hero?: Hero;
  benefits?: Bullet[];
  how_it_works?: Step[];
  testimonials?: { quote: string; author: string }[];
  faq?: Faq[];
  final_cta?: Hero;
};

function StorefrontEditor() {
  const { businessId } = Route.useParams();
  const navigate = useNavigate();
  const fetchFn = useServerFn(getStorefrontByBusiness);
  const updateFn = useServerFn(updateStorefront);
  const regenFn = useServerFn(regenerateStorefrontSection);
  const publishFn = useServerFn(setStorefrontPublishStatus);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<SF>({});
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [slug, setSlug] = useState<string>("");
  const [bizName, setBizName] = useState<string>("");
  const [offerName, setOfferName] = useState<string>("");

  const reload = async () => {
    setLoading(true);
    try {
      const res: any = await fetchFn({ data: { business_id: businessId } });
      setTitle(res.storefront?.title ?? "");
      setContent((res.storefront?.content_json ?? {}) as SF);
      setStatus((res.storefront?.status ?? "draft") as any);
      setSlug(res.storefront?.slug ?? "");
      setBizName(res.business?.name ?? "");
      setOfferName(res.offer?.name ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load storefront");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [businessId]);

  const save = async () => {
    setSaving(true);
    try {
      await updateFn({ data: { business_id: businessId, title, content_json: content as any } });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const regen = async (section: "hero" | "benefits" | "how_it_works" | "faq" | "final_cta") => {
    setRegenerating(section);
    try {
      const res: any = await regenFn({ data: { business_id: businessId, section } });
      setContent((c) => ({ ...c, [section]: res.content }));
      toast.success(`${section.replace(/_/g, " ")} regenerated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegenerating(null);
    }
  };

  const togglePublish = async () => {
    const action = status === "published" ? "unpublish" : "publish";
    if (action === "publish") {
      const ok = window.confirm(`Publish this storefront live at /s/${slug}? You can unpublish anytime.`);
      if (!ok) return;
    }
    setPublishing(true);
    try {
      // Save first to capture latest edits.
      await updateFn({ data: { business_id: businessId, title, content_json: content as any } });
      const res: any = await publishFn({ data: { business_id: businessId, action } });
      setStatus(res.status);
      toast.success(action === "publish" ? "Storefront published" : "Storefront unpublished");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const publicUrl = useMemo(() => (slug ? `/s/${slug}` : ""), [slug]);

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={() => navigate({ to: "/dashboard" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </button>
        <div className="flex items-center gap-2">
          <Badge variant={status === "published" ? "default" : "secondary"}>
            {status === "published" ? "Live" : "Draft"}
          </Badge>
          {status === "published" && publicUrl && (
            <Link to="/s/$slug" params={{ slug }} target="_blank" className="text-sm inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3.5 w-3.5" /> View live
            </Link>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{bizName}</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">Storefront editor</h1>
        <p className="text-sm text-muted-foreground mt-1">Edit any section. Regenerate with AI. Approve, then publish.</p>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <Label>Page title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline shown in browser tab" />
      </div>

      {/* Hero */}
      <SectionShell
        title="Hero"
        onRegenerate={() => regen("hero")}
        regenerating={regenerating === "hero"}
      >
        <div className="grid gap-3">
          <div>
            <Label>Headline</Label>
            <Input value={content.hero?.headline ?? ""} onChange={(e) => setContent((c) => ({ ...c, hero: { ...(c.hero ?? { headline: "", sub: "", cta: "" }), headline: e.target.value } }))} />
          </div>
          <div>
            <Label>Sub</Label>
            <Textarea rows={2} value={content.hero?.sub ?? ""} onChange={(e) => setContent((c) => ({ ...c, hero: { ...(c.hero ?? { headline: "", sub: "", cta: "" }), sub: e.target.value } }))} />
          </div>
          <div>
            <Label>CTA label</Label>
            <Input value={content.hero?.cta ?? ""} onChange={(e) => setContent((c) => ({ ...c, hero: { ...(c.hero ?? { headline: "", sub: "", cta: "" }), cta: e.target.value } }))} />
          </div>
        </div>
      </SectionShell>

      {/* Benefits */}
      <SectionShell title="Benefits" onRegenerate={() => regen("benefits")} regenerating={regenerating === "benefits"}>
        <div className="grid gap-3">
          {(content.benefits ?? []).map((b, i) => (
            <div key={i} className="rounded-xl border p-3 space-y-2">
              <Input value={b.title} onChange={(e) => setContent((c) => { const next = [...(c.benefits ?? [])]; next[i] = { ...next[i], title: e.target.value }; return { ...c, benefits: next }; })} placeholder="Benefit title" />
              <Textarea rows={2} value={b.body} onChange={(e) => setContent((c) => { const next = [...(c.benefits ?? [])]; next[i] = { ...next[i], body: e.target.value }; return { ...c, benefits: next }; })} placeholder="Benefit body" />
            </div>
          ))}
        </div>
      </SectionShell>

      {/* How it works */}
      <SectionShell title="How it works" onRegenerate={() => regen("how_it_works")} regenerating={regenerating === "how_it_works"}>
        <div className="grid gap-3">
          {(content.how_it_works ?? []).map((s, i) => (
            <div key={i} className="rounded-xl border p-3 space-y-2">
              <Input value={s.step} onChange={(e) => setContent((c) => { const next = [...(c.how_it_works ?? [])]; next[i] = { ...next[i], step: e.target.value }; return { ...c, how_it_works: next }; })} placeholder={`Step ${i + 1}`} />
              <Textarea rows={2} value={s.body} onChange={(e) => setContent((c) => { const next = [...(c.how_it_works ?? [])]; next[i] = { ...next[i], body: e.target.value }; return { ...c, how_it_works: next }; })} />
            </div>
          ))}
        </div>
      </SectionShell>

      {/* Testimonials – empty state placeholder per global rules */}
      <SectionShell title="Testimonials" hideRegenerate>
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No testimonials yet. We don't generate fake reviews. Add real customer quotes here once you have them.
        </div>
      </SectionShell>

      {/* FAQ */}
      <SectionShell title="FAQ" onRegenerate={() => regen("faq")} regenerating={regenerating === "faq"}>
        <div className="grid gap-3">
          {(content.faq ?? []).map((f, i) => (
            <div key={i} className="rounded-xl border p-3 space-y-2">
              <Input value={f.q} onChange={(e) => setContent((c) => { const next = [...(c.faq ?? [])]; next[i] = { ...next[i], q: e.target.value }; return { ...c, faq: next }; })} placeholder="Question" />
              <Textarea rows={2} value={f.a} onChange={(e) => setContent((c) => { const next = [...(c.faq ?? [])]; next[i] = { ...next[i], a: e.target.value }; return { ...c, faq: next }; })} placeholder="Answer" />
            </div>
          ))}
        </div>
      </SectionShell>

      {/* Final CTA */}
      <SectionShell title="Final CTA" onRegenerate={() => regen("final_cta")} regenerating={regenerating === "final_cta"}>
        <div className="grid gap-3">
          <Input value={content.final_cta?.headline ?? ""} onChange={(e) => setContent((c) => ({ ...c, final_cta: { ...(c.final_cta ?? { headline: "", sub: "", cta: "" }), headline: e.target.value } }))} placeholder="Headline" />
          <Textarea rows={2} value={content.final_cta?.sub ?? ""} onChange={(e) => setContent((c) => ({ ...c, final_cta: { ...(c.final_cta ?? { headline: "", sub: "", cta: "" }), sub: e.target.value } }))} placeholder="Sub" />
          <Input value={content.final_cta?.cta ?? ""} onChange={(e) => setContent((c) => ({ ...c, final_cta: { ...(c.final_cta ?? { headline: "", sub: "", cta: "" }), cta: e.target.value } }))} placeholder="CTA label" />
        </div>
      </SectionShell>

      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="text-sm font-medium">Checkout offer</div>
        <p className="text-sm text-muted-foreground">
          {offerName ? `"${offerName}"` : "No offer yet"} — checkout is wired through the demo flow when published.
        </p>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card/95 backdrop-blur px-4 py-3 shadow-elevated">
        <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Globe className="h-3.5 w-3.5" /> {publicUrl ? `wazeer.ai${publicUrl}` : "Not yet published"}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
          <Button onClick={togglePublish} disabled={publishing} className="bg-brand-gradient text-primary-foreground shadow-glow">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {status === "published" ? "Unpublish" : "Approve & publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionShell({
  title, children, onRegenerate, regenerating, hideRegenerate,
}: {
  title: string;
  children: React.ReactNode;
  onRegenerate?: () => void;
  regenerating?: boolean;
  hideRegenerate?: boolean;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {!hideRegenerate && onRegenerate && (
          <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Regenerate
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}
