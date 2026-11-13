import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, mergeParams } from "../params";
import {
  AGENT_STATES,
  RELAX_SILENCE,
  isQuiet,
  needsFreshSand,
  pulseFor,
  stepRelax,
  wantsRelax,
} from "./agentState";

describe("agent states", () => {
  it("only talking listens to the analyser", () => {
    expect(isQuiet("talking")).toBe(false);
    for (const s of AGENT_STATES.filter((s) => s !== "talking")) expect(isQuiet(s)).toBe(true);
  });

  it("connecting pulses out, listening pulses in, the rest do not pulse", () => {
    expect(pulseFor("connecting")).toBe(1);
    expect(pulseFor("listening")).toBe(-1);
    expect(pulseFor("idle")).toBe(0);
    expect(pulseFor("talking")).toBe(0);
  });
});

describe("wantsRelax", () => {
  const hold = DEFAULT_PARAMS;
  const relax = mergeParams(DEFAULT_PARAMS, { listening: { idle: "relax" } });

  it("quiet states always relax, whatever idle is set to", () => {
    expect(wantsRelax("idle", hold, 1)).toBe(true);
    expect(wantsRelax("connecting", hold, 1)).toBe(true);
    expect(wantsRelax("listening", hold, 0)).toBe(true);
  });

  it("talking with idle=hold never relaxes", () => {
    expect(wantsRelax("talking", hold, 0)).toBe(false);
    expect(wantsRelax("talking", hold, 1)).toBe(false);
  });

  it("talking with idle=relax relaxes only once the sound has gone", () => {
    expect(wantsRelax("talking", relax, 0.5)).toBe(false);
    expect(wantsRelax("talking", relax, RELAX_SILENCE)).toBe(false);
    expect(wantsRelax("talking", relax, 0)).toBe(true);
  });

  it("a frozen plate never relaxes", () => {
    const frozen = mergeParams(relax, { listening: { freeze: true } });
    expect(wantsRelax("idle", frozen, 0)).toBe(false);
    expect(wantsRelax("talking", frozen, 0)).toBe(false);
  });
});

describe("stepRelax", () => {
  it("eases in over roughly 0.6s and snaps out faster", () => {
    let r = 0;
    for (let i = 0; i < 36; i++) r = stepRelax(r, true, 1 / 60); // 0.6s
    expect(r).toBeGreaterThan(0.6);
    expect(r).toBeLessThan(1);
    let out = r;
    for (let i = 0; i < 9; i++) out = stepRelax(out, false, 1 / 60); // 0.15s
    expect(out).toBeLessThan(r * 0.4);
  });

  it("settles to exactly 0 and never overshoots 1", () => {
    expect(stepRelax(0.0005, false, 1 / 60)).toBe(0);
    expect(stepRelax(0.999, true, 10)).toBeLessThanOrEqual(1);
  });
});

describe("needsFreshSand", () => {
  const base = DEFAULT_PARAMS;
  it("re-seeds on model, partial count, shape and aspect", () => {
    expect(needsFreshSand(base, mergeParams(base, { plate: { model: "lab" } }))).toBe(true);
    expect(needsFreshSand(base, mergeParams(base, { listening: { partials: 4 } }))).toBe(true);
    expect(needsFreshSand(base, mergeParams(base, { plate: { shape: "square" } }))).toBe(true);
    expect(needsFreshSand(base, mergeParams(base, { plate: { aspect: 1.5 } }))).toBe(true);
  });

  it("keeps the sand for everything else", () => {
    expect(needsFreshSand(base, mergeParams(base, { plate: { size: 50 } }))).toBe(false);
    expect(needsFreshSand(base, mergeParams(base, { look: { look: "ink" } }))).toBe(false);
    expect(needsFreshSand(base, mergeParams(base, { listening: { idle: "relax" } }))).toBe(false);
    expect(needsFreshSand(base, base)).toBe(false);
  });
});
