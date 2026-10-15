import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getDb, schema } from "@/db";
import { PageHeader, StatCard, StatusPill } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperadmin } from "@/lib/auth/context";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { formatPen, getUsage, SUBSCRIPTION_LABELS } from "@/lib/billing/entitlements";
import { fmtDate, fmtDateTime, fmtNum } from "@/lib/format";
import { ImpersonateForm, PlanForm, StatusForm, SubscriptionForm } from "./org-admin-forms";

export const metadata: Metadata = { title: "Organización" };

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperadmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await getDb();
  const [row] = await db
    .select({ org: schema.organizations, sub: schema.subscriptions, plan: schema.plans })
    .from(schema.organizations)
    .innerJoin(schema.subscriptions, eq(schema.subscriptions.orgId, schema.organizations.id))
    .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
    .where(eq(schema.organizations.id, id));
  if (!row) notFound();
  const [usage, members, plans, audits] = await Promise.all([
    getUsage(id),
    db
      .select({ m: schema.memberships, u: schema.users })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(and(eq(schema.memberships.orgId, id), isNull(schema.memberships.deletedAt))),
    db.select().from(schema.plans).orderBy(asc(schema.plans.sortOrder)),
    db.select().from(schema.auditLog).where(eq(schema.auditLog.orgId, id)).orderBy(desc(schema.auditLog.createdAt)).limit(8),
  ]);
  const { org, sub, plan } = row;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin/organizations" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" /> Organizaciones
          </Link>
        }
        title={org.name}
        description={`RUC ${org.ruc ?? "—"} · alta ${fmtDate(org.createdAt)} · ${org.slug}`}
        actions={org.status === "suspended" ? <StatusPill tone="bad">Suspendida</StatusPill> : <StatusPill tone="good">Activa</StatusPill>}
      />
      {org.status === "suspended" && org.suspendedReason && (
        <p className="mb-4 rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">Motivo de suspensión: {org.suspendedReason}</p>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Plan" value={plan.name} hint={`${formatPen(plan.priceCents)}/mes · ${SUBSCRIPTION_LABELS[sub.status]}`} />
        <StatCard label="Usuarios" value={usage.users} />
        <StatCard label="Fundos" value={usage.farms} hint={`${fmtNum(usage.hectares, 0)} ha`} />
        <StatCard label="Simulaciones del mes" value={usage.simulationsThisMonth} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revisar como la empresa (solo lectura)</CardTitle>
            <CardDescription>La impersonación exige un motivo, queda registrada en auditoría y muestra un banner permanente. No permite modificar datos.</CardDescription>
          </CardHeader>
          <CardContent>
            <ImpersonateForm orgId={org.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{org.status === "suspended" ? "Reactivar organización" : "Suspender organización"}</CardTitle>
            <CardDescription>
              Una organización suspendida conserva sus datos en modo lectura y no puede crear simulaciones, fundos ni decisiones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatusForm orgId={org.id} suspended={org.status === "suspended"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Suscripción</CardTitle>
            <CardDescription>
              Periodo {fmtDate(sub.currentPeriodStart)} – {fmtDate(sub.currentPeriodEnd)}. Las transiciones siguen la máquina de estados de facturación.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <PlanForm orgId={org.id} planId={plan.id} plans={plans.map((p) => ({ value: p.id, label: `${p.name} · ${formatPen(p.priceCents)}` }))} />
            <SubscriptionForm orgId={org.id} status={sub.status} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Miembros</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {members.map(({ m, u }) => (
                <li key={m.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {u.name} <span className="block text-xs text-muted-foreground">{u.email}</span>
                  </span>
                  <span className="text-muted-foreground">{ROLE_LABELS[m.role]}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Actividad reciente
              <Link href={`/admin/audit?org=${org.id}`} className="text-sm font-normal text-primary hover:underline">
                Ver auditoría
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {audits.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="w-32 shrink-0 text-xs text-muted-foreground">{fmtDateTime(a.createdAt)}</span>
                  <span className="font-mono text-xs">{a.action}</span>
                  {a.target && <span className="truncate text-xs text-muted-foreground">{a.target}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
