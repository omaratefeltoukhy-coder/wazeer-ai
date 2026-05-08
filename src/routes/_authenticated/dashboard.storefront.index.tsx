import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/storefront/")({
  component: StorefrontIndex,
});

function StorefrontIndex() {
  const navigate = useNavigate();
  const [items, setItems] = useState<{ id: string; name: string; type: string }[] | null>(null);

  useEffect(() => {
    supabase
      .from("businesses")
      .select("id, name, type, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as { id: string; name: string; type: string }[];
        setItems(list);
        if (list.length === 1) {
          navigate({ to: "/dashboard/storefront/$businessId", params: { businessId: list[0].id }, replace: true });
        }
      });
  }, [navigate]);

  if (items === null) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Storefronts</h1>
        <p className="text-muted-foreground mt-1">Pick a business to edit its storefront.</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center mb-3">
            <ShoppingBag className="h-5 w-5 text-primary-foreground" />
          </div>
          <h3 className="font-medium">No storefront yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first business and Wazeer AI will generate a storefront.</p>
          <Link to="/dashboard/new"><Button className="bg-brand-gradient text-primary-foreground"><Plus className="h-4 w-4" /> Create business</Button></Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((b) => (
            <Link key={b.id} to="/dashboard/storefront/$businessId" params={{ businessId: b.id }} className="rounded-2xl border bg-card p-5 hover:shadow-elevated transition-shadow">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{b.type}</div>
              <div className="mt-1 font-semibold">{b.name}</div>
              <div className="mt-3 text-sm text-muted-foreground">Edit storefront →</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}