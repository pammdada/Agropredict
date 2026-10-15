import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { getDb, schema } from "@/db";
import { ProviderForm } from "./provider-form";

export const metadata: Metadata = { title: "Proveedor de identidad de prueba" };

const PROVIDERS = {
  google: { name: "Google", color: "#1a73e8", suggestions: ["analista@valleica.pe", "nuevo.usuario@gmail.com"] },
  microsoft: { name: "Microsoft", color: "#2f2f2f", suggestions: ["admin@frutosdelnorte.pe", "consultor@outlook.com"] },
  sso: { name: "SSO corporativo (OIDC)", color: "#14532d", suggestions: [] as string[] },
} as const;

export default async function ProviderPage({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{ state?: string; org?: string; login_hint?: string; code_challenge?: string }>;
}) {
  const { provider } = await params;
  const sp = await searchParams;
  if (!(provider in PROVIDERS) || !sp.state) notFound();
  const meta = PROVIDERS[provider as keyof typeof PROVIDERS];

  let issuer: string | null = null;
  let orgName: string | null = null;
  if (provider === "sso" && sp.org) {
    const db = await getDb();
    const [row] = await db
      .select({ issuer: schema.ssoConfigs.issuer, name: schema.organizations.name })
      .from(schema.ssoConfigs)
      .innerJoin(schema.organizations, eq(schema.organizations.id, schema.ssoConfigs.orgId))
      .where(eq(schema.ssoConfigs.orgId, sp.org));
    if (!row) notFound();
    issuer = row.issuer;
    orgName = row.name;
  }

  return (
    <div className="min-h-dvh bg-[#f1f3f4]">
      <div className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900">
        Proveedor de identidad de PRUEBA: simula el paso de autorización de OAuth 2.0 / OIDC (Authorization Code + PKCE). No se contacta a {meta.name}.
      </div>
      <main className="mx-auto mt-12 max-w-md px-4">
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: meta.color }}>
            <ShieldCheck className="size-5" /> {meta.name}
          </div>
          <h1 className="mt-6 font-sans text-2xl font-normal tracking-normal text-neutral-900">Acceder</h1>
          <p className="mt-1 text-sm text-neutral-600">
            para continuar a <strong>AgroPredic</strong>
            {orgName && <> · {orgName}</>}
          </p>
          {issuer && <p className="mt-2 truncate font-mono text-[11px] text-neutral-500">issuer: {issuer}</p>}
          <ProviderForm provider={provider} state={sp.state} org={sp.org} loginHint={sp.login_hint} suggestions={[...meta.suggestions]} />
          <p className="mt-6 text-[11px] text-neutral-500">
            code_challenge (S256): <span className="font-mono">{sp.code_challenge?.slice(0, 16)}…</span>
          </p>
        </div>
      </main>
    </div>
  );
}
