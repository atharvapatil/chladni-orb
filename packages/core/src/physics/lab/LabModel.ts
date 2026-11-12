import type { ChladniParams } from "../../params";
import type { Mode, PlateModel } from "../modes";
import { circularRoots } from "./circular";
import { beamX, solveRect } from "./ritz";
import { besselI, besselJ } from "../bessel";

const GRID = 96;
const ATLAS_COLS = 16;
const ATLAS_ROWS = 8; // 16×8 = 128 tiles

export interface LabAtlas {
  /** packed mode-shape tiles: cols 16 × GRID px wide */
  data: Float32Array;
  tileSize: number;
  cols: number;
  width: number;
  height: number;
  version: number;
}

interface RawMode {
  basis: "atlas";
  n: number;
  m: number;
  sign: 1 | 0 | -1;
  pair: 0 | 1 | 2;
  k: number;
  freq: number;
  /** evaluates the unnormalised mode shape at u,v ∈ [−1,1] */
  eval: (u: number, v: number) => number;
  /** fast separable whole-grid evaluation when available (rect modes) */
  grid?: (G: number) => Float32Array;
}

/**
 * Incremental free-edge plate solver (the "Lab" model).
 * Circle: exact J+I Kirchhoff roots. Other shapes: Rayleigh–Ritz with
 * free–free beam functions (pretension honoured; ignored for the circle —
 * documented limitation). Assembly + eigensolve run in a single step
 * (~tens of ms); atlas shape evaluation is sliced per mode.
 */
export class LabModel implements PlateModel {
  readonly maxModes: number;
  readonly maxHz: number;
  readonly grid: number;
  status: "idle" | "solving" | "ready" = "idle";
  version = 0;
  /** solve timings (ms), for reporting */
  readonly timings = { solve: 0, atlas: 0 };

  private key = "";
  private solved: Mode[] = [];
  private job: { raw: RawMode[]; built: Mode[]; idx: number } | null = null;
  private readonly atlasBuf: Float32Array;

  constructor(opts?: { maxModes?: number; maxHz?: number; grid?: number }) {
    this.maxModes = opts?.maxModes ?? 128;
    this.maxHz = opts?.maxHz ?? 12000;
    this.grid = opts?.grid ?? GRID;
    this.atlasBuf = new Float32Array(ATLAS_COLS * this.grid * ATLAS_ROWS * this.grid);
  }

  get atlas(): LabAtlas {
    return {
      data: this.atlasBuf,
      tileSize: this.grid,
      cols: ATLAS_COLS,
      width: ATLAS_COLS * this.grid,
      height: ATLAS_ROWS * this.grid,
      version: this.version,
    };
  }

  modes(params: ChladniParams): Mode[] {
    const { plate, lab } = params;
    // contact radius, tip mass and support spring do not affect modes yet
    const key = JSON.stringify([
      plate.shape,
      plate.aspect,
      plate.size,
      plate.density,
      lab.thickness,
      lab.sandMass,
      lab.elasticity,
      lab.poisson,
      lab.pretension,
    ]);
    if (key !== this.key) {
      this.key = key;
      this.pending = params;
      this.status = "solving";
      this.job = null; // solve runs on the next step()
    }
    return this.solved;
  }

  private pending: ChladniParams | null = null;

  /** Advance the solve by up to budgetMs. Call `modes(params)` first. */
  step(budgetMs: number): void {
    if (this.status !== "solving" || !this.pending) return;
    const t0 = performance.now();
    if (!this.job) {
      this.timings.atlas = 0;
      this.job = { raw: this.computeRaw(this.pending), built: [], idx: 0 };
      this.timings.solve = performance.now() - t0;
      if (this.job.raw.length === 0) {
        this.solved = [];
        this.status = "ready";
        this.version++;
        return;
      }
    }
    // atlas evaluation, sliced per mode within the budget
    const job = this.job;
    const G = this.grid;
    while (job.idx < job.raw.length && performance.now() - t0 < budgetMs) {
      const raw = job.raw[job.idx]!;
      const data = raw.grid ? raw.grid(G) : new Float32Array(G * G);
      let max = 0;
      if (!raw.grid) {
        for (let y = 0; y < G; y++) {
          const v = (y / (G - 1)) * 2 - 1;
          for (let x = 0; x < G; x++) {
            const u = (x / (G - 1)) * 2 - 1;
            data[y * G + x] = raw.eval(u, v);
          }
        }
      }
      for (let i = 0; i < G * G; i++) max = Math.max(max, Math.abs(data[i]!));
      const inv = max > 0 ? 1 / max : 1;
      const tileX = (job.idx % ATLAS_COLS) * G;
      const tileY = Math.floor(job.idx / ATLAS_COLS) * G;
      for (let y = 0; y < G; y++) {
        const dRow = (tileY + y) * ATLAS_COLS * G + tileX;
        const sRow = y * G;
        for (let x = 0; x < G; x++) {
          const sv = data[sRow + x]! * inv;
          data[sRow + x] = sv;
          this.atlasBuf[dRow + x] = sv;
        }
      }
      job.built.push({ ...raw, shape: { data, size: G } });
      job.idx++;
    }
    this.timings.atlas += performance.now() - t0;
    if (job.idx >= job.raw.length) {
      this.solved = job.built;
      this.status = "ready";
      this.version++;
      this.job = null;
    }
  }

