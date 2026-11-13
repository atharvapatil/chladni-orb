import { describe, expect, it } from "vitest";
import * as api from "./index";

/**
 * The public surface of chladni-orb-core. If this test fails you have changed
 * the API: either restore the export or update this list *and* add a
 * changeset (major for removals/renames, minor for additions).
 */
const PUBLIC_API = [
  // params
  "DEFAULT_PARAMS",
  "PARAM_SCHEMA",
  "mergeParams",
  // plate
  "createChladniPlate",
  // agent states
  "AGENT_STATES",
  "isQuiet",
  "needsFreshSand",
  "pulseFor",
  "wantsRelax",
  // audio
  "PartialAnalyser",
  "pickPeaks",
  "SimulatedVoice",
  "createMicAnalyser",
  "createElementAnalyser",
  // physics
  "AnalyticalModel",
  "LabModel",
  "ResonanceMixer",
  "besselI",
  "besselJ",
  "besselZeros",
  "circularRoots",
  "shearF",
  "dispersionHz",
  "evalMode",
  // render
  "Renderer",
  "getSharedGL",
  // presets
  "PRESETS",
].sort();

describe("chladni-orb-core public API", () => {
  it("exports exactly the documented names", () => {
    expect(Object.keys(api).sort()).toEqual(PUBLIC_API);
  });

  it("ships every preset with a label, description and a valid params patch", () => {
    for (const [key, p] of Object.entries(api.PRESETS)) {
      expect(p.label, key).toBeTruthy();
      expect(p.description, key).toBeTruthy();
      expect(() => api.mergeParams(api.DEFAULT_PARAMS, p.params), key).not.toThrow();
    }
  });

  it("documents every param in the schema and every schema key in the params", () => {
    const paramKeys = Object.entries(api.DEFAULT_PARAMS).flatMap(([g, v]) =>
      Object.keys(v).map((k) => `${g}.${k}`),
    );
    expect(Object.keys(api.PARAM_SCHEMA).sort()).toEqual(paramKeys.sort());
  });
});
