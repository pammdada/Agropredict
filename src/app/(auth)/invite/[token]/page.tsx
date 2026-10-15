import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { MailWarning } from "lucide-react";
import { getDb, schema } from "@/db";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { getSession } from "@/lib/auth/session";
import { sha256 } from "@/lib/tokens";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Aceptar invitación" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const [row] = await db
    .select({ inv: schema.invitations, org: schema.organizations })
    .from(schema.invitations)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.invitations.orgId))
    .where(
      and(
        eq(schema.invitations.tokenHash, sha256(token)),
        isNull(schema.invitations.acceptedAt),
        isNull(schema.invitations.revokedAt),
        gt(schema.invitations.expiresAt, new Date()),
      ),
    );

  if (!row) {
    return (
      <div className="text-center">
        <MailWarning className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Invitación no disponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">El enlace expiró, ya fue usado o el administrador lo revocó. Pide una nueva invitación.</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Ir a ingresar
        </Link>
      </div>
    );
  }

  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, row.inv.email));
  const session = await getSession();
  return (
    <div>
      <p className="text-sm font-medium text-primary">Invitación</p>
      <h1 className="mt-1 text-3xl font-semibold">Únete a {row.org.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Te invitaron como <strong className="text-foreground">{ROLE_LABELS[row.inv.role]}</strong> con el correo{" "}
        <strong className="text-foreground">{row.inv.email}</strong>. Vence el{" "}
        {row.inv.expiresAt.toLocaleDateString("es-PE", { dateStyle: "long", timeZone: "America/Lima" })}.
      </p>
      <InviteForm token={token} mode={existing ? (session?.user.id === existing.id ? "signed-in" : "existing") : "new"} />
    </div>
  );
}
