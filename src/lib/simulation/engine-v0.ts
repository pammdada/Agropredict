import type {
  ClimateScenario,
  Factor,
  RecommendedAction,
  ScenarioOutcome,
  SimulationEngine,
  SimulationInput,
  SimulationResult,
} from "./contract";

/**
 * Demo engine v0: deterministic and parametric. Same input → same numbers.
 * It is NOT a trained model; every output is labelled dataQuality = "demo".
 */
export const MODEL_VERSION = "agropredic-demo-v0.3.0";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Equivalent sea-surface temperature anomaly (°C) per climate scenario. */
function anomalyOf(climate: ClimateScenario, custom?: number): number {
  switch (climate) {
    case "neutral":
      return 0;
    case "nino_moderate":
      return 1.3;
    case "nino_strong":
      return 2.6;
    case "custom":
      return Math.max(-3, Math.min(3, custom ?? 0));
  }
}

function confidenceOf(historyYears: number): SimulationResult["confidence"] {
  const score = round(Math.min(0.9, 0.5 + historyYears * 0.05), 2);
  const level = score >= 0.8 ? "alta" : score >= 0.65 ? "media" : "baja";
  return {
    level,
    score,
    rationale: `${historyYears} ${historyYears === 1 ? "año" : "años"} de historial del fundo; a más campañas registradas, menor amplitud del rango.`,
  };
}

function outcomes(baseline: number, central: number, spread: number, higherIsBetter: boolean, digits = 2) {
  // The favourable side of the range is narrower than the adverse one.
  const [opt, pes] = higherIsBetter
    ? [central * (1 + spread * 0.6), central * (1 - spread)]
    : [central * (1 - spread * 0.6), central * (1 + spread)];
  const mk = (key: ScenarioOutcome["key"], label: string, v: number): ScenarioOutcome => ({
    key,
    label,
    value: round(v, digits),
    deltaPct: round(((v - baseline) / baseline) * 100, 1),
  });
  return [mk("optimistic", "Optimista", opt), mk("central", "Central", central), mk("pessimistic", "Pesimista", pes)] as [
    ScenarioOutcome,
    ScenarioOutcome,
    ScenarioOutcome,
  ];
}

