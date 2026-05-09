import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Search, ExternalLink, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/orders")({
  component: OrdersPage,
});

type Order = {
  id: string;
  amount: number;
  currency: string | null;
  payment_status: string | null;
  source: string | null;
  created_at: string;
  business_id: string;
  offer_id: string | null;
  customer_id: string | null;
  businesses: { name: string } | null;
  offers: { name: string } | null;
  contacts: { name: string | null; email: string | null } | null;
};

function fmtMoney(n: number, currency: string | null) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(n);
}

function statusBadge(status: string | null) {
  switch (status) {
    case "paid":
    case "completed":
      return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">Paid</Badge>;
    case "pending":
      return <Badge variant="outline" className="text-amber-600 border-amber-300">Pending</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "refunded":
      return <Badge variant="secondary">Refunded</Badge>;
    default:
      return <Badge variant="outline">{status || "Unknown"}</Badge>;
  }
}

function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filtered, setFiltered] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, amount, currency, payment_status, source, created_at, business_id, offer_id, customer_id,
          businesses ( name ),
          offers ( name ),
          contacts ( name, email )
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        toast.error(error.message);
        setOrders([]);
        return;
      }
      const rows = (data ?? []) as unknown as Order[];
      setOrders(rows);
      setFiltered(rows);
    })();
  }, []);

  useEffect(() => {
    if (!orders) return;
    let out = orders;
    if (statusFilter !== "all") {
      out = out.filter((o) => o.payment_status === statusFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      out = out.filter(
        (o) =>
          o.businesses?.name?.toLowerCase().includes(s) ||
          o.offers?.name?.toLowerCase().includes(s) ||
          o.contacts?.name?.toLowerCase().includes(s) ||
          o.contacts?.email?.toLowerCase().includes(s) ||
          o.id.toLowerCase().includes(s)
      );
    }
    setFiltered(out);
  }, [search, statusFilter, orders]);

  const totalRevenue = (orders ?? []).filter((o) => o.payment_status === "paid" || o.payment_status === "completed").reduce((sum, o) => sum + (o.amount || 0), 0);
  const totalOrders = (orders ?? []).length;
  const paidOrders = (orders ?? []).filter((o) => o.payment_status === "paid" || o.payment_status === "completed").length;

  if (orders === null) {
    return (
      <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-60" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const statuses = ["all", "paid", "pending", "failed", "refunded"];

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">Track every sale across your businesses.</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total revenue</div>
          <div className="mt-2 text-2xl font-semibold">{fmtMoney(totalRevenue, "USD")}</div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total orders</div>
          <div className="mt-2 text-2xl font-semibold">{totalOrders}</div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Paid orders</div>
          <div className="mt-2 text-2xl font-semibold">{paidOrders}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by business, product, customer..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {statuses.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? "bg-brand-gradient text-primary-foreground" : ""}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium">No orders yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {orders.length === 0
              ? "Share your storefront or payment link to start making sales."
              : "No orders match your filters."}
          </p>
          {orders.length === 0 && (
            <div className="mt-4 flex justify-center gap-3">
              <Link to="/dashboard/storefront">
                <Button variant="outline" size="sm">View storefronts</Button>
              </Link>
              <Link to="/dashboard/payment-links">
                <Button size="sm" className="bg-brand-gradient text-primary-foreground">Create payment link</Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Order</th>
                  <th className="text-left p-3">Business</th>
                  <th className="text-left p-3">Product</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-3 font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</td>
                    <td className="p-3">{o.businesses?.name || "—"}</td>
                    <td className="p-3">{o.offers?.name || "—"}</td>
                    <td className="p-3">
                      {o.contacts ? (
                        <div>
                          <div className="text-sm">{o.contacts.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{o.contacts.email || "—"}</div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">{statusBadge(o.payment_status)}</td>
                    <td className="p-3 text-right font-medium">{fmtMoney(o.amount, o.currency)}</td>
                    <td className="p-3 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className="text-xs text-muted-foreground capitalize">{o.source || "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
