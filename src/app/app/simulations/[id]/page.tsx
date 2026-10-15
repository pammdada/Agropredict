import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Gauge, Lightbulb, ListChecks, Route } from "lucide-react";
import { getDb, schema } from "@/db";
import { DemoBadge } from "@/components/brand";
import { FanChart } from "@/components/charts/fan-chart";
import { PageHeader, SeverityBadge } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/context";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { CLIMATE_LABELS, type SimulationInput, type SimulationResult } from "@/lib/simulation/contract";
import { cn } from "@/lib/utils";
import { RecordDecisionButton } from "./record-decision";

export const metadata: Metadata = { title: "Resultado de simulación" };

export default async function SimulationResultPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext("simulation:read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await getDb();
  const [row] = await db
    .select({ sim: schema.simulations, farmName: schema.farms.name, userName: schema.users.name })
    .from(schema.simulations)
    .innerJoin(schema.farms, eq(schema.farms.id, schema.simulations.farmId))
    .innerJoin(schema.users, eq(schema.users.id, schema.simulations.userId))
    .where(and(eq(schema.simulations.id, id), eq(schema.simulations.orgId, ctx.org.id)));
  if (!row) notFound();
  const decisions = await db
    .select({ id: schema.decisions.id, title: schema.decisions.title })
    .from(schema.decisions)
    .where(and(eq(schema.decisions.simulationId, id), eq(schema.decisions.orgId, ctx.org.id)));

  const { sim } = row;
  const r = sim.result as SimulationResult;
  const input = sim.input as SimulationInput;
  const isYield = sim.type === "YIELD";
  const digits = isYield ? 1 : 2;
  const [opt, central, pes] = r.scenarios;
  const maxFactor = Math.max(...r.factors.map((f) => Math.abs(f.impactPct)), 1);
  const scenarioLabel = input.climate === "custom" ? `Personalizado (${(input.anomalyIndex ?? 0) > 0 ? "+" : ""}${input.anomalyIndex} °C)` : CLIMATE_LABELS[input.climate];

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/app/simulations" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" /> Simulaciones
          </Link>
        }
        title={sim.name}
        description={
          <>
            <Link href={`/app/farms/${sim.farmId}`} className="hover:underline">
              {row.farmName}
            </Link>{" "}
            · {scenarioLabel} · Campaña {input.campaign}
            {input.corridor && ` · ${input.corridor.name}`} · {input.horizon} {isYield ? "meses" : "días"} · por {row.userName}, {fmtDateTime(sim.createdAt)}
          </>
        }
        actions={
          <>
            <DemoBadge />
            {ctx.can("simulation:run") && (
              <Button variant="outline" render={<Link href={`/app/simulations/new?farm=${sim.farmId}&type=${sim.type}`} />} nativeButton={false}>
                Simular otro escenario
              </Button>
            )}
          </>
        }
      />

      <section aria-label="Rango de resultados" className="mb-6 grid gap-4 md:grid-cols-[1fr_1.25fr_1fr]">
        {[opt, central, pes].map((s) => (
          <div
            key={s.key}
            className={cn(
              "rounded-xl p-5 ring-1",
              s.key === "central" ? "bg-sidebar text-sidebar-foreground ring-sidebar md:-my-1 md:py-6" : "bg-card ring-foreground/10",
            )}
          >
            <p className={cn("text-sm font-medium", s.key === "central" ? "text-sidebar-primary" : "text-muted-foreground")}>
              Escenario {s.label.toLowerCase()}
            </p>
            <p className={cn("mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tabular-nums", s.key === "central" && "text-white")}>
              {fmtNum(s.value, digits)} <span className="text-base font-normal opacity-70">{r.metric.unit}</span>
            </p>
            <p className={cn("mt-1 text-sm", s.key === "central" ? "text-sidebar-foreground/80" : "text-muted-foreground")}>
              {s.deltaPct > 0 ? "+" : ""}
              {fmtNum(s.deltaPct)} % vs. base ({fmtNum(r.baseline, digits)} {r.metric.unit})
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{r.seriesLabel}</CardTitle>
            <CardDescription>{r.metric.label}: {isYield ? "más es mejor" : "menos es mejor"}.</CardDescription>
          </CardHeader>
          <CardContent>
            <FanChart data={r.series} unit={isYield ? "t" : "%"} digits={isYield ? 0 : 2} higherIsBetter={r.metric.higherIsBetter} />
            {r.totals && (
              <dl className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
                {r.totals.map((t) => (
                  <div key={t.label}>
                    <dt className="text-xs text-muted-foreground">{t.label}</dt>
                    <dd className="font-semibold tabular-nums">
                      {fmtNum(t.value, 0)} {t.unit}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-5 text-primary" /> Nivel de confianza
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-[family-name:var(--font-display)] text-3xl font-semibold capitalize">{r.confidence.level}</p>
            <div className="mt-3 h-2 rounded-full bg-muted" role="meter" aria-valuenow={Math.round(r.confidence.score * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Confianza">
              <div className="h-full rounded-full bg-primary" style={{ width: `${r.confidence.score * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">{Math.round(r.confidence.score * 100)} / 100</p>
            <p className="mt-4 text-sm text-muted-foreground">{r.confidence.rationale}</p>
            <dl className="mt-4 grid gap-1 border-t pt-4 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <dt>Versión del modelo</dt>
                <dd className="font-mono">{r.modelVersion}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Calidad de datos</dt>
                <dd>Demo (sintéticos)</dd>
              </div>
              <div className="flex justify-between">
                <dt>Generado</dt>
                <dd>{fmtDateTime(r.generatedAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-5 text-primary" /> Acciones recomendadas
            </CardTitle>
            <CardDescription>Conviértelas en decisiones con responsable y fecha para hacerles seguimiento.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3">
              {r.actions.map((a, i) => {
                const recorded = decisions.find((d) => d.title === a.title);
                return (
                  <li key={i} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge level={a.priority === "alta" ? "alta" : a.priority === "media" ? "media" : "baja"} />
                        <p className="font-medium">{a.title}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{a.detail}</p>
                    </div>
                    {recorded ? (
                      <Link href="/app/decisions" className="shrink-0 text-sm font-medium text-success hover:underline">
                        ✓ Decisión registrada
                      </Link>
                    ) : ctx.can("decision:write") ? (
                      <RecordDecisionButton simulationId={sim.id} actionIndex={i} />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="size-5 text-primary" /> Factores principales
            </CardTitle>
            <CardDescription>Contribución estimada a la variación del resultado.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-4">
              {r.factors.map((f) => {
                const adverse = isYield ? f.impactPct < 0 : f.impactPct > 0;
                return (
                  <li key={f.name}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-medium">{f.name}</span>
                      <span className={cn("shrink-0 font-semibold tabular-nums", adverse ? "text-critical" : "text-success")}>
                        {f.impactPct > 0 ? "+" : ""}
                        {fmtNum(f.impactPct)} %
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", adverse ? "bg-critical/70" : "bg-success/70")} style={{ width: `${(Math.abs(f.impactPct) / maxFactor) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{f.explanation}</p>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {r.segments && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="size-5 text-chart-4" /> Merma por tramo (escenario central)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-3 md:grid-cols-4">
                {r.segments.map((s, i) => (
                  <li key={s.name} className="relative rounded-xl border p-4">
                    <span className="text-xs text-muted-foreground">Tramo {i + 1}</span>
                    <p className="font-medium">{s.name}</p>
                    <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums">{fmtNum(s.lossPct, 2)} %</p>
                    <p className="text-xs text-muted-foreground">{fmtNum(s.hours)} h</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
