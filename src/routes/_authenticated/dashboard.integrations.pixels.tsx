import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/integrations/pixels")({
  component: PixelsPage,
});

const PROVIDERS = [
  { id: "meta", name: "Meta Pixel", desc: "Track conversions from your Facebook & Instagram ads.", color: "bg-blue-500/10 text-blue-600" },
  { id: "google_analytics", name: "Google Analytics", desc: "Measure traffic and behavior across your storefront.", color: "bg-amber-500/10 text-amber-600" },
  { id: "tiktok", name: "TikTok Pixel", desc: "Optimize TikTok ad campaigns with conversion data.", color: "bg-pink-500/10 text-pink-600" },
  { id: "x", name: "X Pixel", desc: "Track conversions from X (Twitter) ad campaigns.", color: "bg-foreground/10 text-foreground" },
];

function PixelsPage() {
  const [pixels, setPixels] = useState<Record<string, { id?: string; pixel_id: string; is_active: boolean }>>({});
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const { data: ws } = await supabase.from("workspaces").select("id").limit(1).maybeSingle();
      if (!ws) return;
      setWorkspaceId(ws.id);
      const { data } = await supabase.from("pixel_integrations").select("*").eq("workspace_id", ws.id);
      const map: any = {};
      (data ?? []).forEach((p) => { map[p.provider] = { id: p.id, pixel_id: p.pixel_id ?? "", is_active: p.is_active }; });
      setPixels(map);
    })();
  }, []);

  const save = async (provider: string) => {
    if (!workspaceId) return;
    setSaving(provider);
    const px = pixels[provider] ?? { pixel_id: "", is_active: false };
    const { error } = await supabase.from("pixel_integrations").upsert({
      workspace_id: workspaceId,
      provider,
      pixel_id: px.pixel_id,
      is_active: !!px.pixel_id,
    }, { onConflict: "workspace_id,provider" });
    setSaving(null);
    if (error) return toast.error(error.message);
    setPixels({ ...pixels, [provider]: { ...px, is_active: !!px.pixel_id } });
    toast.success("Pixel saved");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tracking Pixels</h1>
        <p className="text-sm text-muted-foreground">Connect tracking pixels to measure ad performance.</p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((p) => {
          const cur = pixels[p.id] ?? { pixel_id: "", is_active: false };
          const isOpen = open[p.id] ?? false;
          return (
            <Collapsible key={p.id} open={isOpen} onOpenChange={(v) => setOpen({ ...open, [p.id]: v })}>
              <Card className="p-4">
                <CollapsibleTrigger className="w-full flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg grid place-items-center font-bold ${p.color}`}>{p.name[0]}</div>
                    <div className="text-left">
                      <div className="font-medium flex items-center gap-2">
                        {p.name}
                        {cur.is_active && <Badge className="bg-emerald-500/15 text-emerald-700"><Check className="h-3 w-3 mr-0.5" /> Active</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.desc}</div>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 flex gap-2">
                  <Input
                    placeholder="Pixel ID"
                    value={cur.pixel_id}
                    onChange={(e) => setPixels({ ...pixels, [p.id]: { ...cur, pixel_id: e.target.value } })}
                  />
                  <Button onClick={() => save(p.id)} disabled={saving === p.id}>
                    {saving === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
