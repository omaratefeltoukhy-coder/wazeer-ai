import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Plus, ShoppingBag, TrendingUp, Users, DollarSign, Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

type Business = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  created_at: string;
};

const kpis = [
  { label: "Revenue", value: "$0", icon: DollarSign, hint: "Connect payments" },
  { label: "Orders", value: "0", icon: ShoppingBag, hint: "No sales yet" },
  { label: "Customers", value: "0", icon: Users, hint: "Add contacts" },
  { label: "ROAS", value: "—", icon: TrendingUp, hint: "Launch your first ad" },
];

function DashboardHome() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[] | null>(null);

  useEffect(() => {
    supabase
      .from("businesses")
      .select("id, name, type, description, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setBusinesses((data as Business[]) ?? []));
  }, []);

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">Your AI-powered business HQ.</p>
        </div>
        <Link to="/dashboard/new">
          <Button className="bg-brand-gradient text-primary-foreground shadow-glow">
            <Plus className="h-4 w-4" /> New business
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{k.label}</span>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-semibold">{k.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{k.hint}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Your businesses</h2>
        {businesses === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : businesses.length === 0 ? (
          <div className="rounded-2xl border bg-card p-10 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center mb-4">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="font-medium">Create your first business</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
              Upload a photo or describe your offer. Wazeer AI will generate everything you need to start selling.
            </p>
            <Link to="/dashboard/new">
              <Button className="bg-brand-gradient text-primary-foreground"><Plus className="h-4 w-4" /> Generate my business</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => (
              <Link key={b.id} to="/dashboard/storefront/$businessId" params={{ businessId: b.id }} className="rounded-2xl border bg-card p-5 hover:shadow-elevated transition-shadow">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{b.type}</div>
                <div className="mt-1 font-semibold">{b.name}</div>
                {b.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{b.description}</p>}
                <div className="mt-3 text-xs text-muted-foreground">Edit storefront →</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
