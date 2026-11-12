import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, mergeParams } from "../params";
import { AnalyticalModel, dispersionHz, evalMode, type Mode } from "./modes";

const rectMode = (n: number, m: number, sign: 1 | -1): Mode => ({
  basis: "rect",
  n,
  m,
  sign,
  pair: 0,
  k: 0,
  freq: 0,
});

describe("rect modes", () => {
  it("k for (1,2) on L=0.3 m equals π·√5/0.3", () => {
    const model = new AnalyticalModel();
    const params = mergeParams(DEFAULT_PARAMS, {
      plate: { shape: "square", size: 30 },
      studio: { elasticity: 0 },
    });
    const mode = model
      .modes(params)
      .find((md) => md.basis === "rect" && md.n === 1 && md.m === 2 && md.sign === -1);
    expect(mode).toBeDefined();
    expect(mode!.k).toBeCloseTo((Math.PI * Math.sqrt(5)) / 0.3, 6);
  });

  it("minus family is 0 at centre and antisymmetric under n↔m swap", () => {
    const m12 = rectMode(1, 2, -1);
    expect(evalMode(m12, 0, 0)).toBeCloseTo(0, 12);
    const m21 = rectMode(2, 1, -1);
    expect(evalMode(m12, 0.3, 0.7)).toBeCloseTo(-evalMode(m21, 0.3, 0.7), 12);
  });

  it("rectangle enumerates ordered pairs with sign 0 (pure products)", () => {
    const model = new AnalyticalModel();
    const params = mergeParams(DEFAULT_PARAMS, { plate: { shape: "square", aspect: 2 } });
    const modes = model.modes(params);
    expect(modes.every((m) => m.basis === "rect" && m.sign === 0)).toBe(true);
    const has12 = modes.some((m) => m.n === 1 && m.m === 2);
    const has21 = modes.some((m) => m.n === 2 && m.m === 1);
    expect(has12 && has21).toBe(true);
    // sign-0 mode is non-zero at centre
    const m0 = modes.find((m) => m.n === 1 && m.m === 1)!;
    expect(evalMode(m0, 0, 0)).toBeCloseTo(1, 12);
  });
});

describe("polar modes", () => {
  it("n=0 mode is 0 at r=1 (fixed rim)", () => {
    const mode: Mode = { basis: "polar", n: 0, m: 1, sign: 1, pair: 0, k: 0, freq: 0 };
    expect(evalMode(mode, 1, 0)).toBeCloseTo(0, 4);
    expect(evalMode(mode, Math.SQRT1_2, Math.SQRT1_2)).toBeCloseTo(0, 4);
  });
});

describe("dispersionHz", () => {
  const base = mergeParams(DEFAULT_PARAMS, { studio: { tension: 800, elasticity: 0 } });

  it("E=0 → f ∝ k", () => {
    const f1 = dispersionHz(10, base);
    const f2 = dispersionHz(20, base);
    expect(f2 / f1).toBeCloseTo(2, 6);
  });

  it("T=0 → f ∝ k²", () => {
    const p = mergeParams(base, { studio: { tension: 0, elasticity: 40 } });
    const f1 = dispersionHz(10, p);
    const f2 = dispersionHz(20, p);
    expect(f2 / f1).toBeCloseTo(4, 6);
  });
});

describe("AnalyticalModel.modes", () => {
  it("returns sorted modes, ≤ maxModes, sane default frequency range", () => {
    const model = new AnalyticalModel();
    const modes = model.modes(DEFAULT_PARAMS);
    expect(modes.length).toBeGreaterThan(0);
    expect(modes.length).toBeLessThanOrEqual(128);
    for (let i = 1; i < modes.length; i++) {
      expect(modes[i]!.freq).toBeGreaterThanOrEqual(modes[i - 1]!.freq);
    }
    // default params (circle, 30 cm, T=800, E=40, h=0.8mm, ρ=2700)
    // observed range printed for the report:
    // eslint-disable-next-line no-console
    console.log(
      `default mode range: ${modes[0]!.freq.toFixed(1)} Hz .. ${modes[modes.length - 1]!.freq.toFixed(1)} Hz (${modes.length} modes)`,
    );
    expect(modes[0]!.freq).toBeGreaterThan(20);
    expect(modes[0]!.freq).toBeLessThan(400);
    expect(modes[modes.length - 1]!.freq).toBeLessThanOrEqual(12000);
  });

  it("degenerate pairs stay adjacent and are never split by maxModes", () => {
    const model = new AnalyticalModel();
    const modes = model.modes(DEFAULT_PARAMS); // circle → polar
    expect(modes.some((m) => m.pair === 1)).toBe(true);
    for (let i = 0; i < modes.length; i++) {
      const m = modes[i]!;
      if (m.pair === 1) {
        const partner = modes[i + 1]!;
        expect(partner.pair).toBe(2);
        expect(partner.freq).toBe(m.freq);
        expect(partner.n).toBe(m.n);
        expect(partner.m).toBe(m.m);
        i++;
      } else {
        expect(m.pair).not.toBe(1);
      }
    }
    expect(modes[modes.length - 1]!.pair).not.toBe(1);
    // odd maxModes must not split a pair
    const odd = new AnalyticalModel({ maxModes: 7 });
    const om = odd.modes(DEFAULT_PARAMS);
    expect(om[om.length - 1]!.pair).not.toBe(1);
  });

  it("memoises on the params that matter", () => {
    const model = new AnalyticalModel();
    const a = model.modes(DEFAULT_PARAMS);
    const b = model.modes(DEFAULT_PARAMS);
    expect(b).toBe(a);
    const c = model.modes(mergeParams(DEFAULT_PARAMS, { plate: { size: 50 } }));
    expect(c).not.toBe(a);
  });
});
