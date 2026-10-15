import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sprout } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireOrgContext } from "@/lib/auth/context";
import { getCatalogOptions, listFarms } from "@/lib/queries";
import { Wizard } from "./wizard";

export const metadata: Metadata = { title: "Nueva simulación" };

export default async function NewSimulationPage({ searchParams }: { searchParams: Promise<{ farm?: string; type?: string }> }) {
  const ctx = await requireOrgContext("simulation:run");
  const sp = await searchParams;
  const [farms, { corridors }] = await Promise.all([listFarms(ctx.org.id), getCatalogOptions()]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={
          <Link href="/app/simulations" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" /> Simulaciones
          </Link>
        }
        title="Nueva simulación"
        description="Tres pasos: qué simular, bajo qué escenario y confirmar."
      />
      {ctx.frozenReason ? (
        <EmptyState title="No puedes simular por ahora" description={ctx.frozenReason} />
      ) : farms.length === 0 ? (
        <EmptyState
          icon={<Sprout />}
          title="Primero registra un fundo"
          action={<Button render={<Link href="/app/farms/new" />} nativeButton={false}>Registrar fundo</Button>}
        />
      ) : (
        <Wizard
          farms={farms.map(({ farm, crop, zone }) => ({
            id: farm.id,
            label: farm.name,
            detail: `${crop.name} · ${farm.hectares} ha · ${zone.name}`,
            historyYears: farm.historyYears,
          }))}
          corridors={corridors.map((c) => ({ id: c.id, label: c.name, detail: `${c.distanceKm} km · ${c.transitHours} h de tránsito` }))}
          coldChainEnabled={ctx.entitlements.coldChain}
          defaultFarm={sp.farm}
          defaultType={sp.type === "COLD_CHAIN" ? "COLD_CHAIN" : "YIELD"}
        />
      )}
    </div>
  );
}
