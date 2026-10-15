"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { formObject, runAction, UserError, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/context";

export async function updateOrgAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("org:settings");
    const input = z
      .object({
        name: z.string().trim().min(3, "Ingresa la razón social."),
        ruc: z.string().trim().regex(/^(10|20)\d{9}$/, "El RUC debe tener 11 dígitos y empezar con 10 o 20."),
      })
      .parse(formObject(formData));
    const db = await getDb();
    await db.update(schema.organizations).set(input).where(eq(schema.organizations.id, ctx.org.id));
    await audit({ action: "org.updated", orgId: ctx.org.id, actorUserId: ctx.user.id, metadata: input });
    revalidatePath("/app", "layout");
    return { ok: true, message: "Datos de la organización actualizados." };
  });
}

export async function saveSsoAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("sso:manage");
    const raw = formObject(formData);
    const input = z
      .object({
        issuer: z.string().trim().url("Ingresa la URL del issuer (https://…).").startsWith("https://", "El issuer debe usar HTTPS."),
        clientId: z.string().trim().min(3, "Ingresa el client_id."),
        clientSecret: z.string().optional(),
        allowedDomains: z
          .string()
          .transform((v) =>
            v
              .split(/[,\s]+/)
              .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
              .filter(Boolean),
          )
          .pipe(z.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Dominio inválido.")).min(1, "Agrega al menos un dominio.")),
        defaultRole: z.enum(["ORG_ADMIN", "ORG_ANALYST"]),
        enabled: z.string().optional(),
      })
      .parse(raw);

    const db = await getDb();
    // A domain can only route to one organization's identity provider.
    const others = await db.select().from(schema.ssoConfigs);
    const taken = others.find((c) => c.orgId !== ctx.org.id && c.allowedDomains.some((d) => input.allowedDomains.includes(d)));
    if (taken) throw new UserError("Uno de los dominios ya está vinculado a otra organización.");

    const [current] = await db.select().from(schema.ssoConfigs).where(eq(schema.ssoConfigs.orgId, ctx.org.id));
    if (!current && !input.clientSecret) return { error: "Revisa los campos marcados.", fieldErrors: { clientSecret: "Ingresa el client_secret." } };
    // The secret is never stored in plain text; the demo keeps only a hint of its last 4 characters.
    const clientSecretHint = input.clientSecret ? `••••••••${input.clientSecret.slice(-4)}` : current!.clientSecretHint;
    const values = {
      issuer: input.issuer,
      clientId: input.clientId,
      clientSecretHint,
      allowedDomains: input.allowedDomains,
      defaultRole: input.defaultRole,
      enabled: input.enabled === "on",
    };
    if (current) await db.update(schema.ssoConfigs).set(values).where(eq(schema.ssoConfigs.id, current.id));
    else await db.insert(schema.ssoConfigs).values({ ...values, orgId: ctx.org.id });
    await audit({ action: "sso.configured", orgId: ctx.org.id, actorUserId: ctx.user.id, metadata: { issuer: input.issuer, domains: input.allowedDomains, enabled: values.enabled } });
    revalidatePath("/app/settings");
    return { ok: true, message: "Configuración SSO guardada." };
  });
}

/** Simulated OIDC discovery check (/.well-known/openid-configuration). */
export async function testSsoAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await authorize("sso:manage");
    const issuer = z.string().url().parse(formData.get("issuer"));
    await new Promise((r) => setTimeout(r, 600));
    return {
      ok: true,
      message: `Descubrimiento OIDC simulado correcto: ${issuer.replace(/\/$/, "")}/.well-known/openid-configuration · authorization_endpoint, token_endpoint y jwks_uri encontrados.`,
    };
  });
}
