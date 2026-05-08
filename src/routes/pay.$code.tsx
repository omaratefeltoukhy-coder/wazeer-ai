import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentLinkCheckout } from "@/lib/billing/paymentLink.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/pay/$code")({
  component: PayPage,
});

type PaymentLinkRow = {
  unique_code: string;
  custom_title: string | null;
  description: string | null;
  amount: number;
  currency: string;
  collect_phone: boolean;
  pass_fee_to_buyer: boolean;
  redirect_url: string | null;
  thank_you_message: string | null;
};

function PayPage() {
  const { code } = useParams({ from: "/pay/$code" });
  const startCheckout = useServerFn(createPaymentLinkCheckout);
  const [link, setLink] = useState<PaymentLinkRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_public_payment_link", { _code: code });
      if (error) {
        console.error("[pay] lookup failed", error);
        setLoading(false);
        return;
      }
      const row = (Array.isArray(data) ? data[0] : data) as PaymentLinkRow | undefined;
      if (row) {
        setLink(row);
        // Click tracking — fire and forget.
        await supabase.rpc("increment_payment_link_clicks", { _code: code });
      }
      setLoading(false);
    })();
  }, [code]);

  const fee = link?.pass_fee_to_buyer ? Number(link.amount) * 0.03 : 0;
  const total = link ? Number(link.amount) + fee : 0;

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link) return;
    setPaying(true);
    try {
      const res = await startCheckout({
        data: {
          code,
          environment: getPaddleEnvironment(),
          buyer_email: email,
          buyer_name: name,
          buyer_phone: phone || undefined,
        },
      });
      // Redirect to Paddle's hosted checkout.
      window.location.href = res.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not start checkout";
      toast.error(msg);
      setPaying(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center p-4"><Skeleton className="h-96 w-full max-w-md" /></div>;
  }

  if (!link) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="p-8 max-w-md text-center">
          <h1 className="font-semibold text-lg">Link not available</h1>
          <p className="text-sm text-muted-foreground mt-1">This payment link is paused or doesn't exist.</p>
        </Card>
      </div>
    );
  }

  const title = link.custom_title ?? "Payment";

  return (
    <div className="min-h-screen bg-muted/30 grid place-items-center p-4">
      <Card className="w-full max-w-md overflow-hidden">
        <div className="p-6 space-y-4">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            {link.description && (
              <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
            )}
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{link.currency} {Number(link.amount).toFixed(2)}</span></div>
            {fee > 0 && <div className="flex justify-between text-muted-foreground"><span>Processing fee</span><span>{link.currency} {fee.toFixed(2)}</span></div>}
            <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Total</span><span>{link.currency} {total.toFixed(2)}</span></div>
          </div>

          <form onSubmit={pay} className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {link.collect_phone && (
              <div>
                <Label>Phone</Label>
                <Input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={paying}>
              {paying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Lock className="h-4 w-4 mr-1" />}
              Continue to secure checkout · {link.currency} {total.toFixed(2)}
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Payments processed securely by Paddle
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
