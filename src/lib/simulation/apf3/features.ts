import type { SimulationInput } from "../contract";
import type { Apf3Features } from "./model";

const NEUTRAL_PRECIP_ENE_ABR = 2.229478417266186;
const NEUTRAL_PRECIP_MAY_JUL = 0.857122302158272;

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

export function buildApf3Features(input: SimulationInput): Apf3Features {
  const anomaly = anomalyOf(input);
  const tempEneAbr = 0.7 * anomaly;
  const tempMayJul = 0.2 * anomaly;
  const tempAgoDicPrev = 0.1 * anomaly;
  const precipEneAbr = Math.max(0, NEUTRAL_PRECIP_ENE_ABR + 1.5 * anomaly);
  const precipMayJul = Math.max(0, NEUTRAL_PRECIP_MAY_JUL + 0.15 * anomaly);

  return {
    temp_ene_abr: tempEneAbr,
    temp_may_jul: tempMayJul,
    temp_ago_dic_prev: tempAgoDicPrev,
    precip_ene_abr: precipEneAbr,
    precip_may_jul: precipMayJul,
    temp_x_precip: tempEneAbr * precipEneAbr,
    rend_media_previa: input.crop.baseYieldTHa,
    hectareas: input.farm.hectares,
  };
}