  // ---------- raw mode computation (assembly + eigen/roots, one step) ----------

  private computeRaw(params: ChladniParams): RawMode[] {
    const { plate, lab } = params;
    const sizeM = plate.size / 100;
    const h = lab.thickness / 1000;
    const E = lab.elasticity * 1e9;
    const nu = lab.poisson;
    const D = (E * h * h * h) / (12 * (1 - nu * nu));
    const groups: RawMode[][] = [];

    if (plate.shape === "circle") {
      const a = sizeM / 2; // radius, m
      const rhoHEff = plate.density * h + lab.sandMass / 1000 / (Math.PI * a * a);
      // ω = (λ²/a²)·√(D/ρh_eff); pretension is ignored for the circle
      const scale = Math.sqrt(D / rhoHEff) / (a * a * 2 * Math.PI);
      const MAX_N = 14;
      for (let n = 0; n <= MAX_N; n++) {
        const roots = circularRoots(n, nu, 8);
        for (let s = 0; s < roots.length; s++) {
          const { lambda, C } = roots[s]!;
          const freq = lambda * lambda * scale;
          if (freq > this.maxHz) continue;
          const radial = (r: number) => {
            const rr = Math.min(1, r);
            return besselJ(n, lambda * rr) + C * besselI(n, lambda * rr);
          };
          const base = { basis: "atlas" as const, n, m: s, k: lambda / a, freq };
          const evalAt = (sgn: number) => (u: number, v: number) => {
            const r = Math.hypot(u, v);
            const th = Math.atan2(v, u);
            return radial(r) * (sgn > 0 ? Math.cos(n * th) : Math.sin(n * th));
          };
          if (n === 0) {
            groups.push([{ ...base, sign: 1, pair: 0, eval: evalAt(1) }]);
          } else {
            groups.push([
              { ...base, sign: 1, pair: 1, eval: evalAt(1) },
              { ...base, sign: -1, pair: 2, eval: evalAt(-1) },
            ]);
          }
        }
      }
    } else {
      const res = solveRect(params);
      const { a, b, nBasis, scaleX, scaleY, vectors } = res;
      const nb2 = nBasis * nBasis;
      // per-axis normalised basis grids for separable atlas evaluation
      const axisGrid = (scales: Float64Array, G: number) => {
        const g = new Float64Array(nBasis * G);
        for (let i = 0; i < nBasis; i++)
          for (let x = 0; x < G; x++) g[i * G + x] = beamX(i, x / (G - 1)) / scales[i]!;
        return g;
      };
      let Xg: Float64Array | null = null;
      let Yg: Float64Array | null = null;
      const raws: RawMode[] = res.freqs
        .map((freq, i) => ({
          basis: "atlas" as const,
          n: i,
          m: 0,
          sign: 1 as const,
          pair: 0 as const,
          k: freq > 0 ? res.omegas[i]! / Math.sqrt(D / (plate.density * h)) : 0,
          freq,
          eval: (u: number, v: number) => res.eval(i, ((u + 1) / 2) * a, ((v + 1) / 2) * b),
          grid: (G: number) => {
            // φ = Σ_ij v_ij X_i(x/a) Y_j(y/b) via two-stage contraction
            Xg ??= axisGrid(scaleX, G);
            Yg ??= axisGrid(scaleY, G);
            const vec = vectors.subarray(i * nb2, i * nb2 + nb2);
            const W = new Float64Array(nBasis * G); // W[i,y] = Σ_j v_ij Y_j(y)
            for (let ii = 0; ii < nBasis; ii++)
              for (let j = 0; j < nBasis; j++) {
                const c = vec[ii * nBasis + j]!;
                if (c === 0) continue;
                for (let y = 0; y < G; y++) W[ii * G + y] = W[ii * G + y]! + c * Yg![j * G + y]!;
              }
            const out = new Float32Array(G * G);
            for (let ii = 0; ii < nBasis; ii++)
              for (let y = 0; y < G; y++) {
                const w = W[ii * G + y]!;
                if (w === 0) continue;
                for (let x = 0; x < G; x++) out[y * G + x] = out[y * G + x]! + w * Xg![ii * G + x]!;
              }
            return out;
          },
        }))
        .filter((m) => m.freq <= this.maxHz);
      // degenerate pairs: consecutive eigenvalues within 0.2% (equal sides only)
      const canPair = plate.aspect === 1;
      for (let i = 0; i < raws.length; i++) {
        const m = raws[i]!;
        const nx = raws[i + 1];
        if (canPair && nx && Math.abs(nx.freq - m.freq) / m.freq < 0.002) {
          m.pair = 1;
          nx.pair = 2;
          groups.push([m, nx]);
          i++;
        } else {
          groups.push([m]);
        }
      }
    }

    groups.sort((x, y) => x[0]!.freq - y[0]!.freq);
    const out: RawMode[] = [];
    for (const g of groups) {
      if (out.length + g.length > this.maxModes) break;
      out.push(...g);
    }
    return out;
  }
}
