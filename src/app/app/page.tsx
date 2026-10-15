import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { ArrowRight, Bell, ClipboardCheck, FlaskConical, PartyPopper, ShieldAlert, Sprout } from "lucide-react";
import { getDb, schema } from "@/db";
import { DemoBadge } from "@/components/brand";
import { RiskBars } from "@/components/charts/risk-bars";
import { EmptyState, PageHeader, SeverityBadge, StatCard } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/context";
import { getUsage } from "@/lib/billing/entitlements";
import { fmtDate, fmtNum, relativeTime } from "@/lib/format";
import { listFarms, listSimulations } from "@/lib/queries";
import { CLIMATE_LABELS, type SimulationInput, type SimulationResult } from "@/lib/simulation/contract";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string; denied?: string }> }) {
  const ctx = await requireOrgContext("dashboard:read");
  const sp = await searchParams;
  const db = await getDb();
  const [usage, farms, sims, openAlerts, activeDecisions] = await Promise.all([
    getUsage(ctx.org.id),
    listFarms(ctx.org.id),
    listSimulations(ctx.org.id, { limit: 100 }),
    db
      .select()
      .from(schema.alerts)
      .where(and(eq(schema.alerts.orgId, ctx.org.id), eq(schema.alerts.status, "open")))
      .orderBy(desc(schema.alerts.createdAt)),
    db
      .select()
      .from(schema.decisions)
      .where(and(eq(schema.decisions.orgId, ctx.org.id), isNull(schema.decisions.deletedAt), inArray(schema.decisions.status, ["planned", "in_progress"])))
      .orderBy(desc(schema.decisions.createdAt)),
  ]);

  const latestYield = new Map<string, { r: SimulationResult; input: SimulationInput }>();
  for (const { sim } of sims) {
    if (sim.type === "YIELD" && !latestYield.has(sim.farmId)) latestYield.set(sim.farmId, { r: sim.result as SimulationResult, input: sim.input as SimulationInput });
  }
  const risk = farms
    .filter(({ farm }) => latestYield.has(farm.id))
    .map(({ farm }) => {
      const { r, input } = latestYield.get(farm.id)!;
      return { farm: farm.name.replace(/^Fundo /, ""), delta: r.scenarios[1].deltaPct, scenario: CLIMATE_LABELS[input.climate] };
    })
    .sort((a, b) => a.delta - b.delta);
  const critical = openAlerts.filter((a) => a.severity === "critica").length;
  const overdue = activeDecisions.filter((d) => d.dueDate && d.dueDate.getTime() < Date.now()).length;
  const simLimit = ctx.entitlements.maxSimulationsPerMonth;

  return (
    <>
      {sp.welcome && (
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-secondary p-4 text-sm">
          <PartyPopper className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="font-semibold">¡Bienvenido a AgroPredic! Tu prueba de 14 días está activa.</p>
            <p className="text-muted-foreground">Registra tu primer fundo y corre una simulación: toma menos de 2 minutos.</p>
          </div>
        </div>
      )}
      {sp.denied && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-critical/10 p-3 text-sm text-critical" role="alert">
          <ShieldAlert className="size-4" /> Tu rol no tiene acceso a esa sección.
        </div>
      )}
      <PageHeader
        title={`Hola, ${ctx.user.name.split(" ")[0]}`}
        description={`Resumen de ${ctx.org.name} para la campaña 2026-2027.`}
        actions={
          <>
            <DemoBadge />
            {ctx.can("simulation:run") && (
              <Button render={<Link href="/app/simulations/new" />} nativeButton={false}>
                <FlaskConical /> Nueva simulación
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Fundos" icon={<Sprout />} value={usage.farms} hint={`${fmtNum(usage.hectares, 0)} ha productivas`} />
        <StatCard
          label="Simulaciones del mes"
          icon={<FlaskConical />}
          value={usage.simulationsThisMonth}
          hint={simLimit === -1 ? "Ilimitadas en tu plan" : `de ${simLimit} incluidas`}
          tone={simLimit !== -1 && usage.simulationsThisMonth >= simLimit * 0.8 ? "warn" : "default"}
        />
        <StatCard label="Alertas abiertas" icon={<Bell />} value={openAlerts.length} hint={`${critical} críticas`} tone={critical > 0 ? "bad" : "default"} />
        <StatCard
          label="Decisiones activas"
          icon={<ClipboardCheck />}
          value={activeDecisions.length}
          hint={overdue ? `${overdue} vencidas` : "Ninguna vencida"}
          tone={overdue ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Riesgo por fundo</CardTitle>
            <CardDescription>Variación del volumen exportable (escenario central) frente a la campaña base, según la última simulación de rendimiento.</CardDescription>
          </CardHeader>
          <CardContent>
            {risk.length ? (
              <RiskBars data={risk} />
            ) : (
              <EmptyState title="Sin simulaciones de rendimiento" description="Corre una simulación para ver el riesgo de cada fundo." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Últimas alertas
              <Link href="/app/alerts" className="text-sm font-normal text-primary hover:underline">
                Ver todas
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {openAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay alertas abiertas.</p>
            ) : (
              <ul className="grid gap-3">
                {openAlerts.slice(0, 4).map((a) => (
                  <li key={a.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <SeverityBadge level={a.severity} />
                      <span className="text-xs text-muted-foreground">{relativeTime(a.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium">{a.title}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Decisiones en seguimiento
              <Link href="/app/decisions" className="text-sm font-normal text-primary hover:underline">
                Ver tablero
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeDecisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin decisiones activas.</p>
            ) : (
              <ul className="divide-y">
                {activeDecisions.slice(0, 5).map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <SeverityBadge level={d.priority} />
                    <span className="flex-1 truncate">{d.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{d.owner ?? "Sin responsable"} · {fmtDate(d.dueDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Simulaciones recientes
              <Link href="/app/simulations" className="text-sm font-normal text-primary hover:underline">
                Historial
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sims.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay simulaciones.</p>
            ) : (
              <ul className="grid gap-1">
                {sims.slice(0, 5).map(({ sim, farmName }) => (
                  <li key={sim.id}>
                    <Link href={`/app/simulations/${sim.id}`} className="group flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
                      <span className="flex-1 truncate">
                        <span className="font-medium">{sim.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {farmName} · {relativeTime(sim.createdAt)}
                        </span>
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
