import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Check, Minus } from "lucide-react";
import { getDb, schema } from "@/db";
import { PublicFooter, PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { formatPen, withIgv } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Planes y precios" };

const lim = (n: number, unit: string) => (n === -1 ? `${unit} ilimitados` : `Hasta ${n.toLocaleString("es-PE")} ${unit}`);

export default async function PricingPage() {
  const db = await getDb();
  const plans = await db.select().from(schema.plans).where(eq(schema.plans.active, true)).orderBy(asc(schema.plans.sortOrder));

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold sm:text-5xl">Planes para cada etapa de tu campaña</h1>
          <p className="mt-4 text-lg text-muted-foreground">Empieza con un piloto de 14 días sin cobro. Precios mensuales en soles; el IGV (18 %) se suma en la factura.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((p) => {
            const e = p.entitlements;
            const features: [string, boolean][] = [
              [lim(e.maxFarms, "fundos"), true],
              [e.maxHectares === -1 ? "Hectáreas ilimitadas" : `Hasta ${e.maxHectares.toLocaleString("es-PE")} ha`, true],
              [lim(e.maxUsers, "usuarios"), true],
              [e.maxSimulationsPerMonth === -1 ? "Simulaciones ilimitadas" : `${e.maxSimulationsPerMonth} simulaciones al mes`, true],
              ["Alertas y registro de decisiones", true],
              ["Comparador de escenarios", e.scenarioCompare],
              ["Monitor y simulación de cadena de frío", e.coldChain],
              ["SSO corporativo (OIDC)", true],
            ];
            return (
              <article
                key={p.id}
                className={cn(
                  "relative flex flex-col rounded-2xl bg-card p-6 ring-1 ring-foreground/10",
                  p.highlighted && "bg-sidebar text-sidebar-foreground ring-2 ring-sidebar-primary",
                )}
              >
                {p.highlighted && (
                  <span className="absolute -top-3 left-6 rounded-full bg-sidebar-primary px-3 py-0.5 text-xs font-semibold text-sidebar-primary-foreground">Más completo</span>
                )}
                <h2 className={cn("text-2xl font-semibold", p.highlighted && "text-white")}>{p.name}</h2>
                <p className={cn("mt-2 min-h-12 text-sm", p.highlighted ? "text-sidebar-foreground/80" : "text-muted-foreground")}>{p.description}</p>
                <p className="mt-6">
                  <span className={cn("font-[family-name:var(--font-display)] text-4xl font-semibold", p.highlighted && "text-white")}>{formatPen(p.priceCents)}</span>
                  <span className="text-sm opacity-70"> / mes</span>
                </p>
                <p className="text-xs opacity-70">{formatPen(withIgv(p.priceCents).totalCents)} con IGV</p>
                <ul className="mt-6 grid gap-2.5 text-sm">
                  {features.map(([label, on]) => (
                    <li key={label} className={cn("flex items-start gap-2", !on && "opacity-50")}>
                      {on ? <Check className={cn("mt-0.5 size-4 shrink-0", p.highlighted ? "text-sidebar-primary" : "text-primary")} /> : <Minus className="mt-0.5 size-4 shrink-0" />}
                      <span>
                        {label}
                        {!on && <span className="sr-only"> (no incluido)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-8 h-10"
                  variant={p.highlighted ? "secondary" : "default"}
                  render={<Link href={`/register?plan=${p.code}`} />}
                  nativeButton={false}
                >
                  Empezar con {p.name}
                </Button>
              </article>
            );
          })}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          Precios y límites de ejemplo para el MVP, a validar con la gremial y empresas entrevistadas. Pagos con tarjeta o Yape (pasarela simulada en la demo).
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
