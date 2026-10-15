import type { Metadata } from "next";
import Link from "next/link";
import { GitCompareArrows } from "lucide-react";
import { DemoBadge } from "@/components/brand";
import { EmptyState, PageHeader, SeverityBadge } from "@/components/page";
import { Upsell } from "@/components/upsell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/context";
import { fmtDate, fmtNum } from "@/lib/format";
import { listSimulations } from "@/lib/queries";
import { CLIMATE_LABELS, type SimulationInput, type SimulationResult } from "@/lib/simulation/contract";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Comparador de escenarios" };

const MAX = 4;

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ type?: string; ids?: string | string[] }> }) {
  const ctx = await requireOrgContext("simulation:read");
  if (!ctx.entitlements.scenarioCompare) {
    return (
      <>
        <PageHeader title="Comparador de escenarios" />
        <Upsell
          title="Compara escenarios lado a lado"
          description="Pon frente a frente Niño moderado, Niño fuerte y neutro para el mismo fundo, o compara fundos entre sí, con su rango y acciones. Disponible desde el plan Básico."
          canManageBilling={ctx.can("billing:manage")}
        />
      </>
    );
  }

  const sp = await searchParams;
  const type = sp.type === "COLD_CHAIN" ? "COLD_CHAIN" : "YIELD";
  const all = (await listSimulations(ctx.org.id)).filter((r) => r.sim.type === type);
  const requested = (Array.isArray(sp.ids) ? sp.ids : sp.ids ? [sp.ids] : []).slice(0, MAX);
  const selected = (requested.length ? all.filter((r) => requested.includes(r.sim.id)) : all.slice(0, 3)).map((r) => ({
    ...r,
    result: r.sim.result as SimulationResult,
    input: r.sim.input as SimulationInput,
  }));
  const isYield = type === "YIELD";
  const unit = isYield ? "t/ha" : "%";
  const digits = isYield ? 1 : 2;

  const values = selected.flatMap((s) => [s.result.scenarios[0].value, s.result.scenarios[2].value, s.result.baseline]);
  const lo = Math.min(...values) * 0.95;
  const hi = Math.max(...values) * 1.05;
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;

  return (
    <>
      <PageHeader
        title="Comparador de escenarios"
        description="Elige hasta 4 simulaciones del mismo tipo para comparar su rango, confianza y acción principal."
        actions={<DemoBadge />}
      />
      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Simulaciones</CardTitle>
            <div className="flex gap-1 pt-1">
              {(["YIELD", "COLD_CHAIN"] as const).map((t) => (
                <Link
                  key={t}
                  href={`/app/compare?type=${t}`}
                  className={cn("rounded-full px-3 py-1 text-xs", type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
                >
                  {t === "YIELD" ? "Rendimiento" : "Cadena de frío"}
                </Link>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {all.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay simulaciones de este tipo.</p>
            ) : (
              <form method="get" className="grid gap-2">
                <input type="hidden" name="type" value={type} />
                <fieldset className="grid max-h-96 gap-1 overflow-y-auto">
                  <legend className="sr-only">Selecciona hasta {MAX}</legend>
                  {all.map(({ sim, farmName }) => (
                    <label key={sim.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        name="ids"
                        value={sim.id}
                        defaultChecked={selected.some((s) => s.sim.id === sim.id)}
                        className="mt-0.5 size-4 accent-[var(--primary)]"
                      />
                      <span>
                        <span className="block font-medium">{sim.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {farmName} · {fmtDate(sim.createdAt)}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <Button type="submit" variant="secondary">
                  <GitCompareArrows /> Comparar
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {selected.length < 2 ? (
          <EmptyState
            icon={<GitCompareArrows />}
            title="Selecciona al menos dos simulaciones"
            description="Tip: simula el mismo fundo con escenario neutro y Niño fuerte para ver cuánto cambia el rango."
          />
        ) : (
          <div className="grid content-start gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{isYield ? "Volumen exportable (t/ha)" : "Merma por envío (%)"}</CardTitle>
                <CardDescription>
                  Barra: rango pesimista–optimista · punto: escenario central · línea vertical: campaña base. {isYield ? "Más es mejor." : "Menos es mejor."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-5" aria-label="Rangos por simulación">
                  {selected.map(({ sim, farmName, result, input }) => {
                    const [opt, cen, pes] = result.scenarios;
                    const a = x(Math.min(opt.value, pes.value));
                    const b = x(Math.max(opt.value, pes.value));
                    return (
                      <li key={sim.id}>
                        <p className="text-sm font-medium">
                          {farmName} · {input.climate === "custom" ? `Personalizado (${input.anomalyIndex} °C)` : CLIMATE_LABELS[input.climate]}
                        </p>
                        <div className="relative mt-2 h-8" role="img" aria-label={`Pesimista ${pes.value}, central ${cen.value}, optimista ${opt.value} ${unit}`}>
                          <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                          <div className="absolute top-1/2 h-4 -translate-y-1/2 border-l-2 border-dashed border-muted-foreground" style={{ left: `${x(result.baseline)}%` }} />
                          <div className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-chart-1/30" style={{ left: `${a}%`, width: `${b - a}%` }} />
                          <div
                            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-chart-1 shadow-[0_0_0_2px_var(--chart-1)]"
                            style={{ left: `${x(cen.value)}%` }}
                          />
                        </div>
                        <div className="relative h-4 text-[11px] tabular-nums text-muted-foreground">
                          <span className="absolute -translate-x-1/2" style={{ left: `${x(pes.value)}%` }}>
                            {fmtNum(pes.value, digits)}
                          </span>
                          <span className="absolute -translate-x-1/2 font-semibold text-foreground" style={{ left: `${x(cen.value)}%` }}>
                            {fmtNum(cen.value, digits)}
                          </span>
                          <span className="absolute -translate-x-1/2" style={{ left: `${x(opt.value)}%` }}>
                            {fmtNum(opt.value, digits)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalle comparado</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Indicador</th>
                      {selected.map((s) => (
                        <th key={s.sim.id} className="py-2 pr-4 font-medium">
                          <Link href={`/app/simulations/${s.sim.id}`} className="text-foreground hover:underline">
                            {s.sim.name}
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      ["Central", (s: (typeof selected)[number]) => `${fmtNum(s.result.scenarios[1].value, digits)} ${unit}`],
                      ["Variación vs. base", (s: (typeof selected)[number]) => `${fmtNum(s.result.scenarios[1].deltaPct)} %`],
                      ["Amplitud del rango", (s: (typeof selected)[number]) => `${fmtNum(Math.abs(s.result.scenarios[0].value - s.result.scenarios[2].value), digits)} ${unit}`],
                      ["Confianza", (s: (typeof selected)[number]) => `${s.result.confidence.level} (${Math.round(s.result.confidence.score * 100)})`],
                      ["Factor principal", (s: (typeof selected)[number]) => s.result.factors[0]?.name ?? "—"],
                    ].map(([label, fn]) => (
                      <tr key={label as string}>
                        <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                          {label as string}
                        </th>
                        {selected.map((s) => (
                          <td key={s.sim.id} className="py-2.5 pr-4 tabular-nums">
                            {(fn as (s: (typeof selected)[number]) => string)(s)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <th scope="row" className="py-2.5 pr-4 text-left align-top font-medium">
                        Acción principal
                      </th>
                      {selected.map((s) => (
                        <td key={s.sim.id} className="py-2.5 pr-4 align-top">
                          <SeverityBadge level={s.result.actions[0].priority} />
                          <p className="mt-1">{s.result.actions[0].title}</p>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
