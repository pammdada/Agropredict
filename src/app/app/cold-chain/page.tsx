import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { AlertTriangle, Container, Factory, FlaskConical, Ship, Sprout, Truck } from "lucide-react";
import { getDb, schema } from "@/db";
import type { ShipmentStatus } from "@/db/schema";
import { DemoBadge } from "@/components/brand";
import { TempSparkline } from "@/components/charts/temp-sparkline";
import { EmptyState, PageHeader, StatCard, StatusPill } from "@/components/page";
import { Upsell } from "@/components/upsell";
import { Button } from "@/components/ui/button";
import { requireOrgContext } from "@/lib/auth/context";
import { fmtDateTime, fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "Cadena de frío" };

const STATUS: Record<ShipmentStatus, { label: string; tone: "neutral" | "info" | "warn" | "good" }> = {
  packing: { label: "En packing", tone: "neutral" },
  in_transit: { label: "En tránsito", tone: "info" },
  at_port: { label: "En puerto", tone: "warn" },
  delivered: { label: "Embarcado", tone: "good" },
};

export default async function ColdChainPage() {
  const ctx = await requireOrgContext("coldchain:read");
  if (!ctx.entitlements.coldChain) {
    return (
      <>
        <PageHeader title="Monitor de cadena de frío" />
        <Upsell
          title="Monitorea tus envíos refrigerados"
          description="Temperatura de cada contenedor por tramo del corredor Ica – Callao, alertas de excursión térmica y simulación de merma por envío. Disponible en el plan Pro."
          canManageBilling={ctx.can("billing:manage")}
        />
      </>
    );
  }

  const db = await getDb();
  const [rule] = await db
    .select()
    .from(schema.alertRules)
    .where(and(eq(schema.alertRules.orgId, ctx.org.id), eq(schema.alertRules.metric, "shipment_temp_c")));
  const threshold = rule?.threshold ?? 4;
  const rows = await db
    .select({ s: schema.shipments, corridor: schema.corridors, farm: schema.farms.name })
    .from(schema.shipments)
    .innerJoin(schema.corridors, eq(schema.corridors.id, schema.shipments.corridorId))
    .leftJoin(schema.farms, eq(schema.farms.id, schema.shipments.farmId))
    .where(eq(schema.shipments.orgId, ctx.org.id))
    .orderBy(desc(schema.shipments.departedAt));

  const withStats = rows.map((r) => {
    const temps = r.s.readings.map((x) => x.c);
    const max = temps.length ? Math.max(...temps) : null;
    const last = temps.length ? temps[temps.length - 1] : null;
    const excursionHours = temps.filter((c) => c >= threshold).length;
    return { ...r, max, last, excursionHours };
  });
  const active = withStats.filter((r) => r.s.status === "in_transit" || r.s.status === "at_port");
  const withExcursion = withStats.filter((r) => r.excursionHours > 0);
  const corridor = rows[0]?.corridor;

  return (
    <>
      <PageHeader
        title="Monitor de cadena de frío"
        description={corridor ? `Corredor ${corridor.name}: ${corridor.distanceKm} km, ${fmtNum(corridor.transitHours)} h de tránsito terrestre. Lecturas horarias de registradores (demo).` : undefined}
        actions={
          <>
            <DemoBadge />
            {ctx.can("simulation:run") && (
              <Button render={<Link href="/app/simulations/new?type=COLD_CHAIN" />} nativeButton={false}>
                <FlaskConical /> Simular merma
              </Button>
            )}
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Container />} title="Sin envíos registrados" />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Envíos activos" value={active.length} hint="En tránsito o en puerto" />
            <StatCard label="Con excursión térmica" value={withExcursion.length} tone={withExcursion.length ? "bad" : "good"} hint={`Umbral ${threshold} °C`} />
            <StatCard label="Pallets en ruta" value={active.reduce((s, r) => s + r.s.pallets, 0)} />
          </div>

          <ol className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10 md:grid-cols-4" aria-label="Tramos del corredor">
            {[
              { icon: Sprout, name: "Cosecha", note: "Fundo → packing" },
              { icon: Factory, name: "Packing y pre-frío", note: "Pulpa < 2 °C" },
              { icon: Truck, name: "Panamericana Sur", note: corridor ? `${corridor.distanceKm} km` : "" },
              { icon: Ship, name: "Puerto del Callao", note: "Espera y embarque" },
            ].map((s, i) => (
              <li key={s.name} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                  <s.icon className="size-4" />
                </span>
                <span>
                  <span className="block font-medium">
                    {i + 1}. {s.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.note}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {withStats.map(({ s, farm, max, last, excursionHours }) => (
              <article key={s.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-mono text-sm font-semibold">{s.code}</h2>
                    <p className="text-xs text-muted-foreground">
                      {s.container} · {s.pallets} pallets · {farm ?? "—"}
                    </p>
                  </div>
                  <StatusPill tone={STATUS[s.status].tone}>{STATUS[s.status].label}</StatusPill>
                </div>
                <div className="mt-3">
                  <TempSparkline readings={s.readings} threshold={threshold} />
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Actual</dt>
                    <dd className="font-semibold tabular-nums">{last === null ? "—" : `${fmtNum(last)} °C`}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Máxima</dt>
                    <dd className={max !== null && max >= threshold ? "font-semibold text-critical tabular-nums" : "font-semibold tabular-nums"}>
                      {max === null ? "—" : `${fmtNum(max)} °C`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">ETA puerto</dt>
                    <dd className="font-semibold">{fmtDateTime(s.etaAt)}</dd>
                  </div>
                </dl>
                {excursionHours > 0 && (
                  <p className="mt-3 flex items-center gap-1.5 rounded-md bg-critical/10 px-2 py-1 text-xs font-medium text-critical">
                    <AlertTriangle className="size-3.5" /> Excursión: {excursionHours} lecturas ≥ {threshold} °C (setpoint {s.setpointC} °C)
                  </p>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
