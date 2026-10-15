"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { formObject, runAction, UserError, type ActionState } from "@/lib/actions";
import { audit, track } from "@/lib/audit";
import { getMemberships } from "@/lib/auth/context";
import { hashPassword, isStrongPassword, PASSWORD_RULES, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSession, revokeAllSessions, updateSession, type AuthMethod } from "@/lib/auth/session";
import { randomToken, sha256 } from "@/lib/tokens";

const MAX_ATTEMPTS = 5;
const OAUTH_COOKIE = "ap_oauth";

const email = z.string().trim().toLowerCase().email("Ingresa un correo válido.");
const strongPassword = z.string().refine(isStrongPassword, PASSWORD_RULES);

async function appOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Decides where a freshly signed-in user lands: admin area, their only org, or the org selector. */
async function landAfterLogin(user: typeof schema.users.$inferSelect, method: AuthMethod, forcedOrgId?: string): Promise<never> {
  if (user.isSuperadmin) {
    await createSession(user.id, method);
    redirect("/admin");
  }
  const memberships = await getMemberships(user.id);
  const orgId = forcedOrgId ?? (memberships.length === 1 ? memberships[0].org.id : null);
  await createSession(user.id, method, orgId);
  redirect(orgId ? "/app" : "/select-org");
}

// ───────────── A3 · Email + password ─────────────

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = z.object({ email, password: z.string().min(1, "Ingresa tu contraseña.") }).parse(formObject(formData));
    const db = await getDb();
    const [user] = await db.select().from(schema.users).where(and(eq(schema.users.email, input.email), isNull(schema.users.deletedAt)));
    const generic = "Correo o contraseña incorrectos.";
    if (!user) throw new UserError(generic);

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const until = user.lockedUntil.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });
      throw new UserError(`Cuenta bloqueada temporalmente por intentos fallidos. Vuelve a intentar después de las ${until}.`);
    }

    if (!(await verifyPassword(user.passwordHash, input.password))) {
      const failed = user.failedLoginCount + 1;
      // Progressive lockout: 5 min after 5 failures, doubling on each further failure (max 1 h).
      const lockedUntil = failed >= MAX_ATTEMPTS ? new Date(Date.now() + Math.min(60, 5 * 2 ** (failed - MAX_ATTEMPTS)) * 60_000) : null;
      await db.update(schema.users).set({ failedLoginCount: failed, lockedUntil }).where(eq(schema.users.id, user.id));
      await audit({ action: "auth.login_failed", actorUserId: user.id, metadata: { failed } });
      const left = MAX_ATTEMPTS - failed;
      throw new UserError(left > 0 ? `${generic} Te quedan ${left} intentos antes del bloqueo temporal.` : "Demasiados intentos. La cuenta quedó bloqueada temporalmente.");
    }

    await db.update(schema.users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(schema.users.id, user.id));
    await audit({ action: "auth.login", actorUserId: user.id, metadata: { method: "password" } });
    await landAfterLogin(user, "password");
  });
}

export async function logoutAction() {
  const current = await getSession();
  if (current) await audit({ action: "auth.logout", actorUserId: current.user.id });
  await destroySession();
  redirect("/login");
}

