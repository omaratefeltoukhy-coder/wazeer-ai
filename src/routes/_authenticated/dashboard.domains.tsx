import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Copy, Check, ExternalLink, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/domains")({
  component: DomainsPage,
});

type Biz = { id: string; name: string; slug: string | null; storefronts: { slug: string; published_url: string | null }[] | null };

function isValidDomain(d: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(d.trim().toLowerCase());
}

function DomainsPage() {
  const [biz, setBiz] = useState<Biz[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id, name, slug, storefronts ( slug, published_url )")
        .order("created_at", { ascending: false });
      setBiz((data ?? []) as unknown as Biz[]);
    })();
  }, []);

  const saveDomain = async (businessId: string, domain: string) => {
    if (!domain.trim()) {
      // Clear custom domain
      const { error } = await supabase.from("storefronts").update({ published_url: null }).eq("business_id", businessId);
      if (error) toast.error(error.message);
      else {
        toast.success("Custom domain removed");
        setBiz((b) =>
          b?.map((x) =>
            x.id === businessId
              ? { ...x, storefronts: x.storefronts?.map((s) => ({ ...s, published_url: null })) ?? null }
              : x
          ) ?? null
        );
      }
      return;
    }

    const clean = domain.trim().toLowerCase();
    if (!isValidDomain(clean)) {
      toast.error("Please enter a valid domain (e.g. shop.example.com)");
      return;
    }

    setSaving(businessId);
    const { error } = await supabase.from("storefronts").update({ published_url: clean }).eq("business_id", businessId);
    setSaving(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Custom domain saved. Configure DNS below to activate.");
    setBiz((b) =>
      b?.map((x) =>
        x.id === businessId
          ? { ...x, storefronts: x.storefronts?.map((s) => ({ ...s, published_url: clean })) ?? null }
          : x
      ) ?? null
    );
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  };

  if (biz === null) {
    return (
      <div className="p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto space-y-8">
      <div>
        <Link to="/dashboard/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to settings
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Custom Domains</h1>
        <p className="text-sm text-muted-foreground mt-1">Connect your own domain to your storefronts.</p>
      </div>

      {biz.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium">Create a business first</h3>
          <p className="text-sm text-muted-foreground mt-1">You need a storefront before connecting a custom domain.</p>
          <Link to="/dashboard/new">
            <Button className="mt-4 bg-brand-gradient text-primary-foreground">Create business</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {biz.map((b) => {
            const sf = b.storefronts?.[0];
            const currentDomain = sf?.published_url || "";
            const [domain, setDomain] = useState(currentDomain);

            return (
              <Card key={b.id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{b.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Default: {window.location.origin}/s/{sf?.slug || b.slug || "..."}
                    </p>
                  </div>
                  {currentDomain ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">Configured</Badge>
                  ) : (
                    <Badge variant="outline">Default URL</Badge>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="shop.yourdomain.com"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => saveDomain(b.id, domain)}
                      disabled={saving === b.id}
                      className="bg-brand-gradient text-primary-foreground"
                    >
                      {saving === b.id ? "Saving..." : "Save"}
                    </Button>
                  </div>

                  {currentDomain && (
                    <div className="rounded-lg border bg-secondary/40 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium">DNS Configuration Required</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Add this CNAME record in your DNS provider to point your domain to Wazeer:
                      </p>
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-xs">
                          <div className="grid grid-cols-3 gap-4 flex-1">
                            <div><span className="text-muted-foreground">Type</span><div className="font-medium">CNAME</div></div>
                            <div><span className="text-muted-foreground">Name</span><div className="font-medium">{currentDomain.split(".")[0]}</div></div>
                            <div><span className="text-muted-foreground">Value</span><div className="font-medium">cname.wazeer.ai</div></div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copy(`CNAME  ${currentDomain.split(".")[0]}  cname.wazeer.ai`, b.id)}
                          >
                            {copied === b.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        DNS changes can take up to 24 hours to propagate. Contact support if you need help.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
