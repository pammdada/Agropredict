import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";

export async function getCatalogOptions() {
  const db = await getDb();
  const [crops, zones, corridors] = await Promise.all([
    db.select().from(schema.crops).where(eq(schema.crops.active, true)).orderBy(asc(schema.crops.name)),
    db.select().from(schema.zones).where(eq(schema.zones.active, true)).orderBy(asc(schema.zones.name)),
    db.select().from(schema.corridors).where(eq(schema.corridors.active, true)).orderBy(asc(schema.corridors.name)),
  ]);
  return { crops, zones, corridors };
}

export async function listFarms(orgId: string) {
  const db = await getDb();
  return db
    .select({ farm: schema.farms, crop: schema.crops, zone: schema.zones })
    .from(schema.farms)
    .innerJoin(schema.crops, eq(schema.crops.id, schema.farms.cropId))
    .innerJoin(schema.zones, eq(schema.zones.id, schema.farms.zoneId))
    .where(and(eq(schema.farms.orgId, orgId), isNull(schema.farms.deletedAt)))
    .orderBy(asc(schema.farms.name));
}

export async function listSimulations(orgId: string, opts: { farmId?: string; limit?: number } = {}) {
  const db = await getDb();
  const where = [eq(schema.simulations.orgId, orgId), isNull(schema.simulations.deletedAt)];
  if (opts.farmId) where.push(eq(schema.simulations.farmId, opts.farmId));
  return db
    .select({ sim: schema.simulations, farmName: schema.farms.name, userName: schema.users.name })
    .from(schema.simulations)
    .innerJoin(schema.farms, eq(schema.farms.id, schema.simulations.farmId))
    .innerJoin(schema.users, eq(schema.users.id, schema.simulations.userId))
    .where(and(...where))
    .orderBy(desc(schema.simulations.createdAt))
    .limit(opts.limit ?? 200);
}
