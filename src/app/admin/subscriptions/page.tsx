import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { PageHeader, StatusPill } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSuperadmin } from "@/lib/auth/context";
import { formatPen, SUBSCRIPTION_LABELS } from "@/lib/billing/entitlements";
import { fmtDate, fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Suscripciones y transacciones" };

export default async function SubscriptionsAdminPage() {
  await requireSuperadmin();
  const db = await getDb();
  const [subs, payments, events] = await Promise.all([
    db
      .select({ sub: schema.subscriptions, org: schema.organizations, plan: schema.plans })
      .from(schema.subscriptions)
      .innerJoin(schema.organizations, eq(schema.organizations.id, schema.subscriptions.orgId))
      .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
      .orderBy(desc(schema.subscriptions.updatedAt)),
    db
      .select({ p: schema.payments, org: schema.organizations.name, invoice: schema.invoices.number })
      .from(schema.payments)
      .innerJoin(schema.organizations, eq(schema.organizations.id, schema.payments.orgId))
      .innerJoin(schema.invoices, eq(schema.invoices.id, schema.payments.invoiceId))
      .orderBy(desc(schema.payments.createdAt))
      .limit(100),
    db.select().from(schema.paymentEvents).orderBy(desc(schema.paymentEvents.processedAt)).limit(20),
  ]);

  return (
    <>
      <PageHeader title="Suscripciones y transacciones" description="Estado de cada suscripción, cobros del proveedor de pagos y webhooks recibidos." />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Suscripciones</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organización</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map(({ sub, org, plan }) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <Link href={`/admin/organizations/${org.id}`} className="font-medium hover:underline">
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell>{plan.name}</TableCell>
                    <TableCell>
                      <StatusPill tone={sub.status === "active" ? "good" : sub.status === "trialing" ? "info" : "bad"}>{SUBSCRIPTION_LABELS[sub.status]}</StatusPill>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(sub.currentPeriodStart)} – {fmtDate(sub.currentPeriodEnd)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{sub.status === "active" ? formatPen(plan.priceCents) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Transacciones</CardTitle>
            <CardDescription>Montos con IGV incluido.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Organización</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead>Medio</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(({ p, org, invoice }) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">{fmtDateTime(p.createdAt)}</TableCell>
                    <TableCell>{org}</TableCell>
                    <TableCell className="font-mono text-xs">{invoice}</TableCell>
                    <TableCell>{p.detail}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.provider}:{p.providerRef.slice(0, 14)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPen(p.amountCents)}</TableCell>
                    <TableCell>
                      <StatusPill tone={p.status === "approved" ? "good" : p.status === "pending" ? "warn" : "bad"}>
                        {p.status === "approved" ? "Aprobado" : p.status === "pending" ? "Pendiente" : "Rechazado"}
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Webhooks recibidos</CardTitle>
            <CardDescription>Verificados con firma HMAC; los duplicados se descartan por event_id.</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no se recibieron webhooks.</p>
            ) : (
              <ul className="grid gap-1 font-mono text-xs">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="text-muted-foreground">{fmtDateTime(e.processedAt)}</span>
                    <span>{e.provider}</span>
                    <span>{e.type}</span>
                    <span className="truncate text-muted-foreground">{e.eventId}</span>
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
