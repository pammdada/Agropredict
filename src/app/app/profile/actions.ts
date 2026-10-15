"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { formObject, runAction, UserError, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { hashPassword, isStrongPassword, PASSWORD_RULES, verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/auth/context";

async function me() {
  const current = await getSession();
  if (!current || current.session.impersonatedOrgId) throw new ForbiddenError();
  return current;
}

export async function updateProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await me();
    const input = z.object({ name: z.string().trim().min(3, "Ingresa tu nombre completo.") }).parse(formObject(formData));
    const db = await getDb();
    await db.update(schema.users).set({ name: input.name }).where(eq(schema.users.id, user.id));
    revalidatePath("/app", "layout");
    return { ok: true, message: "Perfil actualizado." };
  });
}

export async function changePasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await me();
    const input = z
      .object({ current: z.string(), password: z.string().refine(isStrongPassword, PASSWORD_RULES), confirm: z.string() })
      .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden.", path: ["confirm"] })
      .parse(formObject(formData));
    if (user.passwordHash && !(await verifyPassword(user.passwordHash, input.current))) {
      return { error: "Revisa los campos marcados.", fieldErrors: { current: "La contraseña actual no es correcta." } };
    }
    const db = await getDb();
    await db.update(schema.users).set({ passwordHash: await hashPassword(input.password) }).where(eq(schema.users.id, user.id));
    await audit({ action: "auth.password_changed", actorUserId: user.id });
    return { ok: true, message: user.passwordHash ? "Contraseña actualizada." : "Contraseña creada. Ahora también puedes ingresar con tu correo." };
  });
}

export async function revokeSessionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, session } = await me();
    const id = z.string().uuid().parse(formData.get("sessionId"));
    if (id === session.id) throw new UserError("Para cerrar esta sesión usa “Cerrar sesión”.");
    const db = await getDb();
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.sessions.id, id), eq(schema.sessions.userId, user.id)));
    await audit({ action: "auth.session_revoked", actorUserId: user.id, target: id });
    revalidatePath("/app/profile");
    return { ok: true, message: "Sesión cerrada." };
  });
}
