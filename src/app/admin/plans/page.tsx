import type { Metadata } from "next";
import { asc, count } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { PageHeader, StatusPill } from "@/components/page";
import { requireSuperadmin } from "@/lib/auth/context";
import { formatPen, withIgv } from "@/lib/billing/entitlements";
import { PlanDialog } from "./plan-dialog";

export const metadata: Metadata = { title: "Planes y precios" };

const lim = (n: number) => (n === -1 ? "Ilimitado" : n.toLocaleString("es-PE"));

export default async function PlansAdminPage() {
  await requireSuperadmin();
  const db = await getDb();
  const plans = await db.select().from(schema.plans).orderBy(asc(schema.plans.sortOrder));
  const subs = await db.select({ planId: schema.subscriptions.planId, n: count() }).from(schema.subscriptions).groupBy(schema.subscriptions.planId);

  return (
    <>
      <PageHeader
        title="Planes y precios"
        description="Precios de ejemplo en soles, sin IGV, por validar en entrevistas comerciales. Los entitlements se aplican en el portal de cada empresa."
        actions={<PlanDialog />}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => {
          const e = p.entitlements;
          return (
            <article key={p.id} className="flex flex-col rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-semibold">{p.name}</h2>
                  <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                </div>
                <div className="flex gap-1">
                  {p.highlighted && <StatusPill tone="info">Destacado</StatusPill>}
                  <StatusPill tone={p.active ? "good" : "neutral"}>{p.active ? "Activo" : "Inactivo"}</StatusPill>
                </div>
              </div>
              <p className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">{formatPen(p.priceCents)}</p>
              <p className="text-xs text-muted-foreground">/ mes + IGV = {formatPen(withIgv(p.priceCents).totalCents)}</p>
              <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-4 text-sm">
                <dt className="text-muted-foreground">Fundos</dt>
                <dd className="text-right">{lim(e.maxFarms)}</dd>
                <dt className="text-muted-foreground">Hectáreas</dt>
                <dd className="text-right">{lim(e.maxHectares)}</dd>
                <dt className="text-muted-foreground">Usuarios</dt>
                <dd className="text-right">{lim(e.maxUsers)}</dd>
                <dt className="text-muted-foreground">Simulaciones/mes</dt>
                <dd className="text-right">{lim(e.maxSimulationsPerMonth)}</dd>
                <dt className="text-muted-foreground">Cadena de frío</dt>
                <dd className="text-right">{e.coldChain ? "Sí" : "No"}</dd>
                <dt className="text-muted-foreground">Comparador</dt>
                <dd className="text-right">{e.scenarioCompare ? "Sí" : "No"}</dd>
              </dl>
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="text-xs text-muted-foreground">{subs.find((s) => s.planId === p.id)?.n ?? 0} organizaciones</span>
                <PlanDialog
                  plan={{
                    id: p.id,
                    code: p.code,
                    name: p.name,
                    description: p.description,
                    price: p.priceCents / 100,
                    sortOrder: p.sortOrder,
                    highlighted: p.highlighted,
                    active: p.active,
                    ...e,
                  }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

