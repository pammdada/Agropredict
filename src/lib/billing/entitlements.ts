import "server-only";
import { and, count, eq, gte, isNull, sum } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Entitlements, SubscriptionStatus } from "@/db/schema";

export const IGV_RATE = 0.18;

export function withIgv(subtotalCents: number) {
  const igvCents = Math.round(subtotalCents * IGV_RATE);
  return { subtotalCents, igvCents, totalCents: subtotalCents + igvCents };
}

export function formatPen(cents: number): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(cents / 100);
}

/** Subscription states in which the organization may create new work. */
export const WRITABLE_STATUSES: SubscriptionStatus[] = ["trialing", "active"];

export const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "En prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  suspended: "Suspendida",
};

/** Allowed state-machine transitions for subscriptions. */
const TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trialing: ["active", "past_due", "canceled", "suspended"],
  active: ["active", "past_due", "canceled", "suspended"],
  past_due: ["active", "canceled", "suspended"],
  canceled: ["active"],
  suspended: ["active", "canceled"],
};

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export async function getUsage(orgId: string) {
  const db = await getDb();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [farms] = await db
    .select({ n: count(), ha: sum(schema.farms.hectares) })
    .from(schema.farms)
    .where(and(eq(schema.farms.orgId, orgId), isNull(schema.farms.deletedAt)));
  const [users] = await db
    .select({ n: count() })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.orgId, orgId), isNull(schema.memberships.deletedAt)));
  const [sims] = await db
    .select({ n: count() })
    .from(schema.simulations)
    .where(and(eq(schema.simulations.orgId, orgId), gte(schema.simulations.createdAt, monthStart)));
  return { farms: farms.n, hectares: Number(farms.ha ?? 0), users: users.n, simulationsThisMonth: sims.n };
}

export type Usage = Awaited<ReturnType<typeof getUsage>>;

export class EntitlementError extends Error {}

/** Throws EntitlementError when the plan limit would be exceeded. -1 means unlimited. */
export async function assertEntitlement(
  orgId: string,
  ent: Entitlements,
  check: { kind: "farm"; addHectares: number } | { kind: "simulation"; type: "YIELD" | "COLD_CHAIN" } | { kind: "user" } | { kind: "hectares"; deltaHectares: number },
) {
  const usage = await getUsage(orgId);
  const over = (limit: number, value: number) => limit !== -1 && value > limit;
  switch (check.kind) {
    case "farm":
      if (over(ent.maxFarms, usage.farms + 1)) throw new EntitlementError(`Tu plan permite hasta ${ent.maxFarms} fundos. Cambia de plan para agregar más.`);
      if (over(ent.maxHectares, usage.hectares + check.addHectares))
        throw new EntitlementError(`Tu plan permite hasta ${ent.maxHectares} ha en total.`);
      return;
    case "hectares":
      if (over(ent.maxHectares, usage.hectares + check.deltaHectares)) throw new EntitlementError(`Tu plan permite hasta ${ent.maxHectares} ha en total.`);
      return;
    case "simulation":
      if (check.type === "COLD_CHAIN" && !ent.coldChain)
        throw new EntitlementError("La simulación de cadena de frío está disponible en el plan Pro.");
      if (over(ent.maxSimulationsPerMonth, usage.simulationsThisMonth + 1))
        throw new EntitlementError(`Alcanzaste las ${ent.maxSimulationsPerMonth} simulaciones de este mes.`);
      return;
    case "user":
      if (over(ent.maxUsers, usage.users + 1)) throw new EntitlementError(`Tu plan permite hasta ${ent.maxUsers} usuarios.`);
      return;
  }
}
