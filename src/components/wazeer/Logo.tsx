export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-8 w-8 rounded-lg bg-brand-gradient shadow-glow grid place-items-center">
        <span className="text-primary-foreground font-bold text-sm">W</span>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-brand animate-pulse-ring" />
      </div>
      <span className="font-semibold text-lg tracking-tight">
        Wazeer
      </span>
    </div>
  );
}
