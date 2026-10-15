import type { Metadata } from "next";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { PageHeader, StatusPill } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOrgContext } from "@/lib/auth/context";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { InviteForm, MemberControls, RevokeInvite } from "./team-controls";

export const metadata: Metadata = { title: "Equipo" };

export default async function TeamPage() {
  const ctx = await requireOrgContext("team:manage");
  const db = await getDb();
  const members = await db
    .select({ m: schema.memberships, u: schema.users })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.orgId, ctx.org.id), isNull(schema.memberships.deletedAt)))
    .orderBy(schema.users.name);
  const invites = await db
    .select()
    .from(schema.invitations)
    .where(
      and(
        eq(schema.invitations.orgId, ctx.org.id),
        isNull(schema.invitations.acceptedAt),
        isNull(schema.invitations.revokedAt),
        gt(schema.invitations.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(schema.invitations.createdAt));
  const limit = ctx.entitlements.maxUsers;

  return (
    <>
      <PageHeader title="Equipo" description={`${members.length} ${limit === -1 ? "miembros" : `de ${limit} usuarios de tu plan`}. Los roles se validan en el servidor en cada acción.`} />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Miembros</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead>Último ingreso</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="sr-only">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(({ m, u }) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-medium">
                        {u.name} {u.id === ctx.user.id && <span className="text-xs text-muted-foreground">(tú)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmtDateTime(u.lastLoginAt)}</TableCell>
                    <TableCell colSpan={2}>
                      {u.id === ctx.user.id ? (
                        <span className="text-sm">{ROLE_LABELS[m.role]}</span>
                      ) : (
                        <MemberControls membershipId={m.id} role={m.role} name={u.name} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Invitar a una persona</CardTitle>
              <CardDescription>Recibirá un enlace de un solo uso, válido por 7 días.</CardDescription>
            </CardHeader>
            <CardContent>
              <InviteForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Invitaciones pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              {invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p>
              ) : (
                <ul className="divide-y">
                  {invites.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{i.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_LABELS[i.role]} · vence {fmtDate(i.expiresAt)}
                        </p>
                      </div>
                      <StatusPill tone="warn">Pendiente</StatusPill>
                      <RevokeInvite id={i.id} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
