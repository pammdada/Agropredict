import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, Plus } from "lucide-react";
import { DemoBadge } from "@/components/brand";
import { EmptyState, PageHeader } from "@/components/page";
import { SimulationsTable } from "@/components/simulations-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/context";
import { getUsage } from "@/lib/billing/entitlements";
import { listSimulations } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Simulaciones" };

const FILTERS = [
  { key: "all", label: "Todas" },
  { key: "YIELD", label: "Rendimiento" },
  { key: "COLD_CHAIN", label: "Cadena de frío" },
] as const;

export default async function SimulationsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const ctx = await requireOrgContext("simulation:read");
  const { type = "all" } = await searchParams;
  const [all, usage] = await Promise.all([listSimulations(ctx.org.id), getUsage(ctx.org.id)]);
  const rows = type === "all" ? all : all.filter((r) => r.sim.type === type);
  const limit = ctx.entitlements.maxSimulationsPerMonth;

  return (
    <>
      <PageHeader
        title="Simulaciones"
        description={`${usage.simulationsThisMonth} simulaciones este mes${limit === -1 ? " · ilimitadas en tu plan" : ` de ${limit} incluidas en tu plan`}.`}
        actions={
          <>
            <DemoBadge />
            {ctx.can("simulation:run") && (
              <Button render={<Link href="/app/simulations/new" />} nativeButton={false}>
                <Plus /> Nueva simulación
              </Button>
            )}
          </>
        }
      />
      <nav className="mb-4 flex gap-1" aria-label="Filtrar por tipo">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/app/simulations" : `/app/simulations?type=${f.key}`}
            aria-current={type === f.key ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition",
              type === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {all.length === 0 ? (
        <EmptyState
          icon={<FlaskConical />}
          title="Corre tu primera simulación"
          description="Elige un fundo y un escenario climático: en menos de un minuto tendrás el rango de resultados y una acción recomendada."
          action={ctx.can("simulation:run") && <Button render={<Link href="/app/simulations/new" />} nativeButton={false}>Nueva simulación</Button>}
        />
      ) : (
        <Card>
          <CardContent>
            <SimulationsTable rows={rows} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
