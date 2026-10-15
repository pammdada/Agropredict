"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { formObject, runAction, UserError, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/context";
import { assertEntitlement } from "@/lib/billing/entitlements";
import { randomToken, sha256 } from "@/lib/tokens";

const INVITE_TTL_MS = 7 * 86_400_000;

async function inviteLink(token: string) {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/invite/${token}`;
}

export async function inviteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("team:manage");
    const input = z
      .object({ email: z.string().trim().toLowerCase().email("Ingresa un correo válido."), role: z.enum(["ORG_ADMIN", "ORG_ANALYST"]) })
      .parse(formObject(formData));
    const db = await getDb();
    await assertEntitlement(ctx.org.id, ctx.entitlements, { kind: "user" });
    const [existing] = await db
      .select({ id: schema.memberships.id })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(and(eq(schema.memberships.orgId, ctx.org.id), eq(schema.users.email, input.email), isNull(schema.memberships.deletedAt)));
    if (existing) throw new UserError("Esa persona ya es miembro de la organización.");
    // A new invitation for the same email supersedes any pending one.
    await db
      .update(schema.invitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.invitations.orgId, ctx.org.id), eq(schema.invitations.email, input.email), isNull(schema.invitations.acceptedAt), isNull(schema.invitations.revokedAt)));
    const token = randomToken();
    await db.insert(schema.invitations).values({
      orgId: ctx.org.id,
      email: input.email,
      role: input.role,
      tokenHash: sha256(token),
      invitedBy: ctx.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    await audit({ action: "invitation.created", orgId: ctx.org.id, actorUserId: ctx.user.id, target: input.email, metadata: { role: input.role } });
    revalidatePath("/app/team");
    return { ok: true, message: `Invitación creada para ${input.email}. Vence en 7 días.`, data: { link: await inviteLink(token) } };
  });
}

export async function revokeInvitationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("team:manage");
    const id = z.string().uuid().parse(formData.get("id"));
    const db = await getDb();
    await db
      .update(schema.invitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.invitations.id, id), eq(schema.invitations.orgId, ctx.org.id)));
    await audit({ action: "invitation.revoked", orgId: ctx.org.id, actorUserId: ctx.user.id, target: id });
    revalidatePath("/app/team");
    return { ok: true };
  });
}

async function adminCount(orgId: string) {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.memberships.id })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.role, "ORG_ADMIN"), isNull(schema.memberships.deletedAt)));
  return rows.length;
}

export async function changeRoleAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("team:manage");
    const input = z.object({ membershipId: z.string().uuid(), role: z.enum(["ORG_ADMIN", "ORG_ANALYST"]) }).parse(formObject(formData));
    const db = await getDb();
    const [m] = await db
      .select()
      .from(schema.memberships)
      .where(and(eq(schema.memberships.id, input.membershipId), eq(schema.memberships.orgId, ctx.org.id), isNull(schema.memberships.deletedAt)));
    if (!m) throw new UserError("El miembro no existe.");
    if (m.role === "ORG_ADMIN" && input.role !== "ORG_ADMIN" && (await adminCount(ctx.org.id)) <= 1)
      throw new UserError("La organización debe tener al menos un administrador.");
    await db.update(schema.memberships).set({ role: input.role }).where(eq(schema.memberships.id, m.id));
    await audit({ action: "membership.role_changed", orgId: ctx.org.id, actorUserId: ctx.user.id, target: m.userId, metadata: { from: m.role, to: input.role } });
    revalidatePath("/app/team");
    return { ok: true, message: "Rol actualizado." };
  });
}

export async function removeMemberAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("team:manage");
    const id = z.string().uuid().parse(formData.get("membershipId"));
    const db = await getDb();
    const [m] = await db
      .select()
      .from(schema.memberships)
      .where(and(eq(schema.memberships.id, id), eq(schema.memberships.orgId, ctx.org.id), isNull(schema.memberships.deletedAt)));
    if (!m) throw new UserError("El miembro no existe.");
    if (m.userId === ctx.user.id) throw new UserError("No puedes quitarte a ti mismo de la organización.");
    if (m.role === "ORG_ADMIN" && (await adminCount(ctx.org.id)) <= 1) throw new UserError("La organización debe tener al menos un administrador.");
    await db.update(schema.memberships).set({ deletedAt: new Date() }).where(eq(schema.memberships.id, m.id));
    // Sessions pointing at this org lose access on their next request (membership check).
    await db
      .update(schema.sessions)
      .set({ activeOrgId: null })
      .where(and(eq(schema.sessions.userId, m.userId), eq(schema.sessions.activeOrgId, ctx.org.id), gt(schema.sessions.expiresAt, new Date())));
    await audit({ action: "membership.removed", orgId: ctx.org.id, actorUserId: ctx.user.id, target: m.userId });
    revalidatePath("/app/team");
    return { ok: true, message: "Miembro retirado." };
  });
}
