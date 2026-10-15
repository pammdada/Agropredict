import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { Eye, Lock } from "lucide-react";
import { getDb, schema } from "@/db";
import { MobileNav, Sidebar, type NavSection } from "@/components/app-nav";
import { DemoBadge } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { getMemberships, requireOrgContext } from "@/lib/auth/context";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { SUBSCRIPTION_LABELS } from "@/lib/billing/entitlements";
import { logoutAction } from "@/app/(auth)/actions";
import { stopImpersonationAction } from "@/app/admin/actions";

export default async function OrgLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext();
  const db = await getDb();
  const [{ openAlerts }] = await db
    .select({ openAlerts: count() })
    .from(schema.alerts)
    .where(and(eq(schema.alerts.orgId, ctx.org.id), eq(schema.alerts.status, "open")));
  const memberships = ctx.impersonating ? [] : await getMemberships(ctx.user.id);

  const sections: NavSection[] = [
    {
      items: [
        { href: "/app", label: "Dashboard", icon: "dashboard" },
        { href: "/app/farms", label: "Fundos", icon: "farms" },
        { href: "/app/simulations", label: "Simulaciones", icon: "simulations" },
        { href: "/app/compare", label: "Comparador", icon: "compare", locked: !ctx.entitlements.scenarioCompare },
        { href: "/app/decisions", label: "Decisiones", icon: "decisions" },
        { href: "/app/alerts", label: "Alertas", icon: "alerts", badge: openAlerts },
        { href: "/app/cold-chain", label: "Cadena de frío", icon: "coldchain", locked: !ctx.entitlements.coldChain },
      ],
    },
  ];
  const adminItems: NavSection["items"] = [];
  if (ctx.role === "ORG_ADMIN" || ctx.impersonating) {
    if (!ctx.impersonating) adminItems.push({ href: "/app/team", label: "Equipo", icon: "team" });
    if (!ctx.impersonating) adminItems.push({ href: "/app/settings", label: "Organización y SSO", icon: "settings" });
    adminItems.push({ href: "/app/billing", label: "Facturación", icon: "billing" });
  }
  if (adminItems.length) sections.push({ title: "Administración", items: adminItems });

  const roleLabel = ROLE_LABELS[ctx.role];

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        sections={sections}
        homeHref="/app"
        footer={
          <div className="rounded-lg bg-sidebar-accent p-3 text-xs">
            <p className="font-semibold text-sidebar-accent-foreground">Plan {ctx.plan.name}</p>
            <p className="text-sidebar-foreground/70">{SUBSCRIPTION_LABELS[ctx.subscription.status]}</p>
          </div>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {ctx.impersonating && (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-chart-4 px-4 py-2 text-sm text-white" role="status">
            <span className="flex items-center gap-2">
              <Eye className="size-4" /> Estás viendo <strong>{ctx.org.name}</strong> como Superadmin en modo solo lectura. Motivo: “
              {ctx.session.impersonationReason}”
            </span>
            <form action={stopImpersonationAction}>
              <Button type="submit" size="xs" variant="secondary">
                Salir de la vista
              </Button>
            </form>
          </div>
        )}
        {ctx.frozenReason && !ctx.impersonating && (
          <div className="flex items-center justify-center gap-2 bg-critical/10 px-4 py-2 text-center text-sm text-critical" role="alert">
            <Lock className="size-4 shrink-0" /> {ctx.frozenReason}
            {ctx.role === "ORG_ADMIN" && ctx.org.status !== "suspended" && (
              <Link href="/app/billing" className="font-semibold underline">
                Ir a facturación
              </Link>
            )}
          </div>
        )}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <MobileNav sections={sections} homeHref="/app" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{ctx.org.name}</p>
          </div>
          <DemoBadge className="hidden sm:inline-flex" />
          <UserMenu
            name={ctx.user.name}
            email={ctx.user.email}
            roleLabel={roleLabel}
            profileHref={ctx.impersonating ? undefined : "/app/profile"}
            canSwitchOrg={memberships.length > 1}
            logout={logoutAction}
          />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
