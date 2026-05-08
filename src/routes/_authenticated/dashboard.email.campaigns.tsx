import { createFileRoute } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/email/campaigns")({
  component: () => <Outlet />,
});
