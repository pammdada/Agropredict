import { count } from "drizzle-orm";
import type { DB } from "./index";
import * as s from "./schema";
import { hashPassword } from "../lib/auth/password";
import { demoEngine } from "../lib/simulation/engine-v0";
import type { SimulationInput } from "../lib/simulation/contract";

export const DEMO_DEFAULT_PASSWORD = "AgroDemo2026";

const DAY = 86_400_000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY);
const hoursFrom = (base: Date, h: number) => new Date(base.getTime() + h * 3_600_000);

export const DEMO_ACCOUNTS = [
  { email: "superadmin@agropredic.pe", name: "Sofía Rojas", role: "SUPERADMIN" },
  { email: "admin@valleica.pe", name: "Carlos Mendoza", role: "ORG_ADMIN · Agroexportadora Valle de Ica" },
  { email: "analista@valleica.pe", name: "Lucía Quispe", role: "ORG_ANALYST · Valle de Ica (también Frutos del Norte)" },
  { email: "admin@frutosdelnorte.pe", name: "Jorge Castillo", role: "ORG_ADMIN · Frutos del Norte" },
] as const;

export async function seedIfEmpty(db: DB): Promise<boolean> {
  const [{ value }] = await db.select({ value: count() }).from(s.organizations);
  if (value > 0) return false;
  await seed(db);
  return true;
}

