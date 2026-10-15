import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Upsell({ title, description, canManageBilling }: { title: string; description: string; canManageBilling: boolean }) {
  return (
    <div className="bg-field-pattern flex flex-col items-start gap-4 rounded-2xl bg-sidebar p-8 text-sidebar-foreground sm:p-10">
      <span className="grid size-11 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
        <Lock className="size-5" />
      </span>
      <div>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-2 max-w-xl text-sm text-sidebar-foreground/85">{description}</p>
      </div>
      {canManageBilling ? (
        <Button variant="secondary" render={<Link href="/app/billing/checkout?plan=pro" />} nativeButton={false}>
          Cambiar al plan Pro
        </Button>
      ) : (
        <p className="text-sm text-sidebar-foreground/70">Pide al administrador de tu organización que cambie al plan Pro.</p>
      )}
    </div>
  );
}
