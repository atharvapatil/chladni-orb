import type { ChladniParams } from "../params";
import { besselJ, besselZeros } from "./bessel";

export type ModeBasis = "rect" | "polar";

export interface Mode {
  basis: ModeBasis;
  /** rect: cos indices; polar: n = nodal diameters, m = radial index (1-based) */
  n: number;
  m: number;
  /** rect: 0 = pure product, ±1 = cos·cos ± cos·cos family;
   *  polar: +1 = cos(nθ), −1 = sin(nθ) */
  sign: 1 | 0 | -1;
  /** wavenumber rad/m */
  k: number;
  /** Hz */
  freq: number;
}

export interface PlateModel {
  /** sorted by freq ascending */
  modes(params: ChladniParams): Mode[];
}

const ZERO_CACHE = new Map<string, number>();

function besselZero(n: number, m: number): number {
  const key = `${n}:${m}`;
  let z = ZERO_CACHE.get(key);
  if (z === undefined) {
    z = besselZeros(n, m)[m - 1]!;
    ZERO_CACHE.set(key, z);
  }
  return z;
}

/**
 * Evaluate a mode shape at plate coords u, v ∈ [−1, 1] (origin at centre).
 * `zero` may pass a precomputed j_{n,m} for polar modes; otherwise it is
 * looked up from the memoised table.
 */
export function evalMode(mode: Mode, u: number, v: number, zero?: number): number {
  if (mode.basis === "rect") {
    const { n, m } = mode;
    return (
      Math.cos((n * Math.PI * u) / 2) * Math.cos((m * Math.PI * v) / 2) +
      (mode.sign === 0 ? 0 : mode.sign) *
        Math.cos((m * Math.PI * u) / 2) *
        Math.cos((n * Math.PI * v) / 2)
    );
  }
  const r = Math.hypot(u, v);
  const theta = Math.atan2(v, u);
  const j = zero ?? besselZero(mode.n, mode.m);
  const angular = mode.sign > 0 ? Math.cos(mode.n * theta) : Math.sin(mode.n * theta);
  return besselJ(mode.n, j * r) * angular;
}

const POISSON_STUDIO = 0.3;

/** Mixed membrane + stiffness dispersion: ω² = (T k² + D k⁴) / (ρ h). */
export function dispersionHz(k: number, p: ChladniParams): number {
  const lab = p.plate.model === "lab";
  const h = (lab ? p.lab.thickness : p.studio.thickness) * 1e-3; // mm → m
  const E = (lab ? p.lab.elasticity : p.studio.elasticity) * 1e9; // GPa → Pa
  const nu = lab ? p.lab.poisson : POISSON_STUDIO;
  const T = lab ? p.lab.pretension : p.studio.tension;
  const rho = p.plate.density;
  const D = (E * h * h * h) / (12 * (1 - nu * nu));
  const k2 = k * k;
  const omega2 = (T * k2 + D * k2 * k2) / (rho * h);
  return Math.sqrt(Math.max(0, omega2)) / (2 * Math.PI);
}

export class AnalyticalModel implements PlateModel {
  private readonly maxIndex: number;
  private readonly maxModes: number;
  private readonly maxHz: number;
  private cacheKey = "";
  private cache: Mode[] = [];

  constructor(opts?: { maxIndex?: number; maxModes?: number; maxHz?: number }) {
    this.maxIndex = opts?.maxIndex ?? 12;
    this.maxModes = opts?.maxModes ?? 128;
    this.maxHz = opts?.maxHz ?? 12000;
  }

  modes(params: ChladniParams): Mode[] {
    const { plate, studio, lab } = params;
    const key = JSON.stringify([
      plate.shape,
      plate.aspect,
      plate.size,
      plate.model,
      plate.density,
      studio,
      lab,
    ]);
    if (key === this.cacheKey) return this.cache;

    const modes: Mode[] = [];
    const sizeM = plate.size / 100;
    if (plate.shape === "circle") {
      const R = sizeM / 2;
      for (let n = 0; n <= this.maxIndex; n++) {
        for (let m = 1; m <= this.maxIndex; m++) {
          const k = besselZero(n, m) / R;
          const freq = dispersionHz(k, params);
          if (freq > this.maxHz) continue;
          modes.push({ basis: "polar", n, m, sign: 1, k, freq });
          if (n > 0) modes.push({ basis: "polar", n, m, sign: -1, k, freq });
        }
      }
    } else {
      // square, hexagon, triangle share the ± superposition families
      // (equal Lx, Ly so the swapped products share k); a rectangle with
      // Lx ≠ Ly enumerates every ordered pair as a pure product (sign 0),
      // which is clipped to the rectangle outline at render time.
      const Lx = sizeM;
      const Ly = plate.shape === "rectangle" ? sizeM / plate.aspect : sizeM;
      if (plate.shape === "rectangle") {
        for (let n = 0; n <= this.maxIndex; n++) {
          for (let m = 0; m <= this.maxIndex; m++) {
            if (n === 0 && m === 0) continue;
            const k = Math.PI * Math.hypot(n / Lx, m / Ly);
            const freq = dispersionHz(k, params);
            if (freq > this.maxHz) continue;
            modes.push({ basis: "rect", n, m, sign: 0, k, freq });
          }
        }
      } else {
        for (let n = 0; n <= this.maxIndex; n++) {
          for (let m = n; m <= this.maxIndex; m++) {
            if (n === 0 && m === 0) continue;
            const k = Math.PI * Math.hypot(n / Lx, m / Ly);
            const freq = dispersionHz(k, params);
            if (freq > this.maxHz) continue;
            modes.push({ basis: "rect", n, m, sign: 1, k, freq });
            if (n < m) modes.push({ basis: "rect", n, m, sign: -1, k, freq });
          }
        }
      }
    }
    modes.sort((a, b) => a.freq - b.freq);
    this.cache = modes.slice(0, this.maxModes);
    this.cacheKey = key;
    return this.cache;
  }
}
