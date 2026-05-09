import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route for /pay/$code — renders nested children (the form at index,
// and the thank-you confirmation at /pay/$code/thanks).
export const Route = createFileRoute("/pay/$code")({
  component: () => <Outlet />,
});
