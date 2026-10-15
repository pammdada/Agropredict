import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { audit, track } from "@/lib/audit";
import type { OrgContext } from "@/lib/auth/context";
import { assertEntitlement } from "@/lib/billing/entitlements";
import { UserError } from "@/lib/actions";
import type { ClimateScenario, SimulationInput, SimulationKind, SimulationResult } from "./contract";
import { CLIMATE_LABELS } from "./contract";
import { demoEngine } from "./engine-v0";

/** The engine is injected here; swapping in the APF3 model only changes this line. */
const engine = demoEngine;

export type RunParams = {
  type: SimulationKind;
  farmId: string;
  corridorId?: string;
  campaign: string;
  climate: ClimateScenario;
  anomalyIndex?: number;
  horizon: number;
  name?: string;
};

export async function runSimulation(ctx: OrgContext, params: RunParams) {
  const db = await getDb();
  await assertEntitlement(ctx.org.id, ctx.entitlements, { kind: "simulation", type: params.type });

  const [row] = await db
    .select({ farm: schema.farms, crop: schema.crops, zone: schema.zones })
    .from(schema.farms)
    .innerJoin(schema.crops, eq(schema.crops.id, schema.farms.cropId))
    .innerJoin(schema.zones, eq(schema.zones.id, schema.farms.zoneId))
    .where(and(eq(schema.farms.id, params.farmId), eq(schema.farms.orgId, ctx.org.id), isNull(schema.farms.deletedAt)));
  if (!row) throw new UserError("El fundo no existe en tu organización.");

  let corridor: typeof schema.corridors.$inferSelect | undefined;
  if (params.type === "COLD_CHAIN") {
    [corridor] = await db.select().from(schema.corridors).where(eq(schema.corridors.id, params.corridorId ?? ""));
    if (!corridor) throw new UserError("Selecciona un corredor logístico.");
  }

  const input: SimulationInput = {
    type: params.type,
    farm: { id: row.farm.id, name: row.farm.name, hectares: row.farm.hectares, historyYears: row.farm.historyYears },
    crop: { code: row.crop.code, name: row.crop.name, baseYieldTHa: row.crop.baseYieldTHa },
    zone: { code: row.zone.code, name: row.zone.name },
    corridor: corridor && { code: corridor.code, name: corridor.name, distanceKm: corridor.distanceKm, transitHours: corridor.transitHours },
    campaign: params.campaign,
    climate: params.climate,
    anomalyIndex: params.climate === "custom" ? params.anomalyIndex : undefined,
    horizon: params.horizon,
  };
  const result = engine.run(input);
  const name =
    params.name?.trim() ||
    `${row.farm.name} · ${params.type === "YIELD" ? "Rendimiento" : `Frío ${corridor?.name}`} · ${CLIMATE_LABELS[params.climate]}`;

  const [{ previous }] = await db.select({ previous: count() }).from(schema.simulations).where(eq(schema.simulations.orgId, ctx.org.id));
  const [sim] = await db
    .insert(schema.simulations)
    .values({ orgId: ctx.org.id, userId: ctx.user.id, farmId: row.farm.id, type: params.type, name, input, result, modelVersion: result.modelVersion })
    .returning();

  // Domain event simulation.completed → alert evaluation + product analytics.
  await evaluateAlertRules(ctx.org.id, sim.id, row.farm.id, row.farm.name, params.type, result);
  await track("simulation.completed", ctx.org.id, ctx.user.id, { type: params.type, climate: params.climate, first: previous === 0 });
  await audit({ action: "simulation.completed", orgId: ctx.org.id, actorUserId: ctx.user.id, target: sim.id });
  return sim;
}

async function evaluateAlertRules(
  orgId: string,
  simulationId: string,
  farmId: string,
  farmName: string,
  type: SimulationKind,
  result: SimulationResult,
) {
  const db = await getDb();
  const rules = await db.select().from(schema.alertRules).where(and(eq(schema.alertRules.orgId, orgId), eq(schema.alertRules.enabled, true)));
  const central = result.scenarios[1];
  const metricValue = type === "YIELD" ? -central.deltaPct : central.value;
  const metric = type === "YIELD" ? "yield_drop_pct" : "cold_chain_loss_pct";
  // Only the most severe matching rule fires, so one simulation yields at most one alert.
  const order = { critica: 0, alta: 1, media: 2 } as const;
  const hit = rules
    .filter((r) => r.metric === metric && metricValue >= r.threshold)
    .sort((a, b) => order[a.severity] - order[b.severity])[0];
  if (!hit) return null;
  const fmt = (n: number) => n.toLocaleString("es-PE", { maximumFractionDigits: 1 });
  const [alert] = await db
    .insert(schema.alerts)
    .values({
      orgId,
      ruleId: hit.id,
      farmId,
      simulationId,
      severity: hit.severity,
      title: `${hit.name} en ${farmName}`,
      message:
        type === "YIELD"
          ? `El escenario central proyecta ${fmt(central.deltaPct)} % frente a la campaña base (umbral ${fmt(hit.threshold)} %).`
          : `La merma central estimada es ${fmt(central.value)} % por envío (umbral ${fmt(hit.threshold)} %).`,
    })
    .returning();
  await track("alert.triggered", orgId, null, { severity: hit.severity, metric });
  return alert;
}
