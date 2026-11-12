import { describe, expect, it } from "vitest";
import { besselJ, besselZeros } from "./bessel";

describe("besselJ", () => {
  it("boundary values", () => {
    expect(besselJ(0, 0)).toBe(1);
    expect(besselJ(1, 0)).toBe(0);
  });
  it("J0(2.4048) ≈ 0", () => {
    expect(Math.abs(besselJ(0, 2.4048))).toBeLessThan(1e-4);
  });
  it("J0(1) ≈ 0.7652", () => {
    expect(besselJ(0, 1)).toBeCloseTo(0.7652, 3);
  });
});

describe("besselZeros", () => {
  it("J0 zeros", () => {
    const z = besselZeros(0, 3);
    expect(z[0]).toBeCloseTo(2.4048, 3);
    expect(z[1]).toBeCloseTo(5.5201, 3);
    expect(z[2]).toBeCloseTo(8.6537, 3);
  });
  it("J1 zeros", () => {
    const z = besselZeros(1, 3);
    expect(z[0]).toBeCloseTo(3.8317, 3);
    expect(z[1]).toBeCloseTo(7.0156, 3);
    expect(z[2]).toBeCloseTo(10.1735, 3);
  });
  it("J2/J3 first zeros", () => {
    expect(besselZeros(2, 2)[0]).toBeCloseTo(5.1356, 3);
    expect(besselZeros(2, 2)[1]).toBeCloseTo(8.4172, 3);
    expect(besselZeros(3, 1)[0]).toBeCloseTo(6.3802, 3);
  });
});
