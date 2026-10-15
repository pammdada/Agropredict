"use client";

import Link from "next/link";
import { ArrowLeftRight, LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  name,
  email,
  roleLabel,
  profileHref,
  canSwitchOrg,
  logout,
}: {
  name: string;
  email: string;
  roleLabel: string;
  profileHref?: string;
  canSwitchOrg?: boolean;
  logout: () => Promise<void>;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full p-0.5 pr-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Menú de usuario"
      >
        <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{initials}</span>
        <span className="hidden text-sm leading-tight sm:block">
          <span className="block font-medium">{name}</span>
          <span className="block text-xs text-muted-foreground">{roleLabel}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-foreground">{name}</span>
            <span className="block truncate font-normal">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {profileHref && (
          <DropdownMenuItem render={<Link href={profileHref} />}>
            <UserRound /> Perfil y seguridad
          </DropdownMenuItem>
        )}
        {canSwitchOrg && (
          <DropdownMenuItem render={<Link href="/select-org" />}>
            <ArrowLeftRight /> Cambiar de organización
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