// ───────────── A4 · Company registration ─────────────

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function registerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = z
      .object({
        company: z.string().trim().min(3, "Ingresa la razón social."),
        ruc: z.string().trim().regex(/^(10|20)\d{9}$/, "El RUC debe tener 11 dígitos y empezar con 10 o 20."),
        name: z.string().trim().min(3, "Ingresa tu nombre completo."),
        email,
        password: strongPassword,
        plan: z.enum(["piloto", "basico", "pro"]),
        terms: z.literal("on", { message: "Debes aceptar los términos y la política de privacidad." }),
      })
      .parse(formObject(formData));

    const db = await getDb();
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, input.email));
    if (existing) throw new UserError("Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.");
    const [plan] = await db.select().from(schema.plans).where(and(eq(schema.plans.code, input.plan), eq(schema.plans.active, true)));
    if (!plan) throw new UserError("El plan seleccionado no está disponible.");

    const passwordHash = await hashPassword(input.password);
    const trialEnds = new Date(Date.now() + 14 * 86_400_000);
    const { user, org } = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(schema.organizations)
        .values({ name: input.company, ruc: input.ruc, slug: `${slugify(input.company)}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "")}` })
        .returning();
      const [user] = await tx.insert(schema.users).values({ email: input.email, name: input.name, passwordHash, emailVerifiedAt: new Date() }).returning();
      await tx.insert(schema.memberships).values({ orgId: org.id, userId: user.id, role: "ORG_ADMIN" });
      await tx.insert(schema.subscriptions).values({
        orgId: org.id,
        planId: plan.id,
        status: "trialing",
        trialEndsAt: trialEnds,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEnds,
      });
      await tx.insert(schema.alertRules).values([
        { orgId: org.id, name: "Caída de rendimiento relevante", metric: "yield_drop_pct", threshold: 10, severity: "alta" },
        { orgId: org.id, name: "Caída de rendimiento severa", metric: "yield_drop_pct", threshold: 22, severity: "critica" },
        { orgId: org.id, name: "Merma de cadena de frío", metric: "cold_chain_loss_pct", threshold: 3, severity: "alta" },
      ]);
      return { user, org };
    });

    await audit({ action: "org.registered", orgId: org.id, actorUserId: user.id, metadata: { plan: plan.code } });
    await track("org.registered", org.id, user.id, { plan: plan.code });
    await createSession(user.id, "register", org.id);
    redirect("/app?welcome=1");
  });
}

// ───────────── A5 · Password recovery ─────────────

export async function forgotPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = z.object({ email }).parse(formObject(formData));
    const db = await getDb();
    const [user] = await db.select().from(schema.users).where(and(eq(schema.users.email, input.email), isNull(schema.users.deletedAt)));
    const message = "Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Vence en 60 minutos.";
    if (!user) return { ok: true, message };
    const token = randomToken();
    await db.insert(schema.passwordResets).values({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3_600_000) });
    await audit({ action: "auth.password_reset_requested", actorUserId: user.id });
    // Demo: no transactional email provider yet, so the link is shown on screen.
    return { ok: true, message, data: { link: `${await appOrigin()}/reset-password/${token}` } };
  });
}

export async function resetPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = z
      .object({ token: z.string().min(10), password: strongPassword, confirm: z.string() })
      .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden.", path: ["confirm"] })
      .parse(formObject(formData));
    const db = await getDb();
    const [reset] = await db
      .select()
      .from(schema.passwordResets)
      .where(and(eq(schema.passwordResets.tokenHash, sha256(input.token)), isNull(schema.passwordResets.usedAt), gt(schema.passwordResets.expiresAt, new Date())));
    if (!reset) throw new UserError("El enlace no es válido o ya fue usado. Solicita uno nuevo.");
    await db.update(schema.passwordResets).set({ usedAt: new Date() }).where(eq(schema.passwordResets.id, reset.id));
    await db
      .update(schema.users)
      .set({ passwordHash: await hashPassword(input.password), failedLoginCount: 0, lockedUntil: null })
      .where(eq(schema.users.id, reset.userId));
    await revokeAllSessions(reset.userId);
    await audit({ action: "auth.password_reset", actorUserId: reset.userId });
    redirect("/login?reset=1");
  });
}

// ───────────── A6 · Accept invitation ─────────────

