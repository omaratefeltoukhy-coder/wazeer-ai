import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Gift, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function ReferralBanner() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const refLink = `${window.location.origin}/signup?ref=${user.id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(refLink);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Gift className="h-4 w-4 text-emerald-brand" />
        <span className="text-sm font-medium">Give $15, Get $15</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Share Wazeer with a friend. When they subscribe, you both get $15 in credits.
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs text-muted-foreground truncate">
          {refLink}
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={copy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
