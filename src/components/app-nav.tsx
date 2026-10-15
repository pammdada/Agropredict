"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  FlaskConical,
  GitCompareArrows,
  LayoutDashboard,
  Menu,
  ScrollText,
  Settings,
  Snowflake,
  Sprout,
  Users,
  Layers,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  farms: Sprout,
  simulations: FlaskConical,
  compare: GitCompareArrows,
  decisions: ClipboardCheck,
  alerts: Bell,
  coldchain: Snowflake,
  team: Users,
  settings: Settings,
  billing: CircleDollarSign,
  platform: BarChart3,
  orgs: Building2,
  plans: Layers,
  audit: ScrollText,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; locked?: boolean };
export type NavSection = { title?: string; items: NavItem[] };

function NavList({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-6" aria-label="Navegación principal">
      {sections.map((section, i) => (
        <div key={i} className="grid gap-0.5">
          {section.title && <p className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">{section.title}</p>}
          {section.items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = item.href === "/app" || item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--sidebar-primary)]",
                )}
              >
                <Icon className={cn("size-4", active && "text-sidebar-primary")} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.locked && <span className="rounded bg-sidebar-primary/20 px-1.5 text-[10px] font-semibold text-sidebar-primary">PRO</span>}
                {!!item.badge && <span className="rounded-full bg-sidebar-primary px-1.5 text-[11px] font-bold text-sidebar-primary-foreground">{item.badge}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ sections, homeHref, footer }: { sections: NavSection[]; homeHref: string; footer?: React.ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 overflow-y-auto bg-sidebar px-3 py-5 text-sidebar-foreground lg:flex">
      <Logo inverted href={homeHref} className="px-3" />
      <NavList sections={sections} />
      {footer && <div className="mt-auto px-3">{footer}</div>}
    </aside>
  );
}

export function MobileNav({ sections, homeHref }: { sections: NavSection[]; homeHref: string }) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" />}>
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-4 text-sidebar-foreground">
        <SheetTitle className="sr-only">Menú</SheetTitle>
        <Logo inverted href={homeHref} className="mb-6 px-3" />
        <NavList sections={sections} />
      </SheetContent>
    </Sheet>
  );
}
