import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, mergeParams } from "../params";
import { ResonanceMixer } from "./ResonanceMixer";
import type { Mode } from "./modes";

const mode = (freq: number, over?: Partial<Mode>): Mode => ({
  basis: "rect",
  n: 1,
  m: 2,
  sign: -1,
  k: 1,
  freq,
  ...over,
});

const DT = 1 / 60;
const P = mergeParams(DEFAULT_PARAMS, { plate: { exciterAmount: 0 } });

describe("ResonanceMixer", () => {
  it("a partial exactly on a mode freq drives it maximally; far mode ≈0", () => {
    const modes = [mode(440), mode(8000)];
    const mix = new ResonanceMixer({ gamma: 0.04 });
    const out = mix.update(DT, [{ freq: 440, amp: 1 }], modes, P);
    expect(out.amps[0]).toBeCloseTo(1, 3);
    expect(out.amps[1]).toBeLessThan(0.01);
    expect(out.tremor).toBe(0);
  });

  it("a partial midway between two modes blends both", () => {
    const modes = [mode(400), mode(500)];
    const mix = new ResonanceMixer({ gamma: 0.3 });
    const out = mix.update(DT, [{ freq: 450, amp: 1 }], modes, P);
    const ratio = out.amps[0]! / out.amps[1]!;
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.25);
  });

  it("pivot zeroes the rect +1 family", () => {
    const modes = [mode(400, { sign: 1 }), mode(400, { sign: -1 })];
    const p = mergeParams(P, { plate: { drive: "pivot" } });
    const mix = new ResonanceMixer();
    const out = mix.update(DT, [{ freq: 400, amp: 1 }], modes, p);
    expect(out.amps[0]).toBe(0);
    expect(out.amps[1]).toBeGreaterThan(0.9);
  });

  it("exciter at a node of a mode collapses its factor with e=1", () => {
    // rect (1,2,-1) has a node line at v where cos(πv)=0 → v=... pick u=0:
    // φ(0,0)=0 for the minus family.
    const modes = [mode(400, { sign: -1 })];
    const p = mergeParams(P, { plate: { exciterAmount: 1, exciterX: 0, exciterY: 0 } });
    const mix = new ResonanceMixer();
    const out = mix.update(DT, [{ freq: 400, amp: 1 }], modes, p);
    expect(out.amps[0]).toBeCloseTo(0, 6);
  });

  it("ring-down: silent update decays amps, high modes faster", () => {
    const modes = [mode(200), mode(2000)];
    const mix = new ResonanceMixer({ gamma: 1 });
    const p = mergeParams(P, { listening: { decay: 200 } });
    mix.update(DT, [{ freq: 200, amp: 1 }], modes, p);
    const a0 = [...mix.update(DT, [{ freq: 2000, amp: 1 }], modes, p).amps];
    const a1 = [...mix.update(0.1, [], modes, p).amps];
    expect(a1[0]).toBeLessThan(a0[0]!);
    expect(a1[1]).toBeLessThan(a0[1]!);
    // high mode (index 1) decayed by a larger fraction
    expect(a1[1]! / a0[1]!).toBeLessThan(a1[0]! / a0[0]!);
  });

  it("tremor > 0 when the partial is far from every mode", () => {
    const modes = [mode(200), mode(400)];
    const mix = new ResonanceMixer({ gamma: 0.01, tremorThreshold: 0.15 });
    const out = mix.update(DT, [{ freq: 5000, amp: 1 }], modes, P);
    expect(out.tremor).toBeGreaterThan(0.9);
  });

  it("tremor stays 0 when look.tremor is off", () => {
    const modes = [mode(200)];
    const p = mergeParams(P, { look: { tremor: false } });
    const mix = new ResonanceMixer({ gamma: 0.01 });
    const out = mix.update(DT, [{ freq: 5000, amp: 1 }], modes, p);
    expect(out.tremor).toBe(0);
  });
});
