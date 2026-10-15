import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { BellOff } from "lucide-react";
import { getDb, schema } from "@/db";
import { EmptyState, PageHeader, SeverityBadge, StatusPill } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/context";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertActions, RuleRow } from "./alert-controls";

export const metadata: Metadata = { title: "Alertas" };

const TABS = [
  { key: "open", label: "Abiertas" },
  { key: "acknowledged", label: "Reconocidas" },
  { key: "resolved", label: "Resueltas" },
  { key: "all", label: "Todas" },
] as const;

const METRIC_LABELS = {
  yield_drop_pct: "Caída de rendimiento central ≥ (%)",
  cold_chain_loss_pct: "Merma de cadena de frío ≥ (%)",
  shipment_temp_c: "Temperatura en reefer ≥ (°C)",
} as const;

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireOrgContext("alert:read");
  const { status = "open" } = await searchParams;
  const db = await getDb();
  const all = await db
    .select({ a: schema.alerts, farmName: schema.farms.name })
    .from(schema.alerts)
    .leftJoin(schema.farms, eq(schema.farms.id, schema.alerts.farmId))
    .where(eq(schema.alerts.orgId, ctx.org.id))
    .orderBy(desc(schema.alerts.createdAt));
  const rows = status === "all" ? all : all.filter((r) => r.a.status === status);
  const rules = await db.select().from(schema.alertRules).where(and(eq(schema.alertRules.orgId, ctx.org.id))).orderBy(asc(schema.alertRules.metric), asc(schema.alertRules.threshold));

  return (
    <>
      <PageHeader title="Alertas" description="Se generan cuando una simulación o un envío supera los umbrales configurados." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div>
          <nav className="mb-4 flex flex-wrap gap-1" aria-label="Filtrar por estado">
            {TABS.map((t) => {
              const n = t.key === "all" ? all.length : all.filter((r) => r.a.status === t.key).length;
              return (
                <Link
                  key={t.key}
                  href={`/app/alerts?status=${t.key}`}
                  aria-current={status === t.key ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm transition",
                    status === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t.label} <span className="opacity-70">({n})</span>
                </Link>
              );
            })}
          </nav>
          {rows.length === 0 ? (
            <EmptyState icon={<BellOff />} title="Sin alertas en esta vista" description="Todo en orden por ahora." />
          ) : (
            <ul className="grid gap-3">
              {rows.map(({ a, farmName }) => (
                <li
                  key={a.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-start",
                    a.severity === "critica" && a.status === "open" && "shadow-[inset_4px_0_0_var(--critical)]",
                  )}
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge level={a.severity} />
                      <StatusPill tone={a.status === "open" ? "bad" : a.status === "acknowledged" ? "warn" : "good"}>
                        {a.status === "open" ? "Abierta" : a.status === "acknowledged" ? "Reconocida" : "Resuelta"}
                      </StatusPill>
                      <span className="text-xs text-muted-foreground">{relativeTime(a.createdAt)}</span>
                    </div>
                    <p className="mt-2 font-medium">{a.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{a.message}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      {a.simulationId && (
                        <Link href={`/app/simulations/${a.simulationId}`} className="text-primary hover:underline">
                          Ver simulación
                        </Link>
                      )}
                      {a.shipmentId && (
                        <Link href="/app/cold-chain" className="text-primary hover:underline">
                          Ver envío
                        </Link>
                      )}
                      {farmName && <span className="text-muted-foreground">{farmName}</span>}
                    </div>
                  </div>
                  {ctx.can("alert:write") && <AlertActions id={a.id} status={a.status} />}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Reglas y umbrales</CardTitle>
            <CardDescription>
              {ctx.can("alert_rule:manage") ? "Ajusta cuándo se dispara cada alerta." : "Solo el administrador puede modificar las reglas."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {rules.map((r) => (
                <RuleRow
                  key={r.id}
                  rule={{ id: r.id, name: r.name, threshold: r.threshold, enabled: r.enabled, severity: r.severity }}
                  metricLabel={METRIC_LABELS[r.metric]}
                  editable={ctx.can("alert_rule:manage")}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
