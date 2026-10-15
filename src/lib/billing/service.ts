import "server-only";
import { and, count, eq, like } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { audit, track } from "@/lib/audit";
import { canTransition, getUsage, withIgv } from "./entitlements";

const PERIOD_MS = 30 * 86_400_000;

export async function nextInvoiceNumber() {
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(schema.invoices).where(like(schema.invoices.number, "F001-%"));
  return `F001-${String(120 + n).padStart(6, "0")}`;
}

/** Rejects a plan change when current usage already exceeds the target plan's limits. */
export async function downgradeBlockers(orgId: string, plan: typeof schema.plans.$inferSelect): Promise<string[]> {
  const usage = await getUsage(orgId);
  const e = plan.entitlements;
  const out: string[] = [];
  if (e.maxFarms !== -1 && usage.farms > e.maxFarms) out.push(`tienes ${usage.farms} fundos y el plan permite ${e.maxFarms}`);
  if (e.maxHectares !== -1 && usage.hectares > e.maxHectares) out.push(`tienes ${usage.hectares} ha y el plan permite ${e.maxHectares}`);
  if (e.maxUsers !== -1 && usage.users > e.maxUsers) out.push(`tienes ${usage.users} usuarios y el plan permite ${e.maxUsers}`);
  return out;
}

export async function createInvoice(orgId: string, plan: typeof schema.plans.$inferSelect) {
  const db = await getDb();
  const amounts = withIgv(plan.priceCents);
  const [invoice] = await db
    .insert(schema.invoices)
    .values({ orgId, planId: plan.id, number: await nextInvoiceNumber(), ...amounts, status: "open" })
    .returning();
  return invoice;
}

/** Applies a final payment outcome: invoice + subscription state machine. Idempotent per payment. */
export async function settlePayment(providerRef: string, outcome: "approved" | "rejected", reason?: string) {
  const db = await getDb();
  const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.providerRef, providerRef));
  // Payments are created as "pending" and settled exactly once.
  if (!payment || payment.status !== "pending") return payment;
  await db
    .update(schema.payments)
    .set({ status: outcome, failureReason: outcome === "rejected" ? reason ?? "Rechazado por el proveedor." : null })
    .where(eq(schema.payments.id, payment.id));
  const [invoice] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, payment.invoiceId));
  if (outcome === "rejected") {
    await db.update(schema.invoices).set({ status: "void" }).where(eq(schema.invoices.id, invoice.id));
    await audit({ action: "billing.payment_rejected", orgId: payment.orgId, target: invoice.number, metadata: { reason } });
    return payment;
  }
  await db.update(schema.invoices).set({ status: "paid", paidAt: new Date() }).where(eq(schema.invoices.id, invoice.id));
  await activatePlan(payment.orgId, invoice.planId);
  await audit({ action: "billing.payment_approved", orgId: payment.orgId, target: invoice.number, metadata: { amountCents: payment.amountCents } });
  return payment;
}

export async function activatePlan(orgId: string, planId: string) {
  const db = await getDb();
  const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.orgId, orgId));
  if (!canTransition(sub.status, "active")) throw new Error(`Transición no permitida: ${sub.status} → active`);
  const [plan] = await db.select().from(schema.plans).where(eq(schema.plans.id, planId));
  const now = new Date();
  await db
    .update(schema.subscriptions)
    .set({ planId, status: "active", trialEndsAt: null, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + PERIOD_MS), updatedAt: now })
    .where(and(eq(schema.subscriptions.orgId, orgId)));
  await track("plan.changed", orgId, null, { from: sub.planId, to: plan.code, fromStatus: sub.status });
  await audit({ action: "subscription.activated", orgId, target: `plan:${plan.code}` });
}
