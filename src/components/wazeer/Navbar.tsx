import { Logo } from "@/components/wazeer/Logo";
import { Button } from "@/components/ui/button";
import { Link, useRouterState } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const links = [
  { to: "/features", label: "Features" },
  { to: "/use-cases", label: "Use cases" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mt-4 flex items-center justify-between rounded-2xl glass border px-4 py-2.5 shadow-soft">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="hover:text-foreground transition-colors"
                activeProps={{ className: "text-foreground font-medium" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="bg-foreground text-background hover:opacity-90">
              <Link to="/signup">Start selling with AI</Link>
            </Button>
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <div className="flex h-full flex-col p-6">
                <div className="flex items-center justify-between">
                  <Logo />
                  <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close menu">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <nav className="mt-8 flex flex-col gap-4 text-sm text-muted-foreground">
                  {links.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setOpen(false)}
                      className="hover:text-foreground transition-colors"
                      activeProps={{ className: "text-foreground font-medium" }}
                    >
                      {l.label}
                    </Link>
                  ))}
                  {isHome && (
                    <>
                      <a href="#how" onClick={() => setOpen(false)} className="hover:text-foreground transition-colors">
                        How it works
                      </a>
                      <a href="#features" onClick={() => setOpen(false)} className="hover:text-foreground transition-colors">
                        Features
                      </a>
                      <a href="#pricing" onClick={() => setOpen(false)} className="hover:text-foreground transition-colors">
                        Pricing
                      </a>
                      <a href="#faq" onClick={() => setOpen(false)} className="hover:text-foreground transition-colors">
                        FAQ
                      </a>
                    </>
                  )}
                </nav>
                <div className="mt-auto flex flex-col gap-3">
                  <Button asChild variant="outline" onClick={() => setOpen(false)}>
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button asChild className="bg-foreground text-background hover:opacity-90" onClick={() => setOpen(false)}>
                    <Link to="/signup">Start selling with AI</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
