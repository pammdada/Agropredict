import type { SimulationInput } from "../contract";
import { APF3_MODEL, type Apf3Feature, type Apf3Features } from "./model";

export function anomalyOf(input: SimulationInput): number {
  switch (input.climate) {
    case "neutral":
      return 0;
    case "nino_moderate":
      return 1.3;
    case "nino_strong":
      return 2.6;
    case "custom":
      return Math.max(-3, Math.min(3, input.anomalyIndex ?? 0));
  }
}

function climateValue(feature: Apf3Feature, anomaly: number): number {
  const mapping = APF3_MODEL.scenario.climates[feature];
  if (!mapping) return 0;
  return mapping.intercept + mapping.slope * anomaly;
}

function precipitation(feature: Apf3Feature, anomaly: number): number {
  return Math.max(0, climateValue(feature, anomaly));
}

export function buildApf3Features(input: SimulationInput): Apf3Features {
  const anomaly = anomalyOf(input);
  const baseYield = input.crop.baseYieldTHa;

  return {
    oni_djf_previo: anomaly,
    anom_tmax_ene_mar: climateValue("anom_tmax_ene_mar", anomaly),
    anom_tmean_abr_jun: climateValue("anom_tmean_abr_jun", anomaly),
    precip_ene_mar_prev: precipitation("precip_ene_mar_prev", anomaly),
    rend_prev: baseYield,
    rend_media_hist: baseYield,
    n_campanas_previas: input.farm.historyYears,
    hectareas: input.farm.hectares,
    oni_djf_cosecha: anomaly,
    anom_tmean_set_nov: climateValue("anom_tmean_set_nov", anomaly),
    hr_set_nov: climateValue("hr_set_nov", anomaly),
    precip_ene_mar_cosecha: precipitation("precip_ene_mar_cosecha", anomaly),
  };
}
