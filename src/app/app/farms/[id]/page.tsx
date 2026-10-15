import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { getDb, schema } from "@/db";
import { PageHeader, StatCard } from "@/components/page";
import { SimulationsTable } from "@/components/simulations-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/context";
import { fmtNum } from "@/lib/format";
import { getCatalogOptions, listSimulations } from "@/lib/queries";
import { FarmForm } from "../farm-form";
import { DeleteFarmButton } from "./delete-farm";

export const metadata: Metadata = { title: "Fundo" };

export default async function FarmDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const ctx = await requireOrgContext("farm:read");
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await getDb();
  const [row] = await db
    .select({ farm: schema.farms, crop: schema.crops, zone: schema.zones })
    .from(schema.farms)
    .innerJoin(schema.crops, eq(schema.crops.id, schema.farms.cropId))
    .innerJoin(schema.zones, eq(schema.zones.id, schema.farms.zoneId))
    .where(and(eq(schema.farms.id, id), eq(schema.farms.orgId, ctx.org.id), isNull(schema.farms.deletedAt)));
  if (!row) notFound();
  const { crops, zones } = await getCatalogOptions();
  const sims = await listSimulations(ctx.org.id, { farmId: id });
  const { farm, crop, zone } = row;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/app/farms" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" /> Fundos
          </Link>
        }
        title={farm.name}
        description={`${crop.name}${farm.variety ? ` ${farm.variety}` : ""} · ${zone.name}, ${zone.region}`}
        actions={
          ctx.can("simulation:run") && (
            <Button render={<Link href={`/app/simulations/new?farm=${farm.id}`} />} nativeButton={false}>
              <FlaskConical /> Simular este fundo
            </Button>
          )
        }
      />
      {created && <p className="mb-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">Fundo creado. Ya puedes correr su primera simulación.</p>}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Hectáreas productivas" value={fmtNum(farm.hectares)} />
        <StatCard label="Años de historial" value={farm.historyYears} hint={farm.historyYears >= 6 ? "Confianza alta" : farm.historyYears >= 3 ? "Confianza media" : "Confianza baja"} />
        <StatCard label="Simulaciones" value={sims.length} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Datos del fundo</CardTitle>
            <CardDescription>{ctx.can("farm:write") ? "Edita la información productiva." : "Solo lectura para tu rol."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <FarmForm
              farm={farm}
              disabled={!ctx.can("farm:write")}
              crops={crops.map((c) => ({ value: c.id, label: c.name }))}
              zones={zones.map((z) => ({ value: z.id, label: `${z.name} (${z.region})` }))}
            />
            {ctx.can("farm:delete") && <DeleteFarmButton id={farm.id} name={farm.name} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Simulaciones del fundo</CardTitle>
          </CardHeader>
          <CardContent>
            <SimulationsTable rows={sims} compact />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
