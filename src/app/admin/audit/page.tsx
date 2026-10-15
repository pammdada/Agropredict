import type { Metadata } from "next";
import { and, desc, eq, like, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { PageHeader } from "@/components/page";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSuperadmin } from "@/lib/auth/context";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoría" };

const CATEGORIES = [
  { value: "", label: "Todas las acciones" },
  { value: "auth.", label: "Autenticación" },
  { value: "admin.", label: "Superadmin" },
  { value: "billing.", label: "Pagos" },
  { value: "simulation.", label: "Simulaciones" },
  { value: "decision.", label: "Decisiones" },
  { value: "invitation.", label: "Invitaciones" },
  { value: "sso.", label: "SSO" },
];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ org?: string; cat?: string }> }) {
  await requireSuperadmin();
  const sp = await searchParams;
  const db = await getDb();
  const orgs = await db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations);
  const where: SQL[] = [];
  if (sp.org && orgs.some((o) => o.id === sp.org)) where.push(eq(schema.auditLog.orgId, sp.org));
  if (sp.cat && CATEGORIES.some((c) => c.value === sp.cat)) where.push(like(schema.auditLog.action, `${sp.cat}%`));
  const rows = await db
    .select({ a: schema.auditLog, actor: schema.users.email, org: schema.organizations.name })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorUserId))
    .leftJoin(schema.organizations, eq(schema.organizations.id, schema.auditLog.orgId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(300);

  return (
    <>
      <PageHeader title="Auditoría y eventos" description="Registro inmutable de eventos de seguridad y administración (últimos 300)." />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <NativeSelect name="org" defaultValue={sp.org ?? ""} aria-label="Organización" className="w-64">
          <option value="">Todas las organizaciones</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="cat" defaultValue={sp.cat ?? ""} aria-label="Categoría" className="w-52">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>
      <Card>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Organización</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ a, actor, org }) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDateTime(a.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{a.action}</TableCell>
                  <TableCell className="text-xs">{actor ?? "sistema"}</TableCell>
                  <TableCell className="text-xs">{org ?? "—"}</TableCell>
                  <TableCell className="max-w-40 truncate font-mono text-xs text-muted-foreground">{a.target ?? "—"}</TableCell>
                  <TableCell className="max-w-72 truncate font-mono text-[11px] text-muted-foreground">
                    {Object.keys(a.metadata).length ? JSON.stringify(a.metadata) : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
