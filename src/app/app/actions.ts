"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { formObject, runAction, UserError, type ActionState } from "@/lib/actions";
import { audit, track } from "@/lib/audit";
import { authorize } from "@/lib/auth/context";
import { assertEntitlement } from "@/lib/billing/entitlements";
import type { SimulationResult } from "@/lib/simulation/contract";
import { runSimulation } from "@/lib/simulation/service";

// Every query below is scoped by ctx.org.id: a user can never read or write another tenant's rows.

// ───────────── Farms (E2, E3) ─────────────

const farmSchema = z.object({
  name: z.string().trim().min(3, "Ingresa el nombre del fundo."),
  cropId: z.string().uuid("Selecciona un cultivo."),
  zoneId: z.string().uuid("Selecciona una zona."),
  variety: z.string().trim().optional(),
  hectares: z.coerce.number({ message: "Ingresa un número." }).positive("Debe ser mayor que 0.").max(20000),
  historyYears: z.coerce.number().int().min(0, "No puede ser negativo.").max(60),
});

export async function createFarmAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("farm:write");
    const input = farmSchema.parse(formObject(formData));
    await assertEntitlement(ctx.org.id, ctx.entitlements, { kind: "farm", addHectares: input.hectares });
    const db = await getDb();
    const [farm] = await db
      .insert(schema.farms)
      .values({ ...input, variety: input.variety || null, orgId: ctx.org.id })
      .returning();
    await audit({ action: "farm.created", orgId: ctx.org.id, actorUserId: ctx.user.id, target: farm.id });
    redirect(`/app/farms/${farm.id}?created=1`);
  });
}

export async function updateFarmAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("farm:write");
    const id = z.string().uuid().parse(formData.get("id"));
    const input = farmSchema.parse(formObject(formData));
    const db = await getDb();
    const [current] = await db
      .select()
      .from(schema.farms)
      .where(and(eq(schema.farms.id, id), eq(schema.farms.orgId, ctx.org.id), isNull(schema.farms.deletedAt)));
    if (!current) throw new UserError("El fundo no existe.");
    if (input.hectares > current.hectares)
      await assertEntitlement(ctx.org.id, ctx.entitlements, { kind: "hectares", deltaHectares: input.hectares - current.hectares });
    await db
      .update(schema.farms)
      .set({ ...input, variety: input.variety || null })
      .where(and(eq(schema.farms.id, id), eq(schema.farms.orgId, ctx.org.id)));
    await audit({ action: "farm.updated", orgId: ctx.org.id, actorUserId: ctx.user.id, target: id });
    revalidatePath(`/app/farms/${id}`);
    return { ok: true, message: "Cambios guardados." };
  });
}

export async function deleteFarmAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("farm:delete");
    const id = z.string().uuid().parse(formData.get("id"));
    const db = await getDb();
    await db
      .update(schema.farms)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.farms.id, id), eq(schema.farms.orgId, ctx.org.id)));
    await audit({ action: "farm.deleted", orgId: ctx.org.id, actorUserId: ctx.user.id, target: id });
    redirect("/app/farms?deleted=1");
  });
}

// ───────────── Simulations (E5) ─────────────

export async function runSimulationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("simulation:run");
    const input = z
      .object({
        type: z.enum(["YIELD", "COLD_CHAIN"]),
        farmId: z.string().uuid("Selecciona un fundo."),
        corridorId: z.string().optional(),
        campaign: z.string().regex(/^\d{4}-\d{4}$/, "Campaña inválida."),
        climate: z.enum(["neutral", "nino_moderate", "nino_strong", "custom"]),
        anomalyIndex: z.coerce.number().min(-3).max(3).optional(),
        horizon: z.coerce.number().int().min(1).max(12),
        name: z.string().max(120).optional(),
      })
      .parse(formObject(formData));
    if (input.type === "COLD_CHAIN" && input.horizon > 14) throw new UserError("El horizonte de cadena de frío es de hasta 14 días.");
    const sim = await runSimulation(ctx, input);
    redirect(`/app/simulations/${sim.id}`);
  });
}

