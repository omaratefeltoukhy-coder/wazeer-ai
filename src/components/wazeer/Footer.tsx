import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <Logo />
            <p className="mt-3 text-xs text-muted-foreground max-w-xs">
              Your AI growth partner for selling online. Create, launch, and grow — all in one place.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Product</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/features" className="hover:text-foreground">Features</Link>
              <Link to="/use-cases" className="hover:text-foreground">Use cases</Link>
              <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
              <Link to="/faq" className="hover:text-foreground">FAQ</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Company</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/about" className="hover:text-foreground">About</Link>
              <Link to="/contact" className="hover:text-foreground">Contact</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Legal</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground">Terms</Link>
              <Link to="/refunds" className="hover:text-foreground">Refunds</Link>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Wazeer. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <a href="mailto:sales@wazeer.io?subject=Wazeer%20inquiry" className="hover:text-foreground">sales@wazeer.io</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
