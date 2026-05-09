import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  PRODUCT_TYPES, productTypeMeta, type ProductRow, type ProductStatus, type ProductType,
} from "@/lib/products/types";
import { Plus, Package, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  filter: z.enum(["all", "published", "draft"]).optional().default("all"),
});

export const Route = createFileRoute("/_authenticated/dashboard/products/")({
  validateSearch: zodValidator(searchSchema),
  component: ProductsListPage,
});

const TABS: { id: "all" | "published" | "draft"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Draft" },
];

function ProductsListPage() {
  const { filter } = Route.useSearch();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = async () => {
    setError(null);
    setRows(null);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data as unknown as ProductRow[]) ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[products] load failed", e);
      setError(msg);
      setRows([]);
      toast.error("Couldn't load products. Tap retry to try again.");
    }
  };
  useEffect(() => { void load(); }, []);

  const filtered = (rows ?? []).filter((r) => filter === "all" ? true : r.status === filter);

  const startCreate = (typeId?: string) => {
    setPickerOpen(false);
    navigate({ to: "/dashboard/products/new", search: typeId ? { type: typeId as ProductType } : {} });
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-6xl">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1 text-sm">Everything you sell, in one place.</p>
        </div>
        <Button onClick={() => setPickerOpen(true)} className="bg-brand-gradient text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> Create product
        </Button>
      </header>

      <div className="flex items-center gap-1 border-b">
        {TABS.map((t) => {
          const active = filter === t.id;
          const count = (rows ?? []).filter((r) => t.id === "all" ? true : r.status === t.id).length;
          return (
            <Link
              key={t.id}
              to="/dashboard/products"
              search={{ filter: t.id }}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label} {rows && <span className="ml-1 text-xs text-muted-foreground">({count})</span>}
            </Link>
          );
        })}
      </div>

      {rows === null ? (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : error && filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /> Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setPickerOpen(true)} hasAny={(rows ?? []).length > 0} />
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Type</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Price</th>
                <th className="text-right p-3 font-medium hidden md:table-cell">Sales</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const meta = productTypeMeta(p.type);
                return (
                  <tr key={p.id} className="border-t hover:bg-secondary/30 cursor-pointer" onClick={() => navigate({ to: "/dashboard/products/$productId", params: { productId: p.id } })}>
                    <td className="p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {p.cover_image_url ? (
                          <img src={p.cover_image_url} alt="" className="h-10 w-10 rounded-md object-cover bg-secondary shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-secondary grid place-items-center shrink-0"><meta.icon className="h-4 w-4 text-muted-foreground" /></div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.title}</div>
                          {p.description && <div className="text-xs text-muted-foreground truncate max-w-sm">{p.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell"><span className="text-xs text-muted-foreground">{meta.emoji} {meta.label}</span></td>
                    <td className="p-3"><StatusBadge status={p.status} /></td>
                    <td className="p-3 text-right whitespace-nowrap">{Number(p.price) === 0 ? <span className="text-muted-foreground">Free</span> : `${p.currency} ${Number(p.price).toFixed(2)}`}</td>
                    <td className="p-3 text-right hidden md:table-cell">{p.sales_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>What are you selling?</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {PRODUCT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => startCreate(t.id)}
                className="rounded-xl border bg-card p-4 text-left hover:border-foreground hover:shadow-soft transition-all"
              >
                <div className="text-2xl">{t.emoji}</div>
                <div className="text-sm font-medium mt-2">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>
              </button>
            ))}
          </div>
          <div className="border-t pt-4 mt-2 flex justify-center">
            <Button variant="outline" onClick={() => startCreate()}>
              <Sparkles className="h-4 w-4" /> Generate with AI
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: ProductStatus }) {
  const styles: Record<ProductStatus, string> = {
    published: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    draft: "bg-secondary text-muted-foreground",
    archived: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={`capitalize ${styles[status]}`}>{status}</Badge>;
}

function EmptyState({ onCreate, hasAny }: { onCreate: () => void; hasAny: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-12 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-gradient grid place-items-center mb-4 shadow-glow">
        <Package className="h-6 w-6 text-primary-foreground" />
      </div>
      <h3 className="font-semibold text-lg">{hasAny ? "Nothing here yet" : "No products yet"}</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-5 max-w-md mx-auto">
        {hasAny ? "Try a different filter or create a new product." : "Add your first offer to start selling. You can publish it anytime."}
      </p>
      <Button onClick={onCreate} className="bg-brand-gradient text-primary-foreground shadow-glow">
        Create your first product →
      </Button>
    </div>
  );
}
