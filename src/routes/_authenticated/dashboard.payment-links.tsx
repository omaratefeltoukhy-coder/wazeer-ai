import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Copy, Link2, Check, ChevronLeft, ChevronRight, Loader2, MessageCircle, Mail, Instagram } from "lucide-react";
import { toast } from "sonner";
import { getPaddleEnvironment } from "@/lib/paddle";

export const Route = createFileRoute("/_authenticated/dashboard/payment-links")({
  component: PaymentLinksPage,
});

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "BRL", "INR", "CAD", "AUD"];

type PLink = {
  id: string;
  unique_code: string;
  custom_title: string | null;
  amount: number;
  currency: string;
  clicks: number;
  sales_count: number;
  is_active: boolean;
  product_id: string | null;
};

function PaymentLinksPage() {
  const [items, setItems] = useState<PLink[] | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("payment_links")
      .select("id,unique_code,custom_title,amount,currency,clicks,sales_count,is_active,product_id")
      .order("created_at", { ascending: false });
    setItems((data as any) ?? []);
  };

  useEffect(() => {
    load();
    supabase.from("products").select("id,title,price,currency").then(({ data }) => setProducts(data ?? []));
  }, []);

  const linkUrl = (code: string) => `${window.location.origin}/pay/${code}`;

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success("Copied!");
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("payment_links").update({ is_active: !active }).eq("id", id);
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Payment Links</h1>
            {getPaddleEnvironment() === "sandbox" ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Sandbox
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                Live
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Generate a shareable payment link in seconds.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create Link
        </Button>
      </div>

      {!items ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 grid place-items-center">
            <Link2 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold">No payment links yet</h3>
          <p className="text-sm text-muted-foreground">Create your first link to start collecting payments.</p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create Link
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3">Clicks</th>
                <th className="px-4 py-3">Sales</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => {
                const prod = products.find((p) => p.id === l.product_id);
                return (
                  <tr key={l.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{prod?.title ?? l.custom_title ?? "—"}</td>
                    <td className="px-4 py-3">{l.currency} {Number(l.amount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => copy(linkUrl(l.unique_code))} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <span className="truncate max-w-[200px]">/pay/{l.unique_code}</span>
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </td>
                    <td className="px-4 py-3">{l.clicks}</td>
                    <td className="px-4 py-3">{l.sales_count}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(l.id, l.is_active)}>
                        <Badge className={l.is_active ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"}>
                          {l.is_active ? "Active" : "Paused"}
                        </Badge>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <CreateLinkDialog open={open} onOpenChange={setOpen} products={products} onCreated={load} />
    </div>
  );
}

function CreateLinkDialog({
  open, onOpenChange, products, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; products: any[]; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState<string>("custom");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(10);
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [thankYou, setThankYou] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [passFee, setPassFee] = useState(true);
  const [collectPhone, setCollectPhone] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const reset = () => {
    setStep(1); setProductId("custom"); setTitle(""); setAmount(10); setCurrency("USD");
    setDescription(""); setThankYou(""); setRedirectUrl(""); setPassFee(true);
    setCollectPhone(false); setCreatedCode(null);
  };

  useEffect(() => {
    if (productId !== "custom") {
      const p = products.find((x) => x.id === productId);
      if (p) { setTitle(p.title); setAmount(p.price); setCurrency(p.currency); }
    }
  }, [productId, products]);

  const create = async () => {
    setCreating(true);
    try {
      const { data: ws } = await supabase.from("workspaces").select("id").limit(1).maybeSingle();
      const { data: userRes } = await supabase.auth.getUser();
      if (!ws || !userRes.user) throw new Error("Workspace not ready");
      const code = Math.random().toString(36).slice(2, 10);
      const { error } = await supabase.from("payment_links").insert({
        workspace_id: ws.id,
        user_id: userRes.user.id,
        product_id: productId === "custom" ? null : productId,
        custom_title: productId === "custom" ? title : null,
        description: description || null,
        amount,
        currency,
        thank_you_message: thankYou || null,
        redirect_url: redirectUrl || null,
        pass_fee_to_buyer: passFee,
        collect_phone: collectPhone,
        unique_code: code,
        is_active: true,
      });
      if (error) throw error;
      setCreatedCode(code);
      setStep(3);
      toast.success("Payment link created! Share it now.");
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create link. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const fullUrl = createdCode ? `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${createdCode}` : "";
  const qrUrl = createdCode ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}` : "";
  const shareMsg = `Check out this offer: ${fullUrl}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{createdCode ? "Your link is ready" : "Create payment link"}</DialogTitle>
        </DialogHeader>

        {!createdCode && (
          <div className="flex items-center gap-2 text-xs">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`h-6 w-6 rounded-full grid place-items-center text-[11px] font-medium ${
                  step > s ? "bg-primary text-primary-foreground" : step === s ? "bg-primary/20 text-primary" : "bg-muted"
                }`}>{s}</div>
                <span className={step === s ? "font-medium" : "text-muted-foreground"}>
                  {s === 1 ? "Product" : "Customize"}
                </span>
                {s < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-1" />}
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div>
              <Label>What are you selling?</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom item</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {productId === "custom" && (
              <div>
                <Label>Item name</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Coaching call" />
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label>Price</Label>
                <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <Label>Thank-you message</Label>
              <Textarea rows={2} value={thankYou} onChange={(e) => setThankYou(e.target.value)} placeholder="Thanks for your purchase!" />
            </div>
            <div>
              <Label>OR redirect URL after payment</Label>
              <Input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Pass processing fee to buyer</div>
                <div className="text-xs text-muted-foreground">Adds ~3% to the price at checkout</div>
              </div>
              <Switch checked={passFee} onCheckedChange={setPassFee} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Collect phone number</div>
                <div className="text-xs text-muted-foreground">Ask for phone at checkout</div>
              </div>
              <Switch checked={collectPhone} onCheckedChange={setCollectPhone} />
            </div>
          </div>
        )}

        {createdCode && (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 flex items-center gap-2">
              <Input readOnly value={fullUrl} className="flex-1" />
              <Button size="sm" onClick={() => { navigator.clipboard.writeText(fullUrl); toast.success("Copied!"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid place-items-center">
              <img src={qrUrl} alt="QR code" className="rounded border" width={200} height={200} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Share via</div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://wa.me/?text=${encodeURIComponent(shareMsg)}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://www.instagram.com/direct/new/?text=${encodeURIComponent(shareMsg)}`} target="_blank" rel="noreferrer">
                    <Instagram className="h-4 w-4 mr-1" /> Instagram
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`mailto:?subject=Payment%20link&body=${encodeURIComponent(shareMsg)}`}>
                    <Mail className="h-4 w-4 mr-1" /> Email
                  </a>
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={() => { onOpenChange(false); reset(); }}>
              <Check className="h-4 w-4 mr-1" /> Done
            </Button>
          </div>
        )}

        {!createdCode && (
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 1}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            {step < 2 ? (
              <Button onClick={() => setStep(step + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={create} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Generate link
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
