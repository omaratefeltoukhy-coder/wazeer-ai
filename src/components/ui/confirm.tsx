import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Imperative confirm/prompt that works inside the Lovable preview iframe
// (browser-native window.confirm/prompt are silently blocked there).

type ConfirmOpts = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};
type PromptOpts = ConfirmOpts & { label?: string; defaultValue?: string; placeholder?: string };

type ConfirmReq = ConfirmOpts & { kind: "confirm"; resolve: (v: boolean) => void };
type PromptReq = PromptOpts & { kind: "prompt"; resolve: (v: string | null) => void };
type Req = ConfirmReq | PromptReq;

let push: ((r: Req) => void) | null = null;

export function confirmDialog(opts: ConfirmOpts = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(true); // graceful: don't block actions if mount missed
    push({ kind: "confirm", resolve, ...opts });
  });
}

export function promptDialog(opts: PromptOpts = {}): Promise<string | null> {
  return new Promise((resolve) => {
    if (!push) return resolve(null);
    push({ kind: "prompt", resolve, ...opts });
  });
}

export function ConfirmRoot() {
  const [req, setReq] = useState<Req | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    push = (r) => {
      setValue(r.kind === "prompt" ? r.defaultValue ?? "" : "");
      setReq(r);
    };
    return () => { push = null; };
  }, []);

  const close = (result: boolean | string | null) => {
    if (!req) return;
    if (req.kind === "confirm") req.resolve(result === true);
    else req.resolve(result === false ? null : (result as string | null));
    setReq(null);
  };

  if (req?.kind === "confirm") {
    return (
      <AlertDialog open onOpenChange={(o) => { if (!o) close(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{req.title ?? "Are you sure?"}</AlertDialogTitle>
            {req.description && <AlertDialogDescription>{req.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>{req.cancelText ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={req.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {req.confirmText ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (req?.kind === "prompt") {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) close(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{req.title ?? "Enter a value"}</DialogTitle>
            {req.description && <DialogDescription>{req.description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-2">
            {req.label && <label className="text-sm">{req.label}</label>}
            <Input
              autoFocus
              value={value}
              placeholder={req.placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") close(value); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => close(null)}>{req.cancelText ?? "Cancel"}</Button>
            <Button onClick={() => close(value)}>{req.confirmText ?? "OK"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
