import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted-foreground [&_svg]:size-9">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        {icon && <span className="[&_svg]:size-4">{icon}</span>}
      </div>
      <div
        className={cn(
          "mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums",
          tone === "good" && "text-success",
          tone === "warn" && "text-[oklch(0.55_0.13_65)]",
          tone === "bad" && "text-critical",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const SEVERITY_STYLES = {
  critica: "bg-critical/10 text-critical border-critical/30",
  alta: "bg-warning/15 text-[oklch(0.45_0.11_60)] border-warning/40",
  media: "bg-chart-4/10 text-chart-4 border-chart-4/30",
  baja: "bg-muted text-muted-foreground border-border",
} as const;

const SEVERITY_LABELS = { critica: "Crítica", alta: "Alta", media: "Media", baja: "Baja" } as const;

export function SeverityBadge({ level }: { level: keyof typeof SEVERITY_STYLES }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", SEVERITY_STYLES[level])}>
      {SEVERITY_LABELS[level]}
    </span>
  );
}

export function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "info" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "good" && "bg-success/10 text-success",
        tone === "warn" && "bg-warning/15 text-[oklch(0.45_0.11_60)]",
        tone === "bad" && "bg-critical/10 text-critical",
        tone === "info" && "bg-chart-4/10 text-chart-4",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}
