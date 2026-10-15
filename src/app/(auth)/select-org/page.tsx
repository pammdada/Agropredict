import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { Building2, ChevronRight, LogOut } from "lucide-react";
import { getDb, schema } from "@/db";
import { Button } from "@/components/ui/button";
import { getMemberships, requireUser } from "@/lib/auth/context";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { logoutAction, selectOrgAction } from "../actions";

export const metadata: Metadata = { title: "Elige tu organización" };

export default async function SelectOrgPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, session } = await requireUser();
  if (user.isSuperadmin) redirect("/admin");
  const { error } = await searchParams;
  const memberships = await getMemberships(user.id);
  const db = await getDb();
  const orgIds = memberships.map((m) => m.org.id);
  const subs = orgIds.length
    ? await db
        .select({ orgId: schema.subscriptions.orgId, plan: schema.plans.name })
        .from(schema.subscriptions)
        .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
        .where(inArray(schema.subscriptions.orgId, orgIds))
    : [];

  return (
    <div>
      <p className="text-sm text-muted-foreground">Hola, {user.name.split(" ")[0]}</p>
      <h1 className="mt-1 text-3xl font-semibold">Elige tu organización</h1>
      {error && <p className="mt-3 text-sm text-destructive">No perteneces a esa organización.</p>}
      {memberships.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-6 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Aún no perteneces a ninguna organización</p>
          <p className="mt-1 text-sm text-muted-foreground">Pide una invitación al administrador de tu empresa o registra una nueva.</p>
          <Button className="mt-4" render={<Link href="/register" />} nativeButton={false}>
            Registrar empresa
          </Button>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3">
          {memberships.map(({ org, membership }) => (
            <li key={org.id}>
              <form action={selectOrgAction}>
                <input type="hidden" name="orgId" value={org.id} />
                <button
                  type="submit"
                  className="group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="grid size-11 place-items-center rounded-lg bg-secondary font-semibold text-secondary-foreground">
                    {org.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">{org.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABELS[membership.role]} · Plan {subs.find((s) => s.orgId === org.id)?.plan ?? "—"}
                      {org.status === "suspended" && " · Suspendida"}
                      {session.activeOrgId === org.id && " · Actual"}
                    </span>
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={logoutAction} className="mt-8">
        <Button type="submit" variant="ghost" size="sm">
          <LogOut /> Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
