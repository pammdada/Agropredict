import "server-only";
import { getDb, schema } from "@/db";

/** Append-only audit trail (security and administrative events). */
export async function audit(entry: {
  action: string;
  orgId?: string | null;
  actorUserId?: string | null;
  target?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = await getDb();
  await db.insert(schema.auditLog).values({
    action: entry.action,
    orgId: entry.orgId ?? null,
    actorUserId: entry.actorUserId ?? null,
    target: entry.target,
    metadata: entry.metadata ?? {},
  });
}

/** Product analytics for Lean Startup metrics (time to first simulation, decisions recorded, plan conversion). */
export async function track(name: string, orgId: string | null, userId: string | null, props: Record<string, unknown> = {}) {
  const db = await getDb();
  await db.insert(schema.analyticsEvents).values({ name, orgId, userId, props });
}
