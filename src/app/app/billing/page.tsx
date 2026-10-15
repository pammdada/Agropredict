import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { CheckCircle2, Clock, CreditCard, Smartphone } from "lucide-react";
import { getDb, schema } from "@/db";
import { PageHeader, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOrgContext } from "@/lib/auth/context";
import { formatPen, getUsage, SUBSCRIPTION_LABELS, withIgv } from "@/lib/billing/entitlements";
import { fmtDate, fmtNum } from "@/lib/format";
import { WebhookButtons } from "./webhook-buttons";

export const metadata: Metadata = { title: "Facturación" };

function Meter({ label, used, limit, unit = "" }: { label: string; used: number; limit: number; unit?: string }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {fmtNum(used, 0)}
          {unit} / {unlimited ? "ilimitado" : `${fmtNum(limit, 0)}${unit}`}
        </span>
      </div>
      {!unlimited && (
        <div className="mt-1.5 h-1.5 rounded-full bg-muted" role="meter" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit}>
          <div className={pct >= 90 ? "h-full rounded-full bg-critical" : pct >= 75 ? "h-full rounded-full bg-warning" : "h-full rounded-full bg-primary"} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ paid?: string; pending?: string }> }) {
  const ctx = await requireOrgContext("billing:read");
  const sp = await searchParams;
  const db = await getDb();
  const usage = await getUsage(ctx.org.id);
  const history = await db
    .select({ invoice: schema.invoices, payment: schema.payments, planName: schema.plans.name })
    .from(schema.invoices)
    .innerJoin(schema.plans, eq(schema.plans.id, schema.invoices.planId))
    .leftJoin(schema.payments, eq(schema.payments.invoiceId, schema.invoices.id))
    .where(eq(schema.invoices.orgId, ctx.org.id))
    .orderBy(desc(schema.invoices.issuedAt));
  const e = ctx.entitlements;
  const sub = ctx.subscription;
  const price = withIgv(ctx.plan.priceCents);
  const pending = history.filter((h) => h.payment?.status === "pending");

  return (
    <>
      <PageHeader
        title="Facturación"
        description="Plan actual, uso frente a los límites e historial de pagos."
        actions={
          ctx.can("billing:manage") && (
            <Button render={<Link href="/app/billing/checkout" />} nativeButton={false}>
              Cambiar plan
            </Button>
          )
        }
      />
      {sp.paid && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="size-4" /> Pago aprobado. Factura {sp.paid} pagada y plan activado.
        </p>
      )}
      {pending.length > 0 && (
        <div role="status" className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Clock className="size-4" /> Tienes {pending.length === 1 ? "un pago pendiente" : `${pending.length} pagos pendientes`} de confirmación del proveedor.
          </p>
          <p className="mt-1 text-muted-foreground">En producción la confirmación llega por webhook firmado. En la demo puedes simularla:</p>
          {ctx.can("billing:manage") &&
            pending.map((p) => (
              <div key={p.payment!.id} className="mt-2 flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs">{p.invoice.number}</span>
                <WebhookButtons paymentId={p.payment!.id} />
              </div>
            ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Plan {ctx.plan.name}</CardTitle>
            <CardDescription>{ctx.plan.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-end gap-2">
              <span className="font-[family-name:var(--font-display)] text-4xl font-semibold">{formatPen(ctx.plan.priceCents)}</span>
              <span className="pb-1 text-sm text-muted-foreground">/ mes + IGV ({formatPen(price.totalCents)} total)</span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Estado</dt>
                <dd className="mt-0.5">
                  <StatusPill tone={sub.status === "active" ? "good" : sub.status === "trialing" ? "info" : "bad"}>{SUBSCRIPTION_LABELS[sub.status]}</StatusPill>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{sub.status === "trialing" ? "Prueba termina" : "Próxima renovación"}</dt>
                <dd className="mt-0.5 font-medium">{fmtDate(sub.status === "trialing" ? sub.trialEndsAt : sub.currentPeriodEnd)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Uso del periodo</CardTitle>
            <CardDescription>Los límites del plan se aplican al crear fundos, invitar usuarios y simular.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Meter label="Fundos" used={usage.farms} limit={e.maxFarms} />
            <Meter label="Hectáreas" used={usage.hectares} limit={e.maxHectares} unit=" ha" />
            <Meter label="Usuarios" used={usage.users} limit={e.maxUsers} />
            <Meter label="Simulaciones este mes" used={usage.simulationsThisMonth} limit={e.maxSimulationsPerMonth} />
            <div className="flex justify-between text-sm">
              <span>Monitor de cadena de frío</span>
              <span className="font-medium">{e.coldChain ? "Incluido" : "No incluido"}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Facturas y pagos</CardTitle>
            <CardDescription>IGV 18 % incluido en el total. La emisión de comprobantes electrónicos SUNAT queda fuera del MVP.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Emitida</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">IGV</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Medio</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(({ invoice, payment, planName }) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-xs">{invoice.number}</TableCell>
                    <TableCell>{fmtDate(invoice.issuedAt)}</TableCell>
                    <TableCell>{planName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPen(invoice.subtotalCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPen(invoice.igvCents)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatPen(invoice.totalCents)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-xs">
                        {payment?.method === "yape" ? <Smartphone className="size-3.5" /> : <CreditCard className="size-3.5" />}
                        {payment?.detail ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={invoice.status === "paid" ? "good" : invoice.status === "void" ? "bad" : "warn"}>
                        {invoice.status === "paid" ? "Pagada" : invoice.status === "void" ? "Anulada" : "Pendiente"}
                      </StatusPill>
                      {payment?.failureReason && <p className="mt-1 max-w-48 text-xs text-muted-foreground">{payment.failureReason}</p>}
                    </TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Aún no hay facturas. Durante la prueba no se realizan cobros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
