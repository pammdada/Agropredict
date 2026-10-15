import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { WRITABLE_STATUSES } from "@/lib/billing/entitlements";
import { can, type OrgContextRole, type Permission } from "./rbac";
import { getSession } from "./session";

export class ForbiddenError extends Error {
  constructor(message = "No tienes permiso para realizar esta acción.") {
    super(message);
  }
}

export async function requireUser() {
  const current = await getSession();
  if (!current) redirect("/login");
  return current;
}

/** Memberships of the signed-in user in active (non-deleted) organizations. */
export async function getMemberships(userId: string) {
  const db = await getDb();
  return db
    .select({ membership: schema.memberships, org: schema.organizations })
    .from(schema.memberships)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.memberships.orgId))
    .where(and(eq(schema.memberships.userId, userId), isNull(schema.memberships.deletedAt), isNull(schema.organizations.deletedAt)));
}

const loadOrgContext = cache(async () => {
  const current = await getSession();
  if (!current) return { kind: "anonymous" as const };
  const { session, user } = current;
  const db = await getDb();

  let role: OrgContextRole;
  let orgId: string | null;
  if (user.isSuperadmin) {
    if (!session.impersonatedOrgId) return { kind: "superadmin" as const, session, user };
    role = "IMPERSONATOR";
    orgId = session.impersonatedOrgId;
  } else {
    orgId = session.activeOrgId;
    if (!orgId) return { kind: "no-org" as const, session, user };
    const [m] = await db
      .select()
      .from(schema.memberships)
      .where(and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.userId, user.id), isNull(schema.memberships.deletedAt)))
      .limit(1);
    if (!m) return { kind: "no-org" as const, session, user };
    role = m.role;
  }

  const [row] = await db
    .select({ org: schema.organizations, subscription: schema.subscriptions, plan: schema.plans })
    .from(schema.organizations)
    .innerJoin(schema.subscriptions, eq(schema.subscriptions.orgId, schema.organizations.id))
    .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
    .where(eq(schema.organizations.id, orgId))
    .limit(1);
  if (!row) return { kind: "no-org" as const, session, user };

  // A suspended org or a subscription that is not current stays readable but frozen.
  const frozenReason =
    row.org.status === "suspended"
      ? "La organización está suspendida por la plataforma. Puedes consultar la información, pero no crear ni modificar datos."
      : !WRITABLE_STATUSES.includes(row.subscription.status)
        ? "La suscripción no está al día. Regulariza el pago en Facturación para seguir simulando."
        : null;

  const ctx = {
    kind: "org" as const,
    session,
    user,
    role,
    org: row.org,
    subscription: row.subscription,
    plan: row.plan,
    entitlements: row.plan.entitlements,
    impersonating: role === "IMPERSONATOR",
    frozenReason,
    can(permission: Permission): boolean {
      if (!can(role, permission)) return false;
      if (!frozenReason) return true;
      // Billing must stay reachable so the org can pay; everything else becomes read-only.
      return permission.endsWith(":read") || (row.org.status !== "suspended" && permission === "billing:manage");
    },
  };
  return ctx;
});

export type OrgContext = Extract<Awaited<ReturnType<typeof loadOrgContext>>, { kind: "org" }>;

/** For pages: redirects to the right place when there is no usable org context or permission. */
export async function requireOrgContext(permission?: Permission): Promise<OrgContext> {
  const ctx = await loadOrgContext();
  if (ctx.kind === "anonymous") redirect("/login");
  if (ctx.kind === "superadmin") redirect("/admin");
  if (ctx.kind === "no-org") redirect("/select-org");
  if (permission && !can(ctx.role, permission)) redirect("/app?denied=1");
  return ctx;
}

/** For server actions: throws ForbiddenError instead of redirecting. */
export async function authorize(permission: Permission): Promise<OrgContext> {
  const ctx = await loadOrgContext();
  if (ctx.kind !== "org") throw new ForbiddenError("Tu sesión no tiene una organización activa.");
  if (!ctx.can(permission)) throw new ForbiddenError(ctx.frozenReason && can(ctx.role, permission) ? ctx.frozenReason : undefined);
  return ctx;
}

export async function requireSuperadmin() {
  const current = await getSession();
  if (!current) redirect("/login");
  if (!current.user.isSuperadmin) redirect("/app?denied=1");
  return current;
}

export async function authorizeSuperadmin() {
  const current = await getSession();
  if (!current?.user.isSuperadmin) throw new ForbiddenError();
  return current;
}

export async function getOrgContextOrNull() {
  const ctx = await loadOrgContext();
  return ctx.kind === "org" ? ctx : null;
}
