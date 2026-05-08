import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo />
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Wazeer AI. Your AI growth partner for selling online.</p>
        <div className="flex items-center gap-5 text-xs text-muted-foreground">
          <a href="mailto:privacy@wazeer.ai?subject=Privacy%20inquiry" className="hover:text-foreground">Privacy</a>
          <a href="mailto:legal@wazeer.ai?subject=Terms%20inquiry" className="hover:text-foreground">Terms</a>
          <a href="mailto:sales@wazeer.ai?subject=Wazeer%20AI%20inquiry" className="hover:text-foreground">Contact</a>
        </div>
      </div>
    </footer>
  );
}
