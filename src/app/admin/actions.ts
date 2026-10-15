"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { formObject, runAction, UserError, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { authorizeSuperadmin } from "@/lib/auth/context";
import { getSession, updateSession } from "@/lib/auth/session";
import { canTransition } from "@/lib/billing/entitlements";

// ───────────── Read-only impersonation (audited, reason required) ─────────────

export async function startImpersonationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await authorizeSuperadmin();
    const input = z
      .object({ orgId: z.string().uuid(), reason: z.string().trim().min(10, "Describe el motivo (mínimo 10 caracteres).") })
      .parse(formObject(formData));
    const db = await getDb();
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, input.orgId));
    if (!org) throw new UserError("La organización no existe.");
    await updateSession({ impersonatedOrgId: org.id, impersonationReason: input.reason });
    await audit({ action: "admin.impersonation_started", orgId: org.id, actorUserId: user.id, metadata: { reason: input.reason } });
    redirect("/app");
  });
}

export async function stopImpersonationAction() {
  const current = await getSession();
  if (!current?.user.isSuperadmin) redirect("/login");
  const orgId = current.session.impersonatedOrgId;
  await updateSession({ impersonatedOrgId: null, impersonationReason: null });
  if (orgId) await audit({ action: "admin.impersonation_ended", orgId, actorUserId: current.user.id });
  redirect(orgId ? `/admin/organizations/${orgId}` : "/admin");
}

// ───────────── Organizations ─────────────

export async function setOrgStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await authorizeSuperadmin();
    const input = z
      .object({ orgId: z.string().uuid(), status: z.enum(["active", "suspended"]), reason: z.string().trim().optional() })
      .parse(formObject(formData));
    if (input.status === "suspended" && (input.reason ?? "").length < 5) throw new UserError("Indica el motivo de la suspensión.");
    const db = await getDb();
    await db
      .update(schema.organizations)
      .set({ status: input.status, suspendedReason: input.status === "suspended" ? input.reason : null })
      .where(eq(schema.organizations.id, input.orgId));
    await audit({
      action: input.status === "suspended" ? "admin.org_suspended" : "admin.org_reactivated",
      orgId: input.orgId,
      actorUserId: user.id,
      metadata: { reason: input.reason },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: input.status === "suspended" ? "Organización suspendida." : "Organización reactivada." };
  });
}

// ───────────── Plans (S4) ─────────────

const planSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().regex(/^[a-z0-9-]{3,20}$/, "Solo minúsculas, números y guiones (3-20)."),
  name: z.string().trim().min(2, "Ingresa el nombre."),
  description: z.string().trim().min(10, "Describe el plan (mínimo 10 caracteres)."),
  price: z.coerce.number({ message: "Ingresa un monto." }).min(0, "No puede ser negativo."),
  maxFarms: z.coerce.number().int().min(-1),
  maxHectares: z.coerce.number().int().min(-1),
  maxUsers: z.coerce.number().int().min(-1),
  maxSimulationsPerMonth: z.coerce.number().int().min(-1),
  coldChain: z.string().optional(),
  scenarioCompare: z.string().optional(),
  highlighted: z.string().optional(),
  active: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function savePlanAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await authorizeSuperadmin();
    const input = planSchema.parse(formObject(formData));
    const values = {
      code: input.code,
      name: input.name,
      description: input.description,
      priceCents: Math.round(input.price * 100),
      entitlements: {
        maxFarms: input.maxFarms,
        maxHectares: input.maxHectares,
        maxUsers: input.maxUsers,
        maxSimulationsPerMonth: input.maxSimulationsPerMonth,
        coldChain: input.coldChain === "on",
        scenarioCompare: input.scenarioCompare === "on",
      },
      highlighted: input.highlighted === "on",
      active: input.active === "on",
      sortOrder: input.sortOrder,
    };
    const db = await getDb();
    const [clash] = await db.select().from(schema.plans).where(eq(schema.plans.code, input.code));
    if (clash && clash.id !== input.id) throw new UserError("Ya existe un plan con ese código.");
    if (input.id) await db.update(schema.plans).set(values).where(eq(schema.plans.id, input.id));
    else await db.insert(schema.plans).values(values);
    await audit({ action: input.id ? "admin.plan_updated" : "admin.plan_created", actorUserId: user.id, target: `plan:${input.code}`, metadata: values });
    revalidatePath("/admin/plans");
    return { ok: true, message: "Plan guardado. Los límites aplican de inmediato a las organizaciones suscritas." };
  });
}

// ───────────── Subscriptions (S5) ─────────────

export async function setSubscriptionStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await authorizeSuperadmin();
    const input = z
      .object({ orgId: z.string().uuid(), status: z.enum(["trialing", "active", "past_due", "canceled", "suspended"]) })
      .parse(formObject(formData));
    const db = await getDb();
    const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.orgId, input.orgId));
    if (!sub) throw new UserError("La organización no tiene suscripción.");
    if (!canTransition(sub.status, input.status)) throw new UserError(`Transición no permitida: ${sub.status} → ${input.status}.`);
    await db.update(schema.subscriptions).set({ status: input.status, updatedAt: new Date() }).where(eq(schema.subscriptions.id, sub.id));
    await audit({ action: "admin.subscription_status", orgId: input.orgId, actorUserId: user.id, metadata: { from: sub.status, to: input.status } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Estado de la suscripción actualizado." };
  });
}

export async function changeOrgPlanAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await authorizeSuperadmin();
    const input = z.object({ orgId: z.string().uuid(), planId: z.string().uuid() }).parse(formObject(formData));
    const db = await getDb();
    await db.update(schema.subscriptions).set({ planId: input.planId, updatedAt: new Date() }).where(eq(schema.subscriptions.orgId, input.orgId));
    await audit({ action: "admin.plan_assigned", orgId: input.orgId, actorUserId: user.id, metadata: { planId: input.planId } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Plan asignado." };
  });
}