export async function acceptInvitationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const raw = formObject(formData);
    const token = z.string().min(10).parse(raw.token);
    const db = await getDb();
    const [inv] = await db
      .select()
      .from(schema.invitations)
      .where(
        and(
          eq(schema.invitations.tokenHash, sha256(token)),
          isNull(schema.invitations.acceptedAt),
          isNull(schema.invitations.revokedAt),
          gt(schema.invitations.expiresAt, new Date()),
        ),
      );
    if (!inv) throw new UserError("La invitación no es válida, expiró o fue revocada.");

    let [user] = await db.select().from(schema.users).where(eq(schema.users.email, inv.email));
    if (user) {
      const current = await getSession();
      const signedInAsInvitee = current?.user.id === user.id;
      if (!signedInAsInvitee && !(await verifyPassword(user.passwordHash, raw.password ?? ""))) {
        throw new UserError("La contraseña no es correcta para esta cuenta.");
      }
    } else {
      const input = z.object({ name: z.string().trim().min(3, "Ingresa tu nombre completo."), password: strongPassword }).parse(raw);
      [user] = await db
        .insert(schema.users)
        .values({ email: inv.email, name: input.name, passwordHash: await hashPassword(input.password), emailVerifiedAt: new Date() })
        .returning();
    }

    await db
      .insert(schema.memberships)
      .values({ orgId: inv.orgId, userId: user.id, role: inv.role })
      .onConflictDoUpdate({ target: [schema.memberships.orgId, schema.memberships.userId], set: { role: inv.role, deletedAt: null } });
    await db.update(schema.invitations).set({ acceptedAt: new Date() }).where(eq(schema.invitations.id, inv.id));
    await audit({ action: "invitation.accepted", orgId: inv.orgId, actorUserId: user.id, metadata: { role: inv.role } });
    await createSession(user.id, "invitation", inv.orgId);
    redirect("/app");
  });
}

// ───────────── A7 · Simulated OAuth (Google, Microsoft) and enterprise SSO ─────────────

type OAuthCookie = { state: string; verifier: string; provider: string; orgId?: string };

async function startFlow(provider: "google" | "microsoft" | "sso", extra: { orgId?: string; loginHint?: string } = {}): Promise<never> {
  const state = randomToken(16);
  const verifier = randomToken(32);
  const jar = await cookies();
  const payload: OAuthCookie = { state, verifier, provider, orgId: extra.orgId };
  jar.set(OAUTH_COOKIE, JSON.stringify(payload), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  const params = new URLSearchParams({ state, code_challenge: sha256(verifier), code_challenge_method: "S256" });
  if (extra.orgId) params.set("org", extra.orgId);
  if (extra.loginHint) params.set("login_hint", extra.loginHint);
  redirect(`/auth/provider/${provider}?${params.toString()}`);
}

export async function startSocialLogin(formData: FormData) {
  const provider = z.enum(["google", "microsoft"]).parse(formData.get("provider"));
  await startFlow(provider);
}

export async function ssoDiscoverAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = z.object({ email }).parse(formObject(formData));
    const domain = input.email.split("@")[1];
    const db = await getDb();
    const configs = await db
      .select({ config: schema.ssoConfigs, org: schema.organizations })
      .from(schema.ssoConfigs)
      .innerJoin(schema.organizations, eq(schema.organizations.id, schema.ssoConfigs.orgId))
      .where(eq(schema.ssoConfigs.enabled, true));
    const match = configs.find((c) => c.config.allowedDomains.includes(domain));
    if (!match) throw new UserError(`No encontramos SSO configurado para el dominio @${domain}. Ingresa con correo y contraseña o consulta al administrador de tu empresa.`);
    if (match.org.status === "suspended") throw new UserError("La organización de este dominio está suspendida.");
    await startFlow("sso", { orgId: match.org.id, loginHint: input.email });
  });
}

