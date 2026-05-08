import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo />
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Wazeer AI. Your AI growth partner for selling online.</p>
        <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/refunds" className="hover:text-foreground">Refunds</Link>
          <a href="mailto:sales@wazeer.ai?subject=Wazeer%20AI%20inquiry" className="hover:text-foreground">Contact</a>
        </div>
      </div>
    </footer>
  );
}

