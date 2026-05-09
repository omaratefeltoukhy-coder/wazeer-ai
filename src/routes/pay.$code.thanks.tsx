import { createFileRoute, useParams, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getPaymentLinkSale } from "@/lib/billing/paymentLinkSale.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ExternalLink } from "lucide-react";

const searchSchema = z.object({
  // Paddle appends `?_ptxn=txn_...` after a successful hosted-checkout payment.
  _ptxn: z.string().optional(),
  txn: z.string().optional(),
});

export const Route = createFileRoute("/pay/$code/thanks")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ThanksPage,
});

type SaleState = Awaited<ReturnType<typeof getPaymentLinkSale>>;

function ThanksPage() {
  const { code } = useParams({ from: "/pay/$code/thanks" });
  const search = useSearch({ from: "/pay/$code/thanks" });
  const transactionId = search._ptxn ?? search.txn;
  const lookup = useServerFn(getPaymentLinkSale);

  const [state, setState] = useState<SaleState | null>(null);
  const [confirming, setConfirming] = useState(true);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    let attempts = 0;
    const maxAttempts = 12; // ~24s total at 2s interval

    const tick = async () => {
      while (!cancelled.current && attempts < maxAttempts) {
        attempts++;
        try {
          const res = await lookup({ data: { code, transaction_id: transactionId } });
          if (cancelled.current) return;
          setState(res);
          // Stop polling once we have webhook confirmation.
          if (res.found && res.sale) {
            setConfirming(false);
            return;
          }
        } catch (err) {
          console.error("[pay/thanks] lookup failed", err);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled.current) setConfirming(false);
    };

    tick();
    return () => {
      cancelled.current = true;
    };
  }, [code, transactionId, lookup]);

  // Auto-redirect to seller-configured URL once confirmed.
  useEffect(() => {
    if (state?.sale && state.link?.redirect_url) {
      const url = state.link.redirect_url;
      const t = setTimeout(() => {
        window.location.href = url;
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [state]);

  if (state && !state.found) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="p-8 max-w-md text-center">
          <h1 className="font-semibold text-lg">Link not available</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This payment link is paused or doesn't exist anymore.
          </p>
        </Card>
      </div>
    );
  }

  const link = state?.link;
  const sale = state?.sale;

  return (
    <div className="min-h-screen bg-muted/30 grid place-items-center p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-4">
        {sale ? (
          <>
            <div className="mx-auto h-14 w-14 rounded-full bg-green-100 grid place-items-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Payment received</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Thanks{link?.title ? ` for purchasing ${link.title}` : ""}.
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1 text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount paid</span>
                <span className="font-medium">
                  {sale.currency} {sale.amount.toFixed(2)}
                </span>
              </div>
              {transactionId && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Receipt ID</span>
                  <span className="font-mono text-xs truncate max-w-[180px]" title={transactionId}>
                    {transactionId}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span>{new Date(sale.paid_at).toLocaleString()}</span>
              </div>
            </div>
            {link?.thank_you_message && (
              <p className="text-sm whitespace-pre-line border-t pt-4">{link.thank_you_message}</p>
            )}
            {link?.redirect_url ? (
              <Button asChild className="w-full">
                <a href={link.redirect_url}>
                  Continue <ExternalLink className="h-4 w-4 ml-1" />
                </a>
              </Button>
            ) : (
              <Button asChild variant="outline" className="w-full">
                <Link to="/">Done</Link>
              </Button>
            )}
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <div>
              <h1 className="text-xl font-semibold">
                {confirming ? "Confirming your payment…" : "Payment processing"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {confirming
                  ? "This usually takes a few seconds."
                  : "Your payment was submitted but we haven't received confirmation yet. You'll get an email receipt from Paddle once it clears."}
              </p>
            </div>
            {!confirming && (
              <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
                Check again
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
