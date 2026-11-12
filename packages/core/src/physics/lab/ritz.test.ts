import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, mergeParams } from "../../params";
import { solveRect } from "./ritz";

// Completely free square plate, ν = 0.3 — Leissa 1973 (36-term Ritz).
// Our 81-term Ritz is variational, hence an upper bound: values should be
// ≤ the reference and within 1%.
const SQUARE = mergeParams(DEFAULT_PARAMS, {
  plate: { shape: "square", size: 100, density: 2700, model: "lab" },
  lab: { thickness: 1, elasticity: 69, poisson: 0.3, sandMass: 0, pretension: 0 },
});

describe("free square plate (Leissa 1973 benchmarks, ν=0.3)", () => {
  const res = solveRect(SQUARE);
  const bench = [13.489, 19.789, 24.432, 35.024, 35.024, 61.526];
  bench.forEach((expected, i) => {
    it(`mode ${i}: λ² ≈ ${expected}`, () => {
      const v = res.lam2[i]!;
      console.log(`mode ${i}: λ²=${v.toFixed(3)} (expect ${expected})`);
      expect(v).toBeLessThanOrEqual(expected * 1.01);
      expect(Math.abs(v - expected) / expected).toBeLessThan(0.01);
    });
  });

  it("mode 1 has nodal lines on both centre lines (the + cross)", () => {
    const { a, b, eval: ev } = res;
    let max = 0;
    for (let g = 0; g <= 20; g++) {
      max = Math.max(max, Math.abs(ev(0, (g / 20) * a, (g / 20) * b)));
    }
    for (let g = 0; g <= 10; g++) {
      expect(Math.abs(ev(0, a / 2, (g / 10) * b))).toBeLessThan(0.05 * max);
      expect(Math.abs(ev(0, (g / 10) * a, b / 2))).toBeLessThan(0.05 * max);
    }
  });

  it("mode 2 has a nodal line on a diagonal (the X)", () => {
    const { a, b, eval: ev } = res;
    let max = 0;
    for (let g = 0; g <= 20; g++) {
      for (const [x, y] of [
        [(g / 20) * a, b / 4],
        [(g / 20) * a, (3 * b) / 4],
      ] as const)
        max = Math.max(max, Math.abs(ev(1, x, y)));
    }
    // one of the two diagonals must be nodal
    const diag = [0, 1, 2, 3, 4].map((g) => Math.abs(ev(1, (g / 4) * a, (g / 4) * b)));
    const anti = [0, 1, 2, 3, 4].map((g) => Math.abs(ev(1, (g / 4) * a, b - (g / 4) * b)));
    const ok = [...diag, ...anti];
    expect(Math.min(...ok)).toBeLessThan(0.05 * max);
    // stronger: a whole diagonal within tolerance
    const diagMax = Math.max(...diag);
    const antiMax = Math.max(...anti);
    expect(Math.min(diagMax, antiMax)).toBeLessThan(0.05 * max);
  });

  it("mode 3 is non-zero at the centre (the ring mode)", () => {
    const { a, b, eval: ev } = res;
    let max = 0;
    for (let g = 0; g <= 12; g++)
      for (let h = 0; h <= 12; h++)
        max = Math.max(max, Math.abs(ev(2, (g / 12) * a, (h / 12) * b)));
    expect(Math.abs(ev(2, a / 2, b / 2))).toBeGreaterThan(0.1 * max);
  });
});

describe("pretension", () => {
  it("raises all frequencies monotonically", () => {
    const low = solveRect(SQUARE).freqs;
    const high = solveRect(mergeParams(SQUARE, { lab: { pretension: 500 } })).freqs;
    for (let i = 0; i < 6; i++) expect(high[i]!).toBeGreaterThan(low[i]!);
    const high2 = solveRect(mergeParams(SQUARE, { lab: { pretension: 5000 } })).freqs;
    for (let i = 0; i < 6; i++) expect(high2[i]!).toBeGreaterThan(high[i]!);
  });
});
