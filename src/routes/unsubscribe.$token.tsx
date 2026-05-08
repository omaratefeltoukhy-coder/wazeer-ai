import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { validateUnsubscribeToken, confirmUnsubscribe } from "@/lib/ai/email.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Mail, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/unsubscribe/$token")({
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = Route.useParams();
  const validate = useServerFn(validateUnsubscribeToken);
  const confirm = useServerFn(confirmUnsubscribe);
  const [state, setState] = useState<"loading" | "valid" | "used" | "invalid" | "done" | "submitting">("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    validate({ data: { token } }).then((r: any) => {
      if (!r.valid) return setState("invalid");
      setEmail(r.email);
      setState(r.used ? "used" : "valid");
    }).catch(() => setState("invalid"));
  }, [token]);

  async function handleConfirm() {
    setState("submitting");
    try { await confirm({ data: { token } }); setState("done"); toast.success("Unsubscribed"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); setState("valid"); }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center">
          <Mail className="h-5 w-5 text-primary-foreground" />
        </div>
        {state === "loading" && <Skeleton className="h-6 w-2/3 mx-auto" />}
        {state === "invalid" && (<><XCircle className="h-6 w-6 mx-auto text-destructive" /><h1 className="text-xl font-semibold">Invalid link</h1><p className="text-sm text-muted-foreground">This unsubscribe link is no longer valid.</p></>)}
        {state === "used" && (<><CheckCircle2 className="h-6 w-6 mx-auto text-emerald-500" /><h1 className="text-xl font-semibold">Already unsubscribed</h1><p className="text-sm text-muted-foreground">{email} won't receive further emails.</p></>)}
        {(state === "valid" || state === "submitting") && (
          <>
            <h1 className="text-xl font-semibold">Unsubscribe?</h1>
            <p className="text-sm text-muted-foreground">{email} will stop receiving emails.</p>
            <Button onClick={handleConfirm} disabled={state === "submitting"} className="w-full bg-brand-gradient text-primary-foreground">
              {state === "submitting" ? "Unsubscribing…" : "Confirm unsubscribe"}
            </Button>
          </>
        )}
        {state === "done" && (<><CheckCircle2 className="h-6 w-6 mx-auto text-emerald-500" /><h1 className="text-xl font-semibold">You're unsubscribed</h1><p className="text-sm text-muted-foreground">{email} has been added to the suppression list.</p></>)}
      </div>
    </div>
  );
}
