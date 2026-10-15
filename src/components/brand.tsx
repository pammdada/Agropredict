import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/", inverted = false }: { className?: string; href?: string; inverted?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold", className)} aria-label="AgroPredic, inicio">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="9" className={inverted ? "fill-sidebar-primary" : "fill-primary"} />
        <path d="M9 22c0-7 5-12 14-12-1 8-5 13-12 13" fill="none" strokeWidth="2.2" strokeLinecap="round" className={inverted ? "stroke-sidebar" : "stroke-primary-foreground"} />
        <path d="M11 21l5-5" strokeWidth="2.2" strokeLinecap="round" className={inverted ? "stroke-sidebar" : "stroke-primary-foreground"} />
      </svg>
      <span className="font-[family-name:var(--font-display)] text-lg tracking-tight">
        Agro<span className={inverted ? "text-sidebar-primary" : "text-primary"}>Predic</span>
      </span>
    </Link>
  );
}

/** Mandatory label on every output of the demo simulation engine. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-[oklch(0.45_0.1_65)]",
        className,
      )}
      title="Resultados generados por el motor demo v0: deterministas y parametrizados, no por un modelo entrenado."
    >
      <FlaskConical className="size-3" aria-hidden />
      Datos demo
    </span>
  );
}