export async function seed(db: DB): Promise<void> {
  const password = await hashPassword(process.env.SEED_PASSWORD || DEMO_DEFAULT_PASSWORD);

  // ── Plans (example prices in PEN, IGV excluded) ──
  const [piloto, , pro] = await db
    .insert(s.plans)
    .values([
      {
        code: "piloto",
        name: "Piloto",
        description: "Una campaña con 2 o 3 fundos: simulación de rendimiento y alertas.",
        priceCents: 49000,
        sortOrder: 1,
        entitlements: { maxFarms: 3, maxHectares: 300, maxUsers: 3, maxSimulationsPerMonth: 30, coldChain: false, scenarioCompare: false },
      },
      {
        code: "basico",
        name: "Básico",
        description: "Predicción de rendimiento y alertas para toda la operación, cobro por fundo.",
        priceCents: 129000,
        sortOrder: 2,
        entitlements: { maxFarms: 10, maxHectares: 1500, maxUsers: 10, maxSimulationsPerMonth: 200, coldChain: false, scenarioCompare: true },
      },
      {
        code: "pro",
        name: "Pro",
        description: "Todo lo anterior más el monitor de cadena de frío y comparador de escenarios.",
        priceCents: 249000,
        highlighted: true,
        sortOrder: 3,
        entitlements: { maxFarms: -1, maxHectares: -1, maxUsers: 50, maxSimulationsPerMonth: -1, coldChain: true, scenarioCompare: true },
      },
    ])
    .returning();

  // ── Catalog ──
  const [uva, , mango] = await db
    .insert(s.crops)
    .values([
      { code: "uva", name: "Uva de mesa", baseYieldTHa: 19.5 },
      { code: "palta", name: "Palta Hass", baseYieldTHa: 13.8 },
      { code: "mango", name: "Mango Kent", baseYieldTHa: 16.2 },
    ])
    .returning();
  const [ica, piura] = await db
    .insert(s.zones)
    .values([
      { code: "ica", name: "Valle de Ica", region: "Ica" },
      { code: "piura", name: "Valle de San Lorenzo", region: "Piura" },
      { code: "olmos", name: "Olmos", region: "Lambayeque" },
    ])
    .returning();
  const [icaCallao] = await db
    .insert(s.corridors)
    .values([
      { code: "ICA-CALLAO", name: "Ica – Callao", origin: "Ica", destination: "Puerto del Callao", distanceKm: 305, transitHours: 5.5 },
      { code: "PIURA-PAITA", name: "Piura – Paita", origin: "Piura", destination: "Puerto de Paita", distanceKm: 62, transitHours: 1.5 },
    ])
    .returning();

  // ── Organizations ──
  const [valle, norte] = await db
    .insert(s.organizations)
    .values([
      { name: "Agroexportadora Valle de Ica S.A.C.", slug: "valle-de-ica", ruc: "20601234561" },
      { name: "Frutos del Norte S.A.C.", slug: "frutos-del-norte", ruc: "20609876543" },
    ])
    .returning();

  // ── Users (one per role + second-org admin) ──
  const now = new Date();
  const [, adminValle, analyst, adminNorte] = await db
    .insert(s.users)
    .values(
      DEMO_ACCOUNTS.map((a) => ({
        email: a.email,
        name: a.name,
        passwordHash: password,
        isSuperadmin: a.role === "SUPERADMIN",
        emailVerifiedAt: now,
      })),
    )
    .returning();

  await db.insert(s.memberships).values([
    { orgId: valle.id, userId: adminValle.id, role: "ORG_ADMIN" },
    { orgId: valle.id, userId: analyst.id, role: "ORG_ANALYST" },
    { orgId: norte.id, userId: adminNorte.id, role: "ORG_ADMIN" },
    { orgId: norte.id, userId: analyst.id, role: "ORG_ANALYST" },
  ]);

  await db.insert(s.ssoConfigs).values({
    orgId: valle.id,
    issuer: "https://idp.valleica.pe/realms/corporativo",
    clientId: "agropredic-portal",
    clientSecretHint: "••••••••3f9a",
    allowedDomains: ["valleica.pe"],
    defaultRole: "ORG_ANALYST",
  });

  // ── Subscriptions & billing history ──
  await db.insert(s.subscriptions).values([
    {
      orgId: valle.id,
      planId: pro.id,
      status: "active",
      currentPeriodStart: daysAgo(12),
      currentPeriodEnd: daysAgo(-18),
    },
    {
      orgId: norte.id,
      planId: piloto.id,
      status: "trialing",
      trialEndsAt: daysAgo(-9),
      currentPeriodStart: daysAgo(5),
      currentPeriodEnd: daysAgo(-9),
    },
  ]);
  for (let m = 3; m >= 1; m--) {
    const issued = daysAgo(12 + (m - 1) * 30);
    const subtotal = pro.priceCents;
    const igv = Math.round(subtotal * 0.18);
    const [inv] = await db
      .insert(s.invoices)
      .values({
        orgId: valle.id,
        planId: pro.id,
        number: `F001-${String(120 + (3 - m)).padStart(6, "0")}`,
        subtotalCents: subtotal,
        igvCents: igv,
        totalCents: subtotal + igv,
        status: "paid",
        issuedAt: issued,
        paidAt: issued,
      })
      .returning();
    await db.insert(s.payments).values({
      orgId: valle.id,
      invoiceId: inv.id,
      provider: "simulated",
      method: m === 2 ? "yape" : "card",
      amountCents: subtotal + igv,
      status: "approved",
      providerRef: `sim_ch_seed_${m}`,
      detail: m === 2 ? "Yape ••• 512" : "Visa •••• 1111",
      createdAt: issued,
    });
  }

  // ── Farms ──
  const [santaRosa, esperanza, sanJose] = await db
    .insert(s.farms)
    .values([
      { orgId: valle.id, name: "Fundo Santa Rosa", cropId: uva.id, zoneId: ica.id, variety: "Red Globe", hectares: 120, historyYears: 9, latitude: -14.12, longitude: -75.73 },
      { orgId: valle.id, name: "Fundo La Esperanza", cropId: uva.id, zoneId: ica.id, variety: "Sweet Globe", hectares: 85, historyYears: 5, latitude: -14.05, longitude: -75.7 },
      { orgId: valle.id, name: "Fundo San José", cropId: uva.id, zoneId: ica.id, variety: "Autumn Crisp", hectares: 64, historyYears: 2, latitude: -14.21, longitude: -75.68 },
    ])
    .returning();
  const [algarrobo] = await db
    .insert(s.farms)
    .values({ orgId: norte.id, name: "Fundo El Algarrobo", cropId: mango.id, zoneId: piura.id, variety: "Kent", hectares: 70, historyYears: 4 })
    .returning();

  // ── Alert rules ──
  for (const org of [valle, norte]) {
    await db.insert(s.alertRules).values([
      { orgId: org.id, name: "Caída de rendimiento relevante", metric: "yield_drop_pct", threshold: 10, severity: "alta" },
      { orgId: org.id, name: "Caída de rendimiento severa", metric: "yield_drop_pct", threshold: 22, severity: "critica" },
      { orgId: org.id, name: "Merma de cadena de frío", metric: "cold_chain_loss_pct", threshold: 3, severity: "alta" },
      { orgId: org.id, name: "Excursión de temperatura en reefer", metric: "shipment_temp_c", threshold: 4, severity: "critica" },
    ]);
  }

  // ── Simulations, decisions and alerts (history) ──
  const runAndStore = async (
    orgId: string,
    userId: string,
    farm: typeof santaRosa,
    crop: typeof uva,
    zone: typeof ica,
    partial: Pick<SimulationInput, "type" | "climate" | "horizon" | "anomalyIndex">,
    name: string,
    createdAt: Date,
    corridor?: typeof icaCallao,
  ) => {
    const input: SimulationInput = {
      ...partial,
      campaign: "2026-2027",
      farm: { id: farm.id, name: farm.name, hectares: farm.hectares, historyYears: farm.historyYears },
      crop: { code: crop.code, name: crop.name, baseYieldTHa: crop.baseYieldTHa },
      zone: { code: zone.code, name: zone.name },
      corridor: corridor
        ? { code: corridor.code, name: corridor.name, distanceKm: corridor.distanceKm, transitHours: corridor.transitHours }
        : undefined,
    };
    const result = demoEngine.run(input);
    const [sim] = await db
      .insert(s.simulations)
      .values({ orgId, userId, farmId: farm.id, type: input.type, name, input, result, modelVersion: result.modelVersion, createdAt })
      .returning();
    return { sim, result };
  };

  const a = await runAndStore(valle.id, adminValle.id, santaRosa, uva, ica, { type: "YIELD", climate: "nino_strong", horizon: 6 }, "Campaña 26-27 · Niño fuerte", daysAgo(9));
  await runAndStore(valle.id, analyst.id, santaRosa, uva, ica, { type: "YIELD", climate: "neutral", horizon: 6 }, "Campaña 26-27 · Neutro", daysAgo(8));
  const c = await runAndStore(valle.id, analyst.id, esperanza, uva, ica, { type: "YIELD", climate: "nino_moderate", horizon: 6 }, "La Esperanza · Niño moderado", daysAgo(5));
  const d = await runAndStore(valle.id, adminValle.id, santaRosa, uva, ica, { type: "COLD_CHAIN", climate: "nino_moderate", horizon: 7 }, "Despachos semana 42 · Ica–Callao", daysAgo(2), icaCallao);
  await runAndStore(norte.id, adminNorte.id, algarrobo, mango, piura, { type: "YIELD", climate: "nino_moderate", horizon: 6 }, "Algarrobo · Niño moderado", daysAgo(3));

  await db.insert(s.decisions).values([
    {
      orgId: valle.id,
      simulationId: a.sim.id,
      createdBy: adminValle.id,
      title: a.result.actions[0].title,
      detail: a.result.actions[0].detail,
      priority: a.result.actions[0].priority,
      status: "in_progress",
      owner: "Gerencia Comercial",
      dueDate: daysAgo(-10),
      createdAt: daysAgo(9),
    },
    {
      orgId: valle.id,
      simulationId: a.sim.id,
      createdBy: adminValle.id,
      title: a.result.actions[1].title,
      detail: a.result.actions[1].detail,
      priority: a.result.actions[1].priority,
      status: "done",
      owner: "Jefatura de Sanidad",
      dueDate: daysAgo(1),
      createdAt: daysAgo(9),
    },
    {
      orgId: valle.id,
      simulationId: d.sim.id,
      createdBy: analyst.id,
      title: d.result.actions[0].title,
      detail: d.result.actions[0].detail,
      priority: d.result.actions[0].priority,
      status: "planned",
      owner: "Logística",
      dueDate: daysAgo(-3),
      createdAt: daysAgo(2),
    },
  ]);

  await db.insert(s.alerts).values([
    {
      orgId: valle.id,
      farmId: santaRosa.id,
      simulationId: a.sim.id,
      severity: "critica",
      title: "Caída de rendimiento severa en Fundo Santa Rosa",
      message: `El escenario central proyecta ${a.result.scenarios[1].deltaPct}% frente a la campaña base (umbral 22%).`,
      status: "acknowledged",
      createdAt: daysAgo(9),
    },
    {
      orgId: valle.id,
      farmId: esperanza.id,
      simulationId: c.sim.id,
      severity: "alta",
      title: "Caída de rendimiento relevante en Fundo La Esperanza",
      message: `El escenario central proyecta ${c.result.scenarios[1].deltaPct}% frente a la campaña base (umbral 10%).`,
      status: "open",
      createdAt: daysAgo(5),
    },
  ]);

  // ── Shipments on the Ica–Callao corridor ──
  const mkReadings = (start: Date, hours: number, setpoint: number, excursionAt?: number) =>
    Array.from({ length: hours }, (_, h) => {
      const base = setpoint + 0.4 + Math.sin(h / 3) * 0.35;
      const exc = excursionAt !== undefined && h >= excursionAt && h < excursionAt + 3 ? 4.8 - (h - excursionAt) : 0;
      return { t: hoursFrom(start, h).toISOString(), c: Math.round((base + exc) * 10) / 10 };
    });
  const ship = (code: string, status: s.ShipmentStatus, departedHoursAgo: number, farmId: string, excursionAt?: number) => {
    const departed = new Date(Date.now() - departedHoursAgo * 3_600_000);
    const elapsed = Math.max(1, Math.min(30, Math.round(departedHoursAgo)));
    return {
      orgId: valle.id,
      corridorId: icaCallao.id,
      farmId,
      code,
      container: `MSKU${(7_310_000 + code.length * 1371 + departedHoursAgo * 97).toFixed(0)}`,
      pallets: 20,
      status,
      setpointC: 0,
      departedAt: departed,
      etaAt: hoursFrom(departed, 5.5),
      readings: status === "packing" ? [] : mkReadings(departed, elapsed, 0, excursionAt),
    };
  };
  const shipmentRows = await db
    .insert(s.shipments)
    .values([
      ship("VI-26-0418", "in_transit", 3, santaRosa.id, 1),
      ship("VI-26-0417", "in_transit", 2, esperanza.id),
      ship("VI-26-0416", "at_port", 9, santaRosa.id),
      ship("VI-26-0415", "delivered", 30, sanJose.id),
      ship("VI-26-0419", "packing", 0, esperanza.id),
    ])
    .returning();
  await db.insert(s.alerts).values({
    orgId: valle.id,
    farmId: santaRosa.id,
    shipmentId: shipmentRows[0].id,
    severity: "critica",
    title: "Excursión de temperatura en envío VI-26-0418",
    message: "El registrador marcó 5,2 °C durante 2 h en el tramo terrestre Ica – Callao (umbral 4 °C).",
    status: "open",
    createdAt: hoursFrom(new Date(), -2),
  });

  await db.insert(s.auditLog).values([
    { orgId: null, actorUserId: null, action: "platform.seeded", target: "demo", metadata: { note: "Datos demo" } },
    { orgId: valle.id, actorUserId: adminValle.id, action: "subscription.activated", target: "plan:pro", metadata: {} },
  ]);
}
