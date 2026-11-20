import type { SimulationEngine } from "./contract";
import { apf3Engine } from "./apf3/engine";
import { demoEngine } from "./engine-v0";

export const productionEngine: SimulationEngine = {
  version: "agropredic-hybrid-v1.0",
  run(input) {
    if (input.type === "YIELD" && input.crop.code === "uva" && input.zone.code === "ica") {
      return apf3Engine.run(input);
    }
    return demoEngine.run(input);
  },
};
