import type { Metadata } from "next";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { MonitorSmartphone } from "lucide-react";
import { getDb, schema } from "@/db";
import { PageHeader } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMemberships, requireOrgContext } from "@/lib/auth/context";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { fmtDateTime } from "@/lib/format";
import { PasswordForm, ProfileForm, RevokeSessionButton } from "./profile-forms";

export const metadata: Metadata = { title: "Perfil y seguridad" };

const METHOD_LABELS: Record<string, string> = {
  password: "Correo y contraseña",
  google: "Google",
  microsoft: "Microsoft",
  sso: "SSO corporativo",
  invitation: "Invitación",
  register: "Registro",
};

export default async function ProfilePage() {
  const ctx = await requireOrgContext();
  const db = await getDb();
  const sessions = await db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, ctx.user.id), isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, new Date())))
    .orderBy(desc(schema.sessions.createdAt));
  const memberships = await getMemberships(ctx.user.id);

  return (
    <>
      <PageHeader title="Perfil y seguridad" description="Tus datos personales, contraseña y sesiones abiertas." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos personales</CardTitle>
            <CardDescription>El correo identifica tu cuenta y no puede cambiarse.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm name={ctx.user.name} email={ctx.user.email} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{ctx.user.passwordHash ? "Cambiar contraseña" : "Crear contraseña"}</CardTitle>
            <CardDescription>Contraseñas guardadas con argon2id. Mínimo 10 caracteres, con letras y números.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm hasPassword={Boolean(ctx.user.passwordHash)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sesiones activas</CardTitle>
            <CardDescription>Cierra las sesiones que no reconozcas.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-3 text-sm">
                  <MonitorSmartphone className="size-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {METHOD_LABELS[s.authMethod] ?? s.authMethod}
                      {s.id === ctx.session.id && <span className="ml-2 text-xs font-semibold text-success">Esta sesión</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">Inicio: {fmtDateTime(s.createdAt)} · vence {fmtDateTime(s.expiresAt)}</p>
                  </div>
                  {s.id !== ctx.session.id && <RevokeSessionButton sessionId={s.id} />}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mis organizaciones</CardTitle>
            <CardDescription>Tu rol se define en cada organización.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {memberships.map((m) => (
                <li key={m.org.id} className="flex justify-between py-2.5">
                  <span>{m.org.name}</span>
                  <span className="text-muted-foreground">{ROLE_LABELS[m.membership.role]}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