function runYield(input: SimulationInput, rnd: () => number): SimulationResult {
  const anomaly = anomalyOf(input.climate, input.anomalyIndex);
  const baseline = input.crop.baseYieldTHa;
  const climateEffect = anomaly > 0 ? -0.095 * anomaly : 0.03 * anomaly; // warm anomalies hurt fruit set and quality
  const farmNoise = (rnd() - 0.5) * 0.06;
  const effect = climateEffect + farmNoise;
  const central = baseline * (1 + effect);
  const confidence = confidenceOf(input.farm.historyYears);
  const spread = (1 - confidence.score) * 0.45 + Math.abs(climateEffect) * 0.35;
  const scenarios = outcomes(baseline, central, spread, true);

  const e = climateEffect * 100;
  const factors: Factor[] = [
    {
      name: "Estrés térmico en floración y envero",
      impactPct: round(e * 0.45 - (anomaly > 0 ? 0 : 0.4), 1),
      explanation: "Temperaturas máximas sobre 32 °C reducen cuajado y calibre de baya.",
    },
    {
      name: "Déficit de horas frío",
      impactPct: round(e * 0.25, 1),
      explanation: "Invierno cálido desuniformiza la brotación y alarga la cosecha.",
    },
    {
      name: "Presión de oídio y pudrición ácida",
      impactPct: round(e * 0.18 - 0.3, 1),
      explanation: "Humedad relativa alta favorece enfermedades que bajan el porcentaje exportable.",
    },
    {
      name: "Disponibilidad hídrica del acuífero de Ica",
      impactPct: round(e * 0.12 + farmNoise * 100, 1),
      explanation: "Nivel freático y turnos de riego condicionan el llenado de baya.",
    },
  ].sort((a, b) => Math.abs(b.impactPct) - Math.abs(a.impactPct));

  const drop = scenarios[1].deltaPct;
  const actions: RecommendedAction[] = [];
  if (drop <= -15) {
    actions.push({
      title: "Renegociar volúmenes comprometidos con compradores",
      detail: `Ajustar contratos al escenario central (${scenarios[1].value.toFixed(1)} t/ha) y dejar 10 % de holgura frente al pesimista.`,
      priority: "alta",
    });
    actions.push({
      title: "Reforzar programa fitosanitario preventivo",
      detail: "Adelantar aplicaciones contra oídio y monitoreo semanal de pudrición ácida desde envero.",
      priority: "alta",
    });
  }
  if (drop <= -5) {
    actions.push({
      title: "Instalar malla sombra o caolín en cuarteles críticos",
      detail: "Reducir golpe de sol y deshidratación de bayas en los cuarteles más expuestos.",
      priority: drop <= -15 ? "media" : "alta",
    });
    actions.push({
      title: "Reprogramar mano de obra de cosecha",
      detail: "Planificar cuadrillas para una cosecha más extendida y menos concentrada.",
      priority: "media",
    });
  }
  actions.push({
    title: drop > -5 ? "Mantener plan de campaña y comprometer volumen central" : "Revisar flujo de caja con el escenario pesimista",
    detail:
      drop > -5
        ? "El impacto esperado es bajo: confirmar programas comerciales con el volumen central."
        : `Proyectar ingresos con ${scenarios[2].value.toFixed(1)} t/ha para asegurar liquidez de la campaña.`,
    priority: "baja",
  });

  // Monthly export volume curve (Ica table grape season peaks Nov–Jan).
  const startMonth = 9; // October (0-based)
  const weights = Array.from({ length: input.horizon }, (_, i) => {
    const m = (startMonth + i) % 12;
    const peak = [11, 0, 1].includes(m) ? 1 : [10, 2].includes(m) ? 0.55 : 0.12;
    return peak;
  });
  const wSum = weights.reduce((s, w) => s + w, 0);
  const totalFor = (tHa: number) => tHa * input.farm.hectares;
  const series = weights.map((w, i) => ({
    period: MONTHS[(startMonth + i) % 12],
    optimistic: round((totalFor(scenarios[0].value) * w) / wSum, 0),
    central: round((totalFor(scenarios[1].value) * w) / wSum, 0),
    pessimistic: round((totalFor(scenarios[2].value) * w) / wSum, 0),
  }));

  return {
    metric: { key: "export_yield_t_ha", label: "Volumen exportable", unit: "t/ha", higherIsBetter: true },
    baseline: round(baseline),
    scenarios,
    confidence,
    factors,
    actions,
    series,
    seriesLabel: "Volumen exportable proyectado por mes (t)",
    totals: [
      { label: "Volumen exportable central", value: round(totalFor(scenarios[1].value), 0), unit: "t" },
      { label: "Diferencia vs. campaña base", value: round(totalFor(scenarios[1].value - baseline), 0), unit: "t" },
    ],
    modelVersion: MODEL_VERSION,
    dataQuality: "demo",
    generatedAt: new Date().toISOString(),
  };
}

