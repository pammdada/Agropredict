import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listOrganizations } from "@/lib/admin-queries";
import { requireSuperadmin } from "@/lib/auth/context";
import { SUBSCRIPTION_LABELS } from "@/lib/billing/entitlements";
import { fmtDate, fmtNum } from "@/lib/format";

export const metadata: Metadata = { title: "Organizaciones" };

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSuperadmin();
  const { q = "" } = await searchParams;
  const all = await listOrganizations();
  const term = q.trim().toLowerCase();
  const orgs = term ? all.filter((o) => o.org.name.toLowerCase().includes(term) || (o.org.ruc ?? "").includes(term)) : all;

  return (
    <>
      <PageHeader title="Organizaciones" description="Empresas cliente de la plataforma. Suspende, reactiva o revisa en modo solo lectura." />
      <form className="mb-4 max-w-sm">
        <label htmlFor="q" className="sr-only">
          Buscar organización
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Buscar por razón social o RUC…"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </form>
      <Card>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organización</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Suscripción</TableHead>
                <TableHead className="text-right">Usuarios</TableHead>
                <TableHead className="text-right">Fundos / ha</TableHead>
                <TableHead className="text-right">Simulaciones 30 d</TableHead>
                <TableHead>Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((o) => (
                <TableRow key={o.org.id}>
                  <TableCell>
                    <Link href={`/admin/organizations/${o.org.id}`} className="font-medium hover:text-primary hover:underline">
                      {o.org.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">RUC {o.org.ruc ?? "—"}</p>
                  </TableCell>
                  <TableCell>{o.plan.name}</TableCell>
                  <TableCell>
                    {o.org.status === "suspended" ? (
                      <StatusPill tone="bad">Org. suspendida</StatusPill>
                    ) : (
                      <StatusPill tone={o.sub.status === "active" ? "good" : o.sub.status === "trialing" ? "info" : "warn"}>{SUBSCRIPTION_LABELS[o.sub.status]}</StatusPill>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{o.members}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.farms} / {fmtNum(o.hectares, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{o.simulations30d}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(o.org.createdAt)}</TableCell>
                </TableRow>
              ))}
              {orgs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Sin resultados para “{q}”.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
