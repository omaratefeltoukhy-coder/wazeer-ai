import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Upload, Camera, Wand2, ShoppingBag, Video, Mail, Megaphone, BarChart3, X } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import heroGlow from "@/assets/hero-glow.jpg";

const previewChips = [
  { icon: ShoppingBag, label: "Storefront created", tone: "emerald" },
  { icon: Video, label: "UGC video generated", tone: "royal" },
  { icon: Mail, label: "Email sequence ready", tone: "emerald" },
  { icon: Megaphone, label: "Meta ad drafted", tone: "royal" },
  { icon: BarChart3, label: "Sales dashboard live", tone: "emerald" },
];

export function Hero() {
  const [idea, setIdea] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const MAX_BYTES = 25 * 1024 * 1024; // 25MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error("File is too large", { description: "Please choose a file under 25MB." });
      e.target.value = "";
      return;
    }
    setFile(f);
    toast.success("Media attached", { description: f.name });
  };

  const clearFile = () => {
    setFile(null);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  };

  const handleGenerate = () => {
    const trimmed = idea.trim();
    if (trimmed.length < 3) {
      toast.error("Please describe what you sell first.");
      return;
    }
    // Persist so the wizard can pick it up even across auth
    try {
      sessionStorage.setItem("wazeer_hero_idea", trimmed);
      if (file) sessionStorage.setItem("wazeer_hero_file_name", file.name);
    } catch { /* ignore */ }

    if (user) {
      navigate({ to: "/dashboard/new", search: { idea: trimmed } });
    } else {
      navigate({ to: "/signup", search: { redirect: "/dashboard/new", idea: trimmed } });
    }
  };

  return (
    <section className="relative overflow-hidden">
      <img
        src={heroGlow}
        alt=""
        aria-hidden
        width={1920}
        height={1280}
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-60"
      />
      <div className="absolute inset-0 -z-10 bg-hero-glow" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-gradient-to-b from-transparent to-background" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/80 backdrop-blur px-3 py-1 text-xs text-muted-foreground shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-emerald-brand" />
            Your AI growth partner for selling online
          </div>
          <h1 className="mt-6 text-4xl sm:text-6xl font-bold tracking-tight">
            Turn one idea into a <span className="text-gradient">selling system.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Wazeer AI drafts your offer, storefront, images, videos, emails, Meta posts, ads, and growth dashboard — from one simple input.
          </p>
        </div>

        {/* Hero input card */}
        <div className="mx-auto mt-10 max-w-2xl">
          <div className="rounded-3xl border bg-card p-2 shadow-elevated">
            <div className="rounded-2xl bg-secondary/60 p-5">
              <label className="text-xs font-medium text-muted-foreground">
                Describe what you sell, or upload a photo / video
              </label>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="e.g. I sell handmade candles in Dubai…"
                rows={3}
                className="mt-2 w-full resize-none rounded-xl border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  id="camera-input"
                  onChange={handleFileChange}
                />
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" className="sm:w-auto" onClick={() => uploadInputRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Upload
                  </Button>
                  <Button type="button" variant="outline" className="sm:w-auto md:hidden" onClick={() => document.getElementById("camera-input")?.click()}>
                    <Camera className="h-4 w-4" /> Take photo
                  </Button>
                </div>
                {file && (
                  <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                    <span className="max-w-[180px] truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={clearFile}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex-1" />
                <Button className="bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95" onClick={handleGenerate}>
                  <Wand2 className="h-4 w-4" /> Generate my business
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-brand" /> Free 7-day trial</span>
            <span>·</span>
            <span>No credit card needed</span>
          </div>
        </div>

        {/* Preview chips */}
        <div className="mt-14 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {previewChips.map((c, i) => (
            <div
              key={c.label}
              className="rounded-2xl border bg-card/80 backdrop-blur p-4 shadow-soft animate-float-slow"
              style={{ animationDelay: `${i * 0.4}s` }}
            >
              <div
                className={`h-9 w-9 rounded-xl grid place-items-center mb-3 ${
                  c.tone === "emerald" ? "bg-emerald-brand/15 text-emerald-brand" : "bg-royal/15 text-royal"
                }`}
              >
                <c.icon className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium">{c.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">Auto-generated</div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-center gap-3">
          <Button asChild size="lg" className="bg-foreground text-background hover:opacity-90">
            <Link to="/signup">
              Start selling with AI <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <a href="#how">See how it works</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
