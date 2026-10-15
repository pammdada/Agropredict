import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { Building2, CircleDollarSign, FlaskConical, Users } from "lucide-react";
import { getDb, schema } from "@/db";
import { PageHeader, StatCard, StatusPill } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listOrganizations, platformTotals } from "@/lib/admin-queries";
import { requireSuperadmin } from "@/lib/auth/context";
import { formatPen, SUBSCRIPTION_LABELS } from "@/lib/billing/entitlements";
import { fmtDate, relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Plataforma" };

export default async function PlatformDashboard() {
  await requireSuperadmin();
  const db = await getDb();
  const [orgs, totals, events] = await Promise.all([
    listOrganizations(),
    platformTotals(),
    db.select().from(schema.analyticsEvents).orderBy(desc(schema.analyticsEvents.createdAt)).limit(200),
  ]);
  const paying = orgs.filter((o) => o.sub.status === "active");
  const mrr = paying.reduce((s, o) => s + o.plan.priceCents, 0);
  const trials = orgs.filter((o) => o.sub.status === "trialing").length;
  const byPlan = new Map<string, number>();
  for (const o of orgs) byPlan.set(o.plan.name, (byPlan.get(o.plan.name) ?? 0) + 1);
  const firstSims = events.filter((e) => e.name === "simulation.completed" && e.props.first).length;
  const decisions = events.filter((e) => e.name === "decision.recorded").length;
  const planChanges = events.filter((e) => e.name === "plan.changed").length;

  return (
    <>
      <PageHeader title="Dashboard de plataforma" description="Organizaciones, ingresos recurrentes simulados y métricas de uso para Lean Startup." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Organizaciones" icon={<Building2 />} value={orgs.length} hint={`${trials} en prueba · ${orgs.filter((o) => o.org.status === "suspended").length} suspendidas`} />
        <StatCard label="MRR simulado" icon={<CircleDollarSign />} value={formatPen(mrr)} hint={`${paying.length} suscripciones activas · sin IGV`} />
        <StatCard label="Usuarios" icon={<Users />} value={totals.users} hint={`Cobrado: ${formatPen(totals.collectedCents)}`} />
        <StatCard label="Simulaciones" icon={<FlaskConical />} value={totals.simulations} hint={`${totals.decisions} decisiones registradas`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Organizaciones
              <Link href="/admin/organizations" className="text-sm font-normal text-primary hover:underline">
                Gestionar
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {orgs.map((o) => (
                <li key={o.org.id}>
                  <Link href={`/admin/organizations/${o.org.id}`} className="flex items-center gap-3 py-3 text-sm hover:text-primary">
                    <span className="grid size-9 place-items-center rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground">
                      {o.org.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{o.org.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Plan {o.plan.name} · {o.members} usuarios · {o.simulations30d} simulaciones (30 d) · alta {fmtDate(o.org.createdAt)}
                      </span>
                    </span>
                    {o.org.status === "suspended" ? (
                      <StatusPill tone="bad">Suspendida</StatusPill>
                    ) : (
                      <StatusPill tone={o.sub.status === "active" ? "good" : o.sub.status === "trialing" ? "info" : "warn"}>{SUBSCRIPTION_LABELS[o.sub.status]}</StatusPill>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por plan</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3">
                {[...byPlan.entries()].map(([name, n]) => (
                  <li key={name}>
                    <div className="flex justify-between text-sm">
                      <span>{name}</span>
                      <span className="font-medium tabular-nums">{n}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(n / orgs.length) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Métricas de producto</CardTitle>
              <CardDescription>Telemetría para el ciclo construir–medir–aprender.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <dt>Organizaciones con primera simulación</dt>
                  <dd className="font-medium tabular-nums">{firstSims}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Decisiones registradas desde resultados</dt>
                  <dd className="font-medium tabular-nums">{decisions}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Cambios de plan (conversión)</dt>
                  <dd className="font-medium tabular-nums">{planChanges}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Último evento</dt>
                  <dd>{events[0] ? `${events[0].name} · ${relativeTime(events[0].createdAt)}` : "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
