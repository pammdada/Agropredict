import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Plus, Sprout } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireOrgContext } from "@/lib/auth/context";
import { getUsage } from "@/lib/billing/entitlements";
import { fmtNum } from "@/lib/format";
import { listFarms, listSimulations } from "@/lib/queries";
import type { SimulationResult } from "@/lib/simulation/contract";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Fundos" };

export default async function FarmsPage() {
  const ctx = await requireOrgContext("farm:read");
  const [farms, usage, sims] = await Promise.all([listFarms(ctx.org.id), getUsage(ctx.org.id), listSimulations(ctx.org.id)]);
  const lastYield = new Map<string, SimulationResult>();
  for (const { sim } of sims) if (sim.type === "YIELD" && !lastYield.has(sim.farmId)) lastYield.set(sim.farmId, sim.result as SimulationResult);
  const limit = ctx.entitlements.maxFarms;

  return (
    <>
      <PageHeader
        title="Fundos"
        description={`${usage.farms} ${limit === -1 ? "fundos" : `de ${limit} fundos`} · ${fmtNum(usage.hectares, 0)} ha${ctx.entitlements.maxHectares === -1 ? "" : ` de ${fmtNum(ctx.entitlements.maxHectares, 0)} ha`} de tu plan`}
        actions={
          ctx.can("farm:write") && (
            <Button render={<Link href="/app/farms/new" />} nativeButton={false}>
              <Plus /> Nuevo fundo
            </Button>
          )
        }
      />
      {farms.length === 0 ? (
        <EmptyState
          icon={<Sprout />}
          title="Aún no registras fundos"
          description="Registra tu primer fundo para correr simulaciones de rendimiento."
          action={ctx.can("farm:write") && <Button render={<Link href="/app/farms/new" />} nativeButton={false}>Registrar fundo</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {farms.map(({ farm, crop, zone }) => {
            const r = lastYield.get(farm.id);
            const delta = r?.scenarios[1].deltaPct;
            return (
              <Link
                key={farm.id}
                href={`/app/farms/${farm.id}`}
                className="group rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition hover:shadow-md hover:ring-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold group-hover:text-primary">{farm.name}</h2>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {zone.name}, {zone.region}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">{crop.name}</span>
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Hectáreas</dt>
                    <dd className="font-semibold tabular-nums">{fmtNum(farm.hectares)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Variedad</dt>
                    <dd className="truncate font-semibold">{farm.variety ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Último riesgo</dt>
                    <dd className={cn("font-semibold tabular-nums", delta === undefined ? "text-muted-foreground" : delta <= -15 ? "text-critical" : delta <= -5 ? "text-[oklch(0.55_0.13_65)]" : "text-success")}>
                      {delta === undefined ? "Sin datos" : `${fmtNum(delta)} %`}
                    </dd>
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
