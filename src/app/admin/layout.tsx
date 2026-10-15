import { ShieldCheck } from "lucide-react";
import { MobileNav, Sidebar, type NavSection } from "@/components/app-nav";
import { UserMenu } from "@/components/user-menu";
import { requireSuperadmin } from "@/lib/auth/context";
import { logoutAction } from "@/app/(auth)/actions";

const sections: NavSection[] = [
  {
    title: "Plataforma",
    items: [
      { href: "/admin", label: "Dashboard", icon: "platform" },
      { href: "/admin/organizations", label: "Organizaciones", icon: "orgs" },
      { href: "/admin/plans", label: "Planes y precios", icon: "plans" },
      { href: "/admin/subscriptions", label: "Suscripciones", icon: "billing" },
      { href: "/admin/audit", label: "Auditoría", icon: "audit" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSuperadmin();
  return (
    <div className="flex min-h-dvh">
      <Sidebar
        sections={sections}
        homeHref="/admin"
        footer={
          <p className="flex items-center gap-2 rounded-lg bg-sidebar-accent p-3 text-xs text-sidebar-foreground/80">
            <ShieldCheck className="size-4 text-sidebar-primary" /> Área Superadmin. Todas las acciones quedan en auditoría.
          </p>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <MobileNav sections={sections} homeHref="/admin" />
          <p className="flex-1 text-sm font-semibold">AgroPredic · Plataforma</p>
          <UserMenu name={user.name} email={user.email} roleLabel="Superadmin" logout={logoutAction} />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