// ───────────── Decisions (E6 → E8) ─────────────

/** One click: a recommended action becomes a tracked Decision. */
export async function recordDecisionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("decision:write");
    const input = z.object({ simulationId: z.string().uuid(), actionIndex: z.coerce.number().int().min(0) }).parse(formObject(formData));
    const db = await getDb();
    const [sim] = await db
      .select()
      .from(schema.simulations)
      .where(and(eq(schema.simulations.id, input.simulationId), eq(schema.simulations.orgId, ctx.org.id)));
    if (!sim) throw new UserError("La simulación no existe.");
    const action = (sim.result as SimulationResult).actions[input.actionIndex];
    if (!action) throw new UserError("La acción no existe.");
    const [decision] = await db
      .insert(schema.decisions)
      .values({
        orgId: ctx.org.id,
        simulationId: sim.id,
        createdBy: ctx.user.id,
        title: action.title,
        detail: action.detail,
        priority: action.priority,
        status: "planned",
        dueDate: new Date(Date.now() + (action.priority === "alta" ? 7 : 21) * 86_400_000),
      })
      .returning();
    await track("decision.recorded", ctx.org.id, ctx.user.id, { priority: action.priority, simulationType: sim.type });
    await audit({ action: "decision.recorded", orgId: ctx.org.id, actorUserId: ctx.user.id, target: decision.id });
    revalidatePath(`/app/simulations/${sim.id}`);
    return { ok: true, message: "Decisión registrada.", data: { id: decision.id } };
  });
}

export async function updateDecisionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("decision:write");
    const input = z
      .object({
        id: z.string().uuid(),
        status: z.enum(["planned", "in_progress", "done", "discarded"]),
        owner: z.string().trim().max(80).optional(),
        dueDate: z.string().optional(),
        notes: z.string().trim().max(1000).optional(),
      })
      .parse(formObject(formData));
    const db = await getDb();
    await db
      .update(schema.decisions)
      .set({
        status: input.status,
        owner: input.owner || null,
        dueDate: input.dueDate ? new Date(`${input.dueDate}T12:00:00-05:00`) : null,
        notes: input.notes || null,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.decisions.id, input.id), eq(schema.decisions.orgId, ctx.org.id)));
    await audit({ action: "decision.updated", orgId: ctx.org.id, actorUserId: ctx.user.id, target: input.id, metadata: { status: input.status } });
    revalidatePath("/app/decisions");
    return { ok: true, message: "Decisión actualizada." };
  });
}

// ───────────── Alerts (E9) ─────────────

export async function setAlertStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("alert:write");
    const input = z.object({ id: z.string().uuid(), status: z.enum(["open", "acknowledged", "resolved"]) }).parse(formObject(formData));
    const db = await getDb();
    await db
      .update(schema.alerts)
      .set({ status: input.status })
      .where(and(eq(schema.alerts.id, input.id), eq(schema.alerts.orgId, ctx.org.id)));
    await audit({ action: `alert.${input.status}`, orgId: ctx.org.id, actorUserId: ctx.user.id, target: input.id });
    revalidatePath("/app", "layout");
    return { ok: true };
  });
}

export async function updateAlertRuleAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("alert_rule:manage");
    const input = z
      .object({ id: z.string().uuid(), threshold: z.coerce.number().min(0).max(100), enabled: z.string().optional() })
      .parse(formObject(formData));
    const db = await getDb();
    await db
      .update(schema.alertRules)
      .set({ threshold: input.threshold, enabled: input.enabled === "on" })
      .where(and(eq(schema.alertRules.id, input.id), eq(schema.alertRules.orgId, ctx.org.id)));
    await audit({ action: "alert_rule.updated", orgId: ctx.org.id, actorUserId: ctx.user.id, target: input.id, metadata: input });
    revalidatePath("/app/alerts");
    return { ok: true, message: "Regla actualizada." };
  });
}
