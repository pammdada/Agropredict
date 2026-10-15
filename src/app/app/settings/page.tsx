import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { PageHeader } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/context";
import { OrgForm, SsoForm } from "./settings-forms";

export const metadata: Metadata = { title: "Organización y SSO" };

export default async function SettingsPage() {
  const ctx = await requireOrgContext("org:settings");
  const db = await getDb();
  const [sso] = await db.select().from(schema.ssoConfigs).where(eq(schema.ssoConfigs.orgId, ctx.org.id));

  return (
    <>
      <PageHeader title="Organización y SSO" description="Datos de la empresa y el inicio de sesión único con el proveedor de identidad corporativo." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Datos de la empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <OrgForm name={ctx.org.name} ruc={ctx.org.ruc ?? ""} slug={ctx.org.slug} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>SSO empresarial (OpenID Connect)</CardTitle>
            <CardDescription>
              Las personas con correo de los dominios permitidos podrán ingresar con “SSO de mi empresa”. En su primer ingreso se crean
              automáticamente (JIT) con el rol por defecto. SAML queda fuera del MVP.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SsoForm
              config={
                sso
                  ? {
                      issuer: sso.issuer,
                      clientId: sso.clientId,
                      clientSecretHint: sso.clientSecretHint,
                      allowedDomains: sso.allowedDomains.join(", "),
                      defaultRole: sso.defaultRole,
                      enabled: sso.enabled,
                    }
                  : null
              }
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
