import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/email")({
  component: EmailLayout,
});

function EmailLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/dashboard/email/campaigns", label: "Campaigns" },
    { to: "/dashboard/email/automations", label: "Automations" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email Marketing</h1>
        <p className="text-muted-foreground mt-1">Send campaigns and automate lifecycle emails.</p>
      </div>
      <div className="border-b">
        <nav className="flex gap-1">
          {tabs.map((t) => {
            const active = path.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
