import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/contacts")({
  component: ContactsList,
});

type Biz = { id: string; name: string };

function ContactsList() {
  const [businesses, setBusinesses] = useState<Biz[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data: bz } = await supabase.from("businesses").select("id, name").order("created_at", { ascending: false });
      setBusinesses((bz as Biz[]) ?? []);
      const { data: cs } = await supabase.from("contacts").select("business_id");
      const map: Record<string, number> = {};
      for (const c of cs ?? []) map[c.business_id] = (map[c.business_id] ?? 0) + 1;
      setCounts(map);
    })();
  }, []);

  if (businesses === null) {
    return <div className="p-6 max-w-7xl mx-auto space-y-4"><Skeleton className="h-10 w-60" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2].map(i=><Skeleton key={i} className="h-24 rounded-2xl" />)}</div></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Contacts &amp; CRM</h1>
        <p className="text-sm text-muted-foreground mt-1">Leads, customers, tags, and lifetime value across your businesses.</p>
      </div>

      {businesses.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center mb-3"><Users className="h-5 w-5 text-primary-foreground" /></div>
          <h3 className="font-medium">Create a business first</h3>
          <Link to="/dashboard/new" className="inline-flex items-center gap-2 mt-4 rounded-lg bg-brand-gradient text-primary-foreground px-3 py-2 text-sm font-medium shadow-glow"><Plus className="h-4 w-4" /> New business</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Link key={b.id} to="/dashboard/contacts/$businessId" params={{ businessId: b.id }}
              className="rounded-2xl border bg-card p-4 hover:bg-secondary/40 transition-colors flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-muted-foreground">{counts[b.id] ?? 0} contacts</div>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
