// Simulation contract (technical sheet, section 9 of the MVP plan).
// Any engine (demo v0 today, trained model in APF3) must honour these types.

export type SimulationKind = "YIELD" | "COLD_CHAIN";
export type ClimateScenario = "neutral" | "nino_moderate" | "nino_strong" | "custom";

export const CLIMATE_LABELS: Record<ClimateScenario, string> = {
  neutral: "Neutro",
  nino_moderate: "Niño moderado",
  nino_strong: "Niño fuerte",
  custom: "Personalizado",
};

export interface SimulationInput {
  type: SimulationKind;
  farm: { id: string; name: string; hectares: number; historyYears: number };
  crop: { code: string; name: string; baseYieldTHa: number };
  zone: { code: string; name: string };
  corridor?: { code: string; name: string; distanceKm: number; transitHours: number };
  campaign: string; // e.g. "2026-2027"
  climate: ClimateScenario;
  anomalyIndex?: number; // custom scenario, °C of sea-surface anomaly (-3..3)
  horizon: number; // YIELD: months; COLD_CHAIN: days
}

export type ScenarioKey = "optimistic" | "central" | "pessimistic";

export interface ScenarioOutcome {
  key: ScenarioKey;
  label: string;
  value: number;
  deltaPct: number; // vs. baseline
}

export interface Factor {
  name: string;
  impactPct: number; // signed contribution to the target metric
  explanation: string;
}

export interface RecommendedAction {
  title: string;
  detail: string;
  priority: "alta" | "media" | "baja";
}

export interface SimulationResult {
  metric: { key: "export_yield_t_ha" | "cold_chain_loss_pct"; label: string; unit: string; higherIsBetter: boolean };
  baseline: number;
  scenarios: [ScenarioOutcome, ScenarioOutcome, ScenarioOutcome];
  confidence: { level: "alta" | "media" | "baja"; score: number; rationale: string };
  factors: Factor[];
  actions: RecommendedAction[];
  series: { period: string; optimistic: number; central: number; pessimistic: number }[];
  seriesLabel: string;
  segments?: { name: string; hours: number; lossPct: number }[];
  totals?: { label: string; value: number; unit: string }[];
  modelVersion: string;
  dataQuality: "demo";
  generatedAt: string;
}

export interface SimulationEngine {
  readonly version: string;
  run(input: SimulationInput): SimulationResult;
}
