import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { randomToken, sha256 } from "@/lib/tokens";

export const SESSION_COOKIE = "ap_session";
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

export type AuthMethod = "password" | "google" | "microsoft" | "sso" | "invitation" | "register";

/** Opaque random token in an httpOnly cookie; only its SHA-256 is stored server-side. */
export async function createSession(userId: string, authMethod: AuthMethod, activeOrgId?: string | null) {
  const db = await getDb();
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(schema.sessions).values({ tokenHash: sha256(token), userId, authMethod, activeOrgId: activeOrgId ?? null, expiresAt });
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export const getSession = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, sha256(token)),
        isNull(schema.sessions.revokedAt),
        gt(schema.sessions.expiresAt, new Date()),
        isNull(schema.users.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
});

export async function updateSession(values: Partial<Pick<typeof schema.sessions.$inferInsert, "activeOrgId" | "impersonatedOrgId" | "impersonationReason">>) {
  const current = await getSession();
  if (!current) return;
  const db = await getDb();
  await db.update(schema.sessions).set(values).where(eq(schema.sessions.id, current.session.id));
}

export async function destroySession() {
  const current = await getSession();
  const db = await getDb();
  if (current) await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, current.session.id));
  (await cookies()).delete(SESSION_COOKIE);
}

/** Revoke every session of a user (used after a password reset). */
export async function revokeAllSessions(userId: string) {
  const db = await getDb();
  await db.update(schema.sessions).set({ revokedAt: new Date() }).where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
}