/** Simulated identity provider: the user "authenticates" and gets redirected back with a one-time code. */
export async function providerAuthorizeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = z
      .object({
        provider: z.enum(["google", "microsoft", "sso"]),
        state: z.string().min(10),
        email,
        name: z.string().trim().min(2, "Ingresa tu nombre."),
        org: z.string().optional(),
      })
      .parse(formObject(formData));
    const db = await getDb();
    if (input.provider === "sso") {
      const [config] = await db.select().from(schema.ssoConfigs).where(eq(schema.ssoConfigs.orgId, input.org ?? ""));
      if (!config || !config.allowedDomains.includes(input.email.split("@")[1]))
        throw new UserError("El proveedor de tu empresa rechazó el correo: el dominio no está permitido.");
    }
    const code = randomToken(24);
    await db.insert(schema.oauthCodes).values({
      code,
      provider: input.provider,
      email: input.email,
      name: input.name,
      orgId: input.provider === "sso" ? input.org : null,
      state: input.state,
      expiresAt: new Date(Date.now() + 120_000),
    });
    redirect(`/auth/callback?${new URLSearchParams({ code, state: input.state }).toString()}`);
  });
}

export async function completeOAuthAction(code: string, state: string): Promise<ActionState> {
  return runAction(async () => {
    const jar = await cookies();
    const raw = jar.get(OAUTH_COOKIE)?.value;
    jar.delete(OAUTH_COOKIE);
    const flow = raw ? (JSON.parse(raw) as OAuthCookie) : null;
    if (!flow || flow.state !== state) throw new UserError("La respuesta del proveedor no coincide con la solicitud (state inválido). Vuelve a intentarlo.");

    const db = await getDb();
    const [grant] = await db
      .select()
      .from(schema.oauthCodes)
      .where(and(eq(schema.oauthCodes.code, code), isNull(schema.oauthCodes.usedAt), gt(schema.oauthCodes.expiresAt, new Date())));
    if (!grant || grant.state !== state || grant.provider !== flow.provider) throw new UserError("El código de autorización expiró o ya fue usado.");
    await db.update(schema.oauthCodes).set({ usedAt: new Date() }).where(eq(schema.oauthCodes.id, grant.id));

    let [user] = await db.select().from(schema.users).where(and(eq(schema.users.email, grant.email), isNull(schema.users.deletedAt)));
    if (!user) {
      [user] = await db.insert(schema.users).values({ email: grant.email, name: grant.name, emailVerifiedAt: new Date() }).returning();
      await audit({ action: "auth.user_provisioned", orgId: grant.orgId, actorUserId: user.id, metadata: { provider: grant.provider } });
    }
    const method = grant.provider as AuthMethod;

    if (grant.provider === "sso" && grant.orgId) {
      // Just-in-time provisioning into the organization that owns the SSO connection.
      const [config] = await db.select().from(schema.ssoConfigs).where(eq(schema.ssoConfigs.orgId, grant.orgId));
      const memberships = await getMemberships(user.id);
      if (!memberships.some((m) => m.org.id === grant.orgId)) {
        await db.insert(schema.memberships).values({ orgId: grant.orgId, userId: user.id, role: config?.defaultRole ?? "ORG_ANALYST" });
        await audit({ action: "sso.jit_membership", orgId: grant.orgId, actorUserId: user.id, metadata: { role: config?.defaultRole } });
      }
      await audit({ action: "auth.login", orgId: grant.orgId, actorUserId: user.id, metadata: { method } });
      await landAfterLogin(user, method, grant.orgId);
    }

    await audit({ action: "auth.login", actorUserId: user.id, metadata: { method } });
    await landAfterLogin(user, method);
  });
}

// ───────────── A8 · Organization selector ─────────────

export async function selectOrgAction(formData: FormData) {
  const orgId = z.string().uuid().parse(formData.get("orgId"));
  const current = await getSession();
  if (!current) redirect("/login");
  const memberships = await getMemberships(current.user.id);
  if (!memberships.some((m) => m.org.id === orgId)) redirect("/select-org?error=1");
  await updateSession({ activeOrgId: orgId });
  await audit({ action: "auth.org_switched", orgId, actorUserId: current.user.id });
  redirect("/app");
}
