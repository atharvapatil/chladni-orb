import type { ChladniParams } from "../params";
import { besselJ, besselZeros } from "./bessel";

export type ModeBasis = "rect" | "polar" | "atlas";

export interface Mode {
  basis: ModeBasis;
  /** rect: cos indices; polar: n = nodal diameters, m = radial index (1-based) */
  n: number;
  m: number;
  /** rect: 0 = pure product, ±1 = cos·cos ± cos·cos family;
   *  polar: +1 = cos(nθ), −1 = sin(nθ) */
  sign: 1 | 0 | -1;
  /** 0 = singleton; 1/2 = first/second member of a degenerate pair
   *  (same k: polar cos/sin, rect ±). Pairs are always adjacent after
   *  sorting and are summed coherently by the mixer/renderer. */
  pair: 0 | 1 | 2;
  /** atlas modes only: G×G grid over u,v ∈ [−1,1], max|φ| normalised to 1 */
  shape?: { data: Float32Array; size: number };
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
  if (mode.basis === "atlas" && mode.shape) {
    // bilinear sample, clamped to the grid edge
    const s = mode.shape.size;
    const gx = Math.min(s - 1e-4, Math.max(0, (u + 1) * 0.5 * (s - 1)));
    const gy = Math.min(s - 1e-4, Math.max(0, (v + 1) * 0.5 * (s - 1)));
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const d = mode.shape.data;
    const i00 = d[y0 * s + x0]!;
    const i10 = d[y0 * s + x0 + 1]!;
    const i01 = d[(y0 + 1) * s + x0]!;
    const i11 = d[(y0 + 1) * s + x0 + 1]!;
    return (i00 * (1 - fx) + i10 * fx) * (1 - fy) + (i01 * (1 - fx) + i11 * fx) * fy;
  }
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

/** Mixed membrane + stiffness dispersion: ω² = (T k² + D k⁴) / (ρ h).
 *  Studio model only — the lab model gets its frequencies from the
 *  Ritz/exact solvers in physics/lab/. */
export function dispersionHz(k: number, p: ChladniParams): number {
  const h = p.studio.thickness * 1e-3; // mm → m
  const E = p.studio.elasticity * 1e9; // GPa → Pa
  const nu = POISSON_STUDIO;
  const T = p.studio.tension;
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

    // build groups so degenerate partners stay adjacent after sorting
    const groups: Mode[][] = [];
    const sizeM = plate.size / 100;
    if (plate.shape === "circle") {
      const R = sizeM / 2;
      for (let n = 0; n <= this.maxIndex; n++) {
        for (let m = 1; m <= this.maxIndex; m++) {
          const k = besselZero(n, m) / R;
          const freq = dispersionHz(k, params);
          if (freq > this.maxHz) continue;
          const base = { basis: "polar" as const, n, m, k, freq };
          if (n === 0) {
            groups.push([{ ...base, sign: 1, pair: 0 }]);
          } else {
            groups.push([
              { ...base, sign: 1, pair: 1 },
              { ...base, sign: -1, pair: 2 },
            ]);
          }
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
            groups.push([{ basis: "rect", n, m, sign: 0, pair: 0, k, freq }]);
          }
        }
      } else {
        for (let n = 0; n <= this.maxIndex; n++) {
          for (let m = n; m <= this.maxIndex; m++) {
            if (n === 0 && m === 0) continue;
            const k = Math.PI * Math.hypot(n / Lx, m / Ly);
            const freq = dispersionHz(k, params);
            if (freq > this.maxHz) continue;
            const base = { basis: "rect" as const, n, m, k, freq };
            if (n < m) {
              groups.push([
                { ...base, sign: 1, pair: 1 },
                { ...base, sign: -1, pair: 2 },
              ]);
            } else {
              groups.push([{ ...base, sign: 1, pair: 0 }]);
            }
          }
        }
      }
    }
    groups.sort((a, b) => a[0]!.freq - b[0]!.freq);
    const modes: Mode[] = [];
    for (const g of groups) {
      if (modes.length + g.length > this.maxModes) break;
      modes.push(...g);
    }
    this.cache = modes;
    this.cacheKey = key;
    return this.cache;
  }
}
