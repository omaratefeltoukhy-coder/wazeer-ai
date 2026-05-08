import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { productTypeMeta, type ProductRow, type ProductStatus } from "@/lib/products/types";
import { ArrowLeft, Loader2, Trash2, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/products/$productId")({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Product not found");
      setProduct(data as unknown as ProductRow);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [productId]);

  const update = (patch: Partial<ProductRow>) => setProduct((p) => (p ? { ...p, ...patch } : p));

  const save = async () => {
    if (!product) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("products").update({
        title: product.title,
        description: product.description,
        price: Number(product.price) || 0,
        currency: product.currency,
        status: product.status,
        cover_image_url: product.cover_image_url,
      }).eq("id", product.id);
      if (error) throw error;
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!product) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) throw error;
      toast.success("Product deleted");
      navigate({ to: "/dashboard/products" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
      setDeleting(false);
    }
  };

  const copyShare = async () => {
    if (!product) return;
    const url = `${window.location.origin}/dashboard/products/${product.id}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto text-center space-y-4">
        <p className="text-sm text-muted-foreground">{error ?? "Product not available"}</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /> Retry</Button>
          <Link to="/dashboard/products"><Button variant="ghost">Back to products</Button></Link>
        </div>
      </div>
    );
  }

  const meta = productTypeMeta(product.type);
  const revenue = Number(product.revenue_total ?? 0);

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <Link to="/dashboard/products" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to products
      </Link>

      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{meta.emoji} {meta.label}</div>
          <h1 className="text-2xl font-semibold truncate mt-1">{product.title || "Untitled"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyShare}><Copy className="h-4 w-4" /> Copy link</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /> Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes "{product.title}" and any sales records linked to it. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={remove} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-xs text-muted-foreground">Units sold</div>
          <div className="mt-1 text-2xl font-semibold">{product.sales_count.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-xs text-muted-foreground">Revenue</div>
          <div className="mt-1 text-2xl font-semibold">{product.currency} {revenue.toFixed(2)}</div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-4">
        {product.cover_image_url && (
          <img src={product.cover_image_url} alt="" className="h-40 w-full object-cover rounded-lg border" />
        )}
        <div>
          <Label>Title</Label>
          <Input className="mt-1.5" value={product.title} onChange={(e) => update({ title: e.target.value })} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea className="mt-1.5" rows={4} value={product.description ?? ""} onChange={(e) => update({ description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Price</Label>
            <Input className="mt-1.5" type="number" min="0" step="0.01" value={product.price} onChange={(e) => update({ price: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Currency</Label>
            <Input className="mt-1.5" value={product.currency} onChange={(e) => update({ currency: e.target.value.toUpperCase() })} maxLength={3} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">Published</div>
            <div className="text-xs text-muted-foreground">Visible on your storefront when on.</div>
          </div>
          <Switch
            checked={product.status === "published"}
            onCheckedChange={(v) => update({ status: (v ? "published" : "draft") as ProductStatus })}
          />
        </div>
      </section>

      <div className="flex items-center justify-between">
        {product.cover_image_url ? (
          <a href={product.cover_image_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            View cover <ExternalLink className="h-3 w-3" />
          </a>
        ) : <span />}
        <Button onClick={save} disabled={saving} className="bg-brand-gradient text-primary-foreground shadow-glow">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