function runColdChain(input: SimulationInput, rnd: () => number): SimulationResult {
  const anomaly = anomalyOf(input.climate, input.anomalyIndex);
  const corridor = input.corridor ?? { code: "ICA-CALLAO", name: "Ica – Callao", distanceKm: 305, transitHours: 5.5 };
  const heat = Math.max(0, anomaly);
  const segmentsBase = [
    { name: "Cosecha → packing", hours: 3, rate: 0.16 },
    { name: "Pre-enfriamiento en túnel", hours: 8, rate: 0.035 },
    { name: `Transporte terrestre ${corridor.name}`, hours: corridor.transitHours, rate: 0.085 },
    { name: "Espera en puerto del Callao", hours: 18, rate: 0.032 },
  ];
  const segments = segmentsBase.map((s, i) => {
    const climateFactor = 1 + heat * (i === 0 || i === 2 ? 0.32 : 0.14);
    const noise = 1 + (rnd() - 0.5) * 0.12;
    return { name: s.name, hours: s.hours, lossPct: round(s.hours * s.rate * climateFactor * noise, 2) };
  });
  const baseline = round(segmentsBase.reduce((s, x) => s + x.hours * x.rate, 0), 2);
  const central = segments.reduce((s, x) => s + x.lossPct, 0);
  const confidence = confidenceOf(Math.min(10, input.farm.historyYears + 2));
  const spread = (1 - confidence.score) * 0.5 + heat * 0.08;
  const scenarios = outcomes(baseline, central, spread, false);

  const factors: Factor[] = segments
    .map((s, i) => ({
      name: s.name,
      impactPct: round(((s.lossPct - segmentsBase[i].hours * segmentsBase[i].rate) / baseline) * 100, 1),
      explanation:
        i === 0
          ? "Tiempo entre corte y frío: cada hora a más de 25 °C acelera la deshidratación del raquis."
          : i === 1
            ? "Bajar la pulpa a menos de 2 °C en menos de 8 h limita la merma posterior."
            : i === 2
              ? "Temperatura ambiente en la Panamericana Sur y aperturas de puerta del reefer."
              : "Horas de espera por congestión en el terminal y conexión eléctrica del contenedor.",
    }))
    .sort((a, b) => Math.abs(b.impactPct) - Math.abs(a.impactPct));

  const actions: RecommendedAction[] = [];
  if (scenarios[1].value >= 3) {
    actions.push({
      title: "Reprogramar despachos a horario nocturno",
      detail: "Salir del packing entre 20:00 y 04:00 para evitar el pico de temperatura en el tramo terrestre.",
      priority: "alta",
    });
  }
  if (scenarios[1].value >= 2.2) {
    actions.push({
      title: "Asegurar pulpa < 2 °C antes de cargar",
      detail: "Verificar registro del túnel y no cargar pallets con pulpa sobre 3 °C.",
      priority: scenarios[1].value >= 3 ? "alta" : "media",
    });
    actions.push({
      title: "Reservar ventana de ingreso al terminal",
      detail: "Coordinar cita con el terminal para reducir la espera en puerto a menos de 12 h.",
      priority: "media",
    });
  }
  actions.push({
    title: "Mantener setpoint 0 °C y monitoreo de registradores",
    detail: "Revisar alarmas del registrador de temperatura en cada envío del corredor.",
    priority: "baja",
  });

  const series = Array.from({ length: input.horizon }, (_, d) => {
    const daily = 1 + (rnd() - 0.5) * 0.18 + Math.sin(d / 2) * 0.04;
    return {
      period: `D${d + 1}`,
      optimistic: round(scenarios[0].value * daily, 2),
      central: round(scenarios[1].value * daily, 2),
      pessimistic: round(scenarios[2].value * daily, 2),
    };
  });

  return {
    metric: { key: "cold_chain_loss_pct", label: "Merma estimada por envío", unit: "%", higherIsBetter: false },
    baseline,
    scenarios,
    confidence,
    factors,
    actions,
    series,
    seriesLabel: "Merma estimada por día de despacho (%)",
    segments,
    totals: [
      { label: "Horas totales puerta a puerto", value: round(segments.reduce((s, x) => s + x.hours, 0), 1), unit: "h" },
      { label: "Distancia del corredor", value: corridor.distanceKm, unit: "km" },
    ],
    modelVersion: MODEL_VERSION,
    dataQuality: "demo",
    generatedAt: new Date().toISOString(),
  };
}

export const demoEngine: SimulationEngine = {
  version: MODEL_VERSION,
  run(input) {
    const seed = hashSeed(
      [input.type, input.farm.id, input.campaign, input.climate, input.anomalyIndex ?? 0, input.horizon, input.corridor?.code ?? ""].join("|"),
    );
    const rnd = mulberry32(seed);
    return input.type === "YIELD" ? runYield(input, rnd) : runColdChain(input, rnd);
  },
};
