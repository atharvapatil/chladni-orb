import { describe, expect, it } from "vitest";
import { besselI } from "../bessel";
import { circularRoots, jSecond, jThird } from "./circular";

describe("besselI", () => {
  it("matches tabulated values", () => {
    expect(besselI(0, 0)).toBe(1);
    expect(besselI(0, 1)).toBeCloseTo(1.2660659, 6);
    expect(besselI(1, 1)).toBeCloseTo(0.5651591, 6);
    expect(besselI(2, 2)).toBeCloseTo(0.6889484, 6);
  });
});

describe("jThird", () => {
  it("matches a central finite difference of J''", () => {
    const h = 1e-4;
    for (const [n, x] of [
      [0, 2.3],
      [1, 5.7],
      [2, 3.1],
      [3, 9.4],
      [5, 1.2],
    ] as const) {
      const fd = (jSecond(n, x + h) - jSecond(n, x - h)) / (2 * h);
      expect(Math.abs(jThird(n, x) - fd) / Math.abs(fd)).toBeLessThan(1e-5);
    }
  });
});

// Leissa NASA SP-160 Table 2.5, ν = 0.33: λ² of the first elastic roots.
// n=1 has no s=0 elastic root; its roots start at s=1.
describe("circular free-edge roots (Leissa SP-160 Table 2.5, ν=0.33)", () => {
  const NU = 0.33;
  const bench: [number, number, number][] = [
    // [n, s, λ² expected] — Itao & Crandall (1979)-validated table from
    // github.com/kauewerner/circular-plate-free-edge (results/
    // lambda_results_v=0.33.dat). Leissa SP-160 Table 2.5 agrees except for
    // the entries it marks as asymptotic approximations (21.6, 46.2, 73.1);
    // the validated values (21.527, 46.809, 73.378) are used for those.
    [2, 0, 5.262],
    [0, 1, 9.069],
    [3, 0, 12.244],
    [1, 1, 20.513],
    [4, 0, 21.527],
    [5, 0, 33.062],
    [2, 1, 35.243],
    [0, 2, 38.507],
    [3, 1, 52.921],
    [1, 2, 59.859],
    [6, 0, 46.809],
    [4, 1, 73.378],
  ];
  for (const [n, s, expected] of bench) {
    it(`n=${n} s=${s} → λ² ≈ ${expected}`, () => {
      const s0 = n <= 1 ? 1 : 0; // n=0: rigid translation; n=1: rigid tip — both start at s=1
      const roots = circularRoots(n, NU, s + 1 - s0);
      const lam2 = roots[s - s0]!.lambda ** 2;
      console.log(`n=${n} s=${s}: λ²=${lam2.toFixed(3)} (expect ${expected})`);
      expect(Math.abs(lam2 - expected) / expected).toBeLessThan(0.003);
    });
  }
});
