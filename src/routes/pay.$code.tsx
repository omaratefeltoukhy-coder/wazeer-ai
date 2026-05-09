import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Lock,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { initializePaddle, getPaddleEnvironment } from "@/lib/paddle";
import { createPaymentLinkCheckout } from "@/lib/billing/payment-link.functions";
import { createStripePaymentLinkCheckout } from "@/lib/billing/stripe-payment-link.functions";

export const Route = createFileRoute("/pay/$code")({
  component: PayPage,
  validateSearch: (s: Record<string, unknown>) => ({
    status: typeof s.status === "string" ? s.status : undefined,
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
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
  product_title: string | null;
  product_image_url: string | null;
  product_description: string | null;
  seller_name: string | null;
};

// Detect which provider to use. Stripe is preferred when configured.
function usePaymentProvider() {
  const hasPaddle = Boolean(import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN);
  const hasStripe = true; // Server-side check; client always tries Stripe first
  return { provider: hasStripe ? "stripe" : (hasPaddle ? "paddle" : "none") as "stripe" | "paddle" | "none" };
}

function PayPage() {
  const { code } = useParams({ from: "/pay/$code" });
  const search = Route.useSearch();
  const [link, setLink] = useState<PaymentLinkRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const { provider } = usePaymentProvider();

  // Detect return from checkout success
  useEffect(() => {
    if (search.status !== "success") return;
    if (loading) return;

    // Stripe success
    if (search.session_id && link) {
      setDone(true);
      return;
    }

    // Paddle success
    const txnId = sessionStorage.getItem(`paddle_txn_${code}`);
    const storedEmail = sessionStorage.getItem(`paddle_email_${code}`);
    const storedName = sessionStorage.getItem(`paddle_name_${code}`);
    const storedPhone = sessionStorage.getItem(`paddle_phone_${code}`);

    if (txnId && link) {
      const total =
        Number(link.amount) +
        (link.pass_fee_to_buyer ? Number(link.amount) * 0.03 : 0);

      (supabase as any)
        .rpc("record_payment_link_purchase", {
          _code: code,
          _buyer_name: storedName || "Customer",
          _buyer_email: storedEmail || "customer@example.com",
          _buyer_phone: storedPhone || null,
          _amount: total,
          _currency: link.currency,
          _provider_transaction_id: txnId,
          _provider: "paddle",
        })
        .then(() => {
          sessionStorage.removeItem(`paddle_txn_${code}`);
          sessionStorage.removeItem(`paddle_email_${code}`);
          sessionStorage.removeItem(`paddle_name_${code}`);
          sessionStorage.removeItem(`paddle_phone_${code}`);
        })
        .catch((err: any) => {
          console.error(
            "[pay] post-checkout record failed (webhook will retry):",
            err
          );
        })
        .finally(() => setDone(true));
    } else {
      setDone(true);
    }

    if (window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete("status");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, [search.status, search.session_id, loading, code, link]);

  useEffect(() => {
    if (done && link?.redirect_url) {
      const t = setTimeout(() => {
        window.location.href = link.redirect_url!;
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [done, link]);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_public_payment_link",
        { _code: code }
      );
      if (error) {
        console.error("[pay] lookup failed", error);
        setLoading(false);
        return;
      }
      const row = (Array.isArray(data) ? data[0] : data) as
        | PaymentLinkRow
        | undefined;
      if (row) {
        setLink(row);
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
    setPayError(null);

    try {
      if (provider === "stripe") {
        const { url } = await createStripePaymentLinkCheckout({
          data: {
            code,
            buyerEmail: email,
            buyerName: name,
            buyerPhone: phone || undefined,
          },
        });
        if (url) {
          window.location.href = url;
          return;
        }
        throw new Error("Stripe checkout URL not returned");
      }

      // Fallback to Paddle
      const { transactionId } = await createPaymentLinkCheckout({
        data: {
          code,
          buyerEmail: email,
          buyerName: name,
          buyerPhone: phone || undefined,
          environment: getPaddleEnvironment(),
        },
      });

      sessionStorage.setItem(`paddle_txn_${code}`, transactionId);
      sessionStorage.setItem(`paddle_email_${code}`, email);
      sessionStorage.setItem(`paddle_name_${code}`, name);
      sessionStorage.setItem(`paddle_phone_${code}`, phone || "");

      await initializePaddle();
      if (!window.Paddle?.Checkout?.open) {
        throw new Error("Paddle checkout failed to load. Please refresh and try again.");
      }

      window.Paddle.Checkout.open({
        transactionId,
        customer: { email },
        settings: {
          displayMode: "overlay",
          successUrl: `${window.location.origin}/pay/${code}?status=success`,
          allowLogout: false,
        },
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to start checkout";
      setPayError(msg);
      toast.error(msg);
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Skeleton className="h-96 w-full max-w-md" />
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="p-8 max-w-md text-center">
          <h1 className="font-semibold text-lg">Link not available</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This payment link is paused or doesn't exist.
          </p>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="p-8 max-w-md text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <h1 className="font-semibold text-xl">Payment received!</h1>
          <p className="text-sm text-muted-foreground">
            {link.thank_you_message ?? "Thanks for your purchase!"}
          </p>
          {link.redirect_url && (
            <p className="text-xs text-muted-foreground">
              Redirecting you shortly…
            </p>
          )}
        </Card>
      </div>
    );
  }

  const title = link.product_title ?? link.custom_title ?? "Payment";
  const description = link.product_description ?? link.description;
  const sellerLabel = link.seller_name ?? "Seller";
  const providerLabel = provider === "stripe" ? "Stripe" : "Paddle";

  return (
    <div className="min-h-screen bg-muted/30 grid place-items-center p-4">
      <Card className="w-full max-w-md overflow-hidden">
        {link.product_image_url && (
          <img
            src={link.product_image_url}
            alt={title}
            className="w-full h-48 object-cover"
          />
        )}
        <div className="p-6 space-y-4">
          <div>
            <div className="text-xs text-muted-foreground">
              From {sellerLabel}
            </div>
            <h1 className="text-xl font-semibold mt-1">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>
                {link.currency} {Number(link.amount).toFixed(2)}
              </span>
            </div>
            {fee > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Processing fee</span>
                <span>
                  {link.currency} {fee.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1 mt-1">
              <span>Total</span>
              <span>
                {link.currency} {total.toFixed(2)}
              </span>
            </div>
          </div>

          {payError && (
            <Alert variant="destructive" className="text-xs">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{payError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={pay} className="space-y-3">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="john@example.com"
              />
            </div>
            {link.collect_phone && (
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="+1 234 567 890"
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={paying}>
              {paying ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-1" />
              )}
              Pay securely · {link.currency} {total.toFixed(2)}
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Secured by {providerLabel}
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
