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
