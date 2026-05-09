import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { checkIntegrations } from "@/lib/integrations/status.functions";
import { Zap, X, ExternalLink, AlertCircle } from "lucide-react";

export function IntegrationSetupBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [missingCritical, setMissingCritical] = useState(false);
  const [missingCount, setMissingCount] = useState(0);
  const checkFn = useServerFn(checkIntegrations);

  useEffect(() => {
    (async () => {
      try {
        const result = await checkFn({ data: undefined });
        const critical = ["paddle", "resend", "meta", "lovable"];
        const missing = result.integrations.filter((i) => critical.includes(i.id) && i.status !== "connected");
        setMissingCritical(missing.length > 0);
        setMissingCount(missing.length);
      } catch {
        // Silently fail — banner is non-critical
      }
    })();
  }, []);

  if (dismissed || !missingCritical) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{missingCount} critical integration{missingCount > 1 ? "s" : ""} not configured</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Add API keys to start collecting real payments, sending emails, and publishing to social media.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Button asChild size="sm" className="h-7 bg-brand-gradient text-primary-foreground text-xs">
            <Link to="/dashboard/integrations/status">
              <Zap className="h-3 w-3 mr-1" /> Set up integrations
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <a href="/.env.example" target="_blank" rel="noopener noreferrer">
              View .env.example <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
