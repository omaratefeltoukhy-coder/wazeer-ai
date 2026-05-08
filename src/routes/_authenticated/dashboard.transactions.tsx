import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatMoney, getWorkspaceCurrency } from "@/lib/money/format";
import { Download, RefreshCw, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/transactions")({
  component: TransactionsPage,
});

type Tx = {
  id: string;
  product_id: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const PAGE_SIZE = 20;

function TransactionsPage() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Tx[] | null>(null);
  const [products, setProducts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");

  const load = async () => {
    setError(null);
    setRows(null);
    try {
      const cur = await getWorkspaceCurrency(supabase);
      setCurrency(cur);
      let query = supabase.from("transactions").select("*").order("created_at", { ascending: false });
      if (filter === "month") {
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        query = query.gte("created_at", start.toISOString());
      } else if (filter === "custom") {
        if (from) query = query.gte("created_at", new Date(from).toISOString());
        if (to) {
          const end = new Date(to);
          end.setHours(23, 59, 59, 999);
          query = query.lte("created_at", end.toISOString());
        }
      }
      const [{ data, error: e1 }, { data: prods }] = await Promise.all([
        query,
        supabase.from("products").select("id, title"),
      ]);
      if (e1) throw e1;
      setRows((data as Tx[]) ?? []);
      const map: Record<string, string> = {};
      for (const p of (prods as { id: string; title: string }[]) ?? []) map[p.id] = p.title;
      setProducts(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transactions");
      setRows([]);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, from, to]);
  useEffect(() => { setPage(1); }, [filter, from, to, q]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.buyer_name, r.buyer_email, products[r.product_id ?? ""], r.status]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [rows, q, products]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    const header = ["Date", "Product", "Buyer", "Email", "Amount", "Currency", "Status"];
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [header.join(",")].concat(
      filtered.map((r) =>
        [
          new Date(r.created_at).toISOString(),
          products[r.product_id ?? ""] ?? "",
          r.buyer_name ?? "",
          r.buyer_email ?? "",
          r.amount,
          r.currency,
          r.status,
        ].map(escape).join(","),
      ),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `transactions-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Button onClick={exportCsv} variant="outline" size="sm" disabled={!rows || rows.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border p-1 bg-card">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs rounded-md ${filter === f.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filter === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            <span className="text-muted-foreground text-sm">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by buyer, email, product..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-muted-foreground">Unable to load transactions. Try again.</p>
              <Button onClick={load} variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-2" /> Retry</Button>
            </div>
          ) : rows === null ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No transactions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">Buyer</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-3">{products[r.product_id ?? ""] ?? "—"}</td>
                      <td className="p-3">{r.buyer_name ?? "—"}</td>
                      <td className="p-3">{r.buyer_email ?? "—"}</td>
                      <td className="p-3">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right font-medium">{formatMoney(Number(r.amount), r.currency || currency)}</td>
                      <td className="p-3">
                        <Badge variant={r.status === "refunded" ? "destructive" : "secondary"}>
                          {r.status === "refunded" ? "Refunded" : "Completed"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
