import "server-only";
import { and, count, desc, eq, gte, isNull, sum } from "drizzle-orm";
import { getDb, schema } from "@/db";

/** Organizations with plan, subscription and usage counters (platform-wide view). */
export async function listOrganizations() {
  const db = await getDb();
  const orgs = await db
    .select({ org: schema.organizations, sub: schema.subscriptions, plan: schema.plans })
    .from(schema.organizations)
    .innerJoin(schema.subscriptions, eq(schema.subscriptions.orgId, schema.organizations.id))
    .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
    .where(isNull(schema.organizations.deletedAt))
    .orderBy(desc(schema.organizations.createdAt));
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [members, farms, sims] = await Promise.all([
    db
      .select({ orgId: schema.memberships.orgId, n: count() })
      .from(schema.memberships)
      .where(isNull(schema.memberships.deletedAt))
      .groupBy(schema.memberships.orgId),
    db
      .select({ orgId: schema.farms.orgId, n: count(), ha: sum(schema.farms.hectares) })
      .from(schema.farms)
      .where(isNull(schema.farms.deletedAt))
      .groupBy(schema.farms.orgId),
    db
      .select({ orgId: schema.simulations.orgId, n: count() })
      .from(schema.simulations)
      .where(gte(schema.simulations.createdAt, since))
      .groupBy(schema.simulations.orgId),
  ]);
  return orgs.map((o) => ({
    ...o,
    members: members.find((m) => m.orgId === o.org.id)?.n ?? 0,
    farms: farms.find((f) => f.orgId === o.org.id)?.n ?? 0,
    hectares: Number(farms.find((f) => f.orgId === o.org.id)?.ha ?? 0),
    simulations30d: sims.find((s) => s.orgId === o.org.id)?.n ?? 0,
  }));
}

export async function platformTotals() {
  const db = await getDb();
  const [[users], [simulations], [decisions], [paid]] = await Promise.all([
    db.select({ n: count() }).from(schema.users).where(isNull(schema.users.deletedAt)),
    db.select({ n: count() }).from(schema.simulations),
    db.select({ n: count() }).from(schema.decisions),
    db.select({ total: sum(schema.payments.amountCents) }).from(schema.payments).where(and(eq(schema.payments.status, "approved"))),
  ]);
  return { users: users.n, simulations: simulations.n, decisions: decisions.n, collectedCents: Number(paid.total ?? 0) };
}
