import model from "./model.json";

export const APF3_FEATURES = [
  "oni_djf_previo",
  "anom_tmax_ene_mar",
  "anom_tmean_abr_jun",
  "precip_ene_mar_prev",
  "rend_prev",
  "rend_media_hist",
  "n_campanas_previas",
  "hectareas",
  "oni_djf_cosecha",
  "anom_tmean_set_nov",
  "hr_set_nov",
  "precip_ene_mar_cosecha",
] as const;

export type Apf3Feature = (typeof APF3_FEATURES)[number];
export type Apf3Features = Record<Apf3Feature, number>;

export interface Apf3ClimateMapping {
  driver: string;
  intercept: number;
  slope: number;
}

export interface Apf3Model {
  version: string;
  algorithm: string;
  target: string;
  features: string[];
  means: number[];
  scales: number[];
  coefficients: number[];
  intercept: number;
  residuals: { q10: number; q90: number };
  metrics: {
    maeValidation: number;
    rmseValidation: number;
    mapeValidation: number;
    r2Validation: number;
    maeTest: number;
    rmseTest: number;
    mapeTest: number;
    r2Test: number;
    coveragePct: number;
  };
  training: {
    records: number;
    farms: number;
    campaigns: string;
    missing: number;
    duplicates: number;
    meanYield: number;
    stdYield: number;
    source: string;
  };
  scenario: {
    climates: Record<string, Apf3ClimateMapping>;
  };
}

export const APF3_MODEL: Apf3Model = model;

export function predictYieldFromFeatures(features: Apf3Features): number {
  let value = APF3_MODEL.intercept;
  APF3_FEATURES.forEach((name, index) => {
    value += APF3_MODEL.coefficients[index] * ((features[name] - APF3_MODEL.means[index]) / APF3_MODEL.scales[index]);
  });
  return value;
}

export function featureContribution(name: Apf3Feature, features: Apf3Features): number {
  const index = APF3_FEATURES.indexOf(name);
  return APF3_MODEL.coefficients[index] * ((features[name] - APF3_MODEL.means[index]) / APF3_MODEL.scales[index]);
}
