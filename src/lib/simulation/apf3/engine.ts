import type {
  Factor,
  RecommendedAction,
  ScenarioOutcome,
  SimulationEngine,
  SimulationInput,
  SimulationResult,
} from "../contract";
import { buildApf3Features } from "./features";
import { APF3_MODEL, featureContribution, predictYieldFromFeatures, type Apf3Feature } from "./model";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
const HISTORY_FEATURES: Apf3Feature[] = ["rend_prev", "rend_media_hist", "n_campanas_previas"];
const THERMAL_FEATURES: Apf3Feature[] = [
  "oni_djf_previo",
  "anom_tmax_ene_mar",
  "anom_tmean_abr_jun",
  "oni_djf_cosecha",
  "anom_tmean_set_nov",
];
const WATER_FEATURES: Apf3Feature[] = ["precip_ene_mar_prev", "hr_set_nov", "precip_ene_mar_cosecha"];

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function confidenceOf(input: SimulationInput): SimulationResult["confidence"] {
  const base = Math.min(0.9, 0.5 + input.farm.historyYears * 0.05);
  const horizonPenalty = input.horizon > 6 ? Math.min(0.15, (input.horizon - 6) * 0.02) : 0;
  const score = round(Math.max(0.35, base - horizonPenalty), 2);
  const level = score >= 0.8 ? "alta" : score >= 0.65 ? "media" : "baja";
  return {
    level,
    score,
    rationale: `Modelo APF3 con cobertura de validación ${APF3_MODEL.metrics.coveragePct.toFixed(1)} %; ${input.farm.historyYears} ${
      input.farm.historyYears === 1 ? "año" : "años"
    } de historial y horizonte de ${input.horizon} meses.`,
  };
}

function outcome(key: ScenarioOutcome["key"], label: string, value: number, baseline: number): ScenarioOutcome {
  return {
    key,
    label,
    value: round(value, 2),
    deltaPct: round(((value - baseline) / baseline) * 100, 1),
  };
}

function actionsFor(drop: number, central: number, pessimistic: number): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  if (drop <= -15) {
    actions.push({
      title: "Renegociar volúmenes comprometidos con compradores",
      detail: `Ajustar contratos al escenario central (${central.toFixed(1)} t/ha) y dejar 10 % de holgura frente al pesimista.`,
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
        : `Proyectar ingresos con ${pessimistic.toFixed(1)} t/ha para asegurar liquidez de la campaña.`,
    priority: "baja",
  });
  return actions;
}

function factor(name: string, value: number, baseline: number, explanation: string): Factor {
  return { name, impactPct: round((value / baseline) * 100, 1), explanation };
}

export const apf3Engine: SimulationEngine = {
  version: APF3_MODEL.version,
  run(input) {
    if (input.type !== "YIELD") throw new Error("El motor APF3 solo admite simulaciones de rendimiento.");

    const features = buildApf3Features(input);
    const baseline = input.crop.baseYieldTHa;
    const central = round(predictYieldFromFeatures(features), 2);
    const optimistic = round(central + APF3_MODEL.residuals.q90, 2);
    const pessimistic = round(central + APF3_MODEL.residuals.q10, 2);
    const scenarios = [
      outcome("optimistic", "Optimista", optimistic, baseline),
      outcome("central", "Central", central, baseline),
      outcome("pessimistic", "Pesimista", pessimistic, baseline),
    ] as [ScenarioOutcome, ScenarioOutcome, ScenarioOutcome];

    const history = HISTORY_FEATURES.reduce((sum, name) => sum + featureContribution(name, features), 0);
    const scale = featureContribution("hectareas", features);
    const thermal = THERMAL_FEATURES.reduce((sum, name) => sum + featureContribution(name, features), 0);
    const water = WATER_FEATURES.reduce((sum, name) => sum + featureContribution(name, features), 0);

    const factors: Factor[] = [
      factor(
        "Historial productivo del fundo",
        history,
        baseline,
        `Rendimiento previo, media histórica y experiencia del fundo frente al promedio del dataset (${APF3_MODEL.training.meanYield.toFixed(1)} t/ha).`,
      ),
      factor(
        "Estrés térmico y señal ENSO",
        thermal,
        baseline,
        "Anomalías de temperatura en verano, floración y maduración, junto con el ONI previo y de cosecha.",
      ),
      factor(
        "Lluvias y humedad en floración",
        water,
        baseline,
        "Precipitación de verano y humedad relativa durante la floración y la cosecha.",
      ),
      factor("Escala del fundo", scale, baseline, "Tamaño del fundo frente al promedio de las parcelas de entrenamiento."),
    ].sort((a, b) => Math.abs(b.impactPct) - Math.abs(a.impactPct));

    const startMonth = 9;
    const weights = Array.from({ length: input.horizon }, (_, i) => {
      const month = (startMonth + i) % 12;
      return [11, 0, 1].includes(month) ? 1 : [10, 2].includes(month) ? 0.55 : 0.12;
    });
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const totalFor = (tHa: number) => tHa * input.farm.hectares;
    const series = weights.map((weight, i) => ({
      period: MONTHS[(startMonth + i) % 12],
      optimistic: round((totalFor(scenarios[0].value) * weight) / weightSum, 0),
      central: round((totalFor(scenarios[1].value) * weight) / weightSum, 0),
      pessimistic: round((totalFor(scenarios[2].value) * weight) / weightSum, 0),
    }));

    return {
      metric: { key: "export_yield_t_ha", label: "Volumen exportable", unit: "t/ha", higherIsBetter: true },
      baseline: round(baseline, 2),
      scenarios,
      confidence: confidenceOf(input),
      factors,
      actions: actionsFor(scenarios[1].deltaPct, scenarios[1].value, scenarios[2].value),
      series,
      seriesLabel: "Volumen exportable proyectado por mes (t)",
      totals: [
        { label: "Volumen exportable central", value: round(totalFor(scenarios[1].value), 0), unit: "t" },
        { label: "Diferencia vs. campaña base", value: round(totalFor(scenarios[1].value - baseline), 0), unit: "t" },
      ],
      modelVersion: APF3_MODEL.version,
      dataQuality: "apf3_synthetic",
      generatedAt: new Date().toISOString(),
    };
  },
};
