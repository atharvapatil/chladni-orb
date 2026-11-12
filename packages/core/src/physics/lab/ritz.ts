import type { ChladniParams } from "../../params";
import { cholesky, solveLower, solveUpperT, symmetricEigen } from "./linalg";

/**
 * Rayleigh–Ritz solver for a completely free rectangular Kirchhoff plate
 * with optional in-plane pretension. Trial functions are products
 * X_i(x)·Y_j(y) of free–free beam functions on [0,L]:
 *   X_0 = 1,  X_1 = √3 (2ξ − 1)   (rigid translation / rotation)
 *   X_i = cosh(βξ) + cos(βξ) − σ (sinh(βξ) + sin(βξ)), i ≥ 2,
 *   σ = (cosh β − cos β)/(sinh β − sin β),  cos β cosh β = 1.
 * Energies:
 *   K = D[A²²B⁰⁰ + A⁰⁰B²² + ν(A²⁰B⁰² + A⁰²B²⁰) + 2(1−ν)A¹¹B¹¹]
 *     + T[A¹¹B⁰⁰ + A⁰⁰B¹¹]
 *   M = ρh_eff · A⁰⁰B⁰⁰
 * and K v = ω² M v is solved via Cholesky + Jacobi.
 */

const N = 9; // beam functions per axis → 81 trial terms
const BETA = [4.7300408, 7.8532046, 10.9956078, 14.1371655, 17.2787597, 20.4203522, 23.5619449];
const beta = (i: number) => BETA[i - 2] ?? (i - 2 + 1.5) * Math.PI;
const sigma = (b: number) => (Math.cosh(b) - Math.cos(b)) / (Math.sinh(b) - Math.sin(b));

export function beamX(i: number, xi: number): number {
  if (i === 0) return 1;
  if (i === 1) return Math.sqrt(3) * (2 * xi - 1);
  const b = beta(i);
  const s = sigma(b);
  const bx = b * xi;
  return Math.cosh(bx) + Math.cos(bx) - s * (Math.sinh(bx) + Math.sin(bx));
}
function beamDX(i: number, xi: number, L: number): number {
  if (i === 0) return 0;
  if (i === 1) return (2 * Math.sqrt(3)) / L;
  const b = beta(i);
  const s = sigma(b);
  const bx = b * xi;
  return (b / L) * (Math.sinh(bx) - Math.sin(bx) - s * (Math.cosh(bx) + Math.cos(bx)));
}
function beamD2X(i: number, xi: number, L: number): number {
  if (i < 2) return 0;
  const b = beta(i);
  const s = sigma(b);
  const bx = b * xi;
  return (b / L) * (b / L) * (Math.cosh(bx) - Math.cos(bx) - s * (Math.sinh(bx) - Math.sin(bx)));
}

// 96-point Gauss–Legendre on [-1,1], computed by Newton iteration
function gaussLegendre(n: number): { x: Float64Array; w: Float64Array } {
  const x = new Float64Array(n);
  const w = new Float64Array(n);
  const m = (n + 1) >> 1;
  for (let i = 0; i < m; i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let pp = 0;
    for (let it = 0; it < 60; it++) {
      let p1 = 1;
      let p2 = 0;
      for (let j = 0; j < n; j++) {
        const p3 = p2;
        p2 = p1;
        p1 = ((2 * j + 1) * z * p2 - j * p3) / (j + 1);
      }
      pp = (n * (z * p1 - p2)) / (z * z - 1);
      const z1 = z;
      z = z1 - p1 / pp;
      if (Math.abs(z - z1) < 1e-15) break;
    }
    x[i] = -z;
    x[n - 1 - i] = z;
    w[i] = w[n - 1 - i] = 2 / ((1 - z * z) * pp * pp);
  }
  return { x, w };
}
const GL = gaussLegendre(96);

/** ∫_0^L X_i^(p) X_k^(q) dx for the given derivative orders.
 *  `scales` normalises each basis function by its L² norm — without it
 *  the cosh tails (~e^β) leave the Gram matrix numerically singular. */
function beamIntegral(
  i: number,
  k: number,
  p: number,
  q: number,
  L: number,
  scales: Float64Array,
): number {
  let s = 0;
  const evalD = (idx: number, ord: number, xi: number) =>
    ord === 0 ? beamX(idx, xi) : ord === 1 ? beamDX(idx, xi, L) : beamD2X(idx, xi, L);
  for (let g = 0; g < 96; g++) {
    const t = (GL.x[g]! + 1) / 2; // [0,1]
    const xi = t * L;
    s += GL.w[g]! * evalD(i, p, xi) * evalD(k, q, xi);
  }
  return (s * L) / 2 / (scales[i]! * scales[k]!);
}

function beamScales(L: number, nBasis: number): Float64Array {
  const s = new Float64Array(nBasis);
  const one = new Float64Array(nBasis).fill(1);
  for (let i = 0; i < nBasis; i++) s[i] = Math.sqrt(beamIntegral(i, i, 0, 0, L, one));
  return s;
}

export interface RitzResult {
  /** elastic eigenfrequencies Hz, ascending (3 rigid modes removed) */
  freqs: number[];
  omegas: number[];
  /** column-major eigenvectors over the (i,j) trial basis, one per mode */
  vectors: Float64Array;
  nBasis: number;
  a: number;
  b: number;
  /** L²-normalisation applied to each beam function (eval already divides) */
  scaleX: Float64Array;
  scaleY: Float64Array;
  /** dimensionless λ² = ω a² √(ρh/D) per mode (D=0 → NaN) */
  lam2: number[];
  /** mass-normalised: evaluates the mode shape at (x∈[0,a], y∈[0,b]) */
  eval: (mode: number, x: number, y: number) => number;
}

/** Assemble K and M (flat row-major, order (i,j) = i·N + j). */
export function assemble(
  a: number,
  b: number,
  D: number,
  nu: number,
  T: number,
  rhoHEff: number,
  nBasis = N,
): { K: Float64Array; M: Float64Array; scaleX: Float64Array; scaleY: Float64Array } {
  // 1D integral tables: [p][q][i][k]
  const tables = (L: number) => {
    const scales = beamScales(L, nBasis);
    const A: Record<string, Float64Array> = {};
    for (const [p, q] of [
      [0, 0],
      [1, 1],
      [2, 2],
      [2, 0],
      [0, 2],
    ] as const) {
      const t = new Float64Array(nBasis * nBasis);
      for (let i = 0; i < nBasis; i++)
        for (let k = 0; k < nBasis; k++) t[i * nBasis + k] = beamIntegral(i, k, p, q, L, scales);
      A[`${p}${q}`] = t;
    }
    return { A, scales };
  };
  const Ax = tables(a);
  const By = tables(b);
  const A = Ax.A;
  const B = By.A;
  const at = (T_: Record<string, Float64Array>, key: string, i: number, k: number) =>
    T_[key]![i * nBasis + k]!;

  const nb2 = nBasis * nBasis;
  const K = new Float64Array(nb2 * nb2);
  const M = new Float64Array(nb2 * nb2);
  for (let i = 0; i < nBasis; i++)
    for (let j = 0; j < nBasis; j++)
      for (let k = 0; k < nBasis; k++)
        for (let l = 0; l < nBasis; l++) {
          const row = (i * nBasis + j) * nb2 + (k * nBasis + l);
          const kE =
            D *
              (at(A, "22", i, k) * at(B, "00", j, l) +
                at(A, "00", i, k) * at(B, "22", j, l) +
                nu *
                  (at(A, "20", i, k) * at(B, "02", j, l) + at(A, "02", i, k) * at(B, "20", j, l)) +
                2 * (1 - nu) * at(A, "11", i, k) * at(B, "11", j, l)) +
            T * (at(A, "11", i, k) * at(B, "00", j, l) + at(A, "00", i, k) * at(B, "11", j, l));
          K[row] = kE;
          M[row] = rhoHEff * at(A, "00", i, k) * at(B, "00", j, l);
        }
  return { K, M, scaleX: Ax.scales, scaleY: By.scales };
}

/** Solve K v = ω² M v; returns elastic modes only (rigid triple removed). */
export function solveRitz(
  K: Float64Array,
  M: Float64Array,
  nb2: number,
): {
  omegas: Float64Array;
  vectors: Float64Array;
} {
  // M is PSD but numerically singular in directions where high-order
  // beam functions are dependent (roundoff ~1e-15 vs diag ~ρh·1); a tiny
  // relative ridge keeps Cholesky happy without moving elastic modes
  const Mc = M.slice();
  for (let i = 0; i < nb2; i++)
    Mc[i * nb2 + i] = Mc[i * nb2 + i]! + Math.abs(Mc[i * nb2 + i]!) * 1e-9;
  const L = cholesky(Mc, nb2);
  // Ã = L⁻¹ K L⁻ᵀ: solve L·X = K (columns), then L·Ãᵀ = Xᵀ (rows)
  const X = new Float64Array(nb2 * nb2);
  const col = new Float64Array(nb2);
  for (let j = 0; j < nb2; j++) {
    for (let i = 0; i < nb2; i++) col[i] = K[i * nb2 + j]!;
    solveLower(L, col, nb2);
    for (let i = 0; i < nb2; i++) X[i * nb2 + j] = col[i]!;
  }
  const At = new Float64Array(nb2 * nb2);
  for (let i = 0; i < nb2; i++) {
    for (let j = 0; j < nb2; j++) col[j] = X[i * nb2 + j]!;
    solveLower(L, col, nb2);
    for (let j = 0; j < nb2; j++) At[i * nb2 + j] = col[j]!;
  }
  const { values, vectors: U } = symmetricEigen(At, nb2);
  // physical eigenvectors v = L⁻ᵀ u
  const V = new Float64Array(nb2 * nb2);
  const keep: number[] = [];
  const maxW2 = values[nb2 - 1]!;
  for (let j = 0; j < nb2; j++) {
    if (values[j]! <= maxW2 * 1e-6) continue; // rigid modes
    keep.push(j);
    for (let i = 0; i < nb2; i++) col[i] = U[j * nb2 + i]!;
    solveUpperT(L, col, nb2);
    const dst = keep.length - 1;
    for (let i = 0; i < nb2; i++) V[dst * nb2 + i] = col[i]!;
  }
  const omegas = new Float64Array(keep.length);
  keep.forEach((j, idx) => (omegas[idx] = Math.sqrt(Math.max(0, values[j]!))));
  return { omegas, vectors: V.subarray(0, keep.length * nb2) };
}

/** Full solve for the lab params: geometry + material from ChladniParams. */
export function solveRect(params: ChladniParams, nBasis = N): RitzResult {
  const { plate, lab } = params;
  const a = plate.size / 100; // m
  const b = plate.shape === "rectangle" ? a / plate.aspect : a;
  const h = lab.thickness / 1000; // mm → m
  const E = lab.elasticity * 1e9;
  const nu = lab.poisson;
  const D = (E * h * h * h) / (12 * (1 - nu * nu));
  const rhoHEff = plate.density * h + lab.sandMass / 1000 / (a * b);
  const T = lab.pretension;
  const { K, M, scaleX, scaleY } = assemble(a, b, D, nu, T, rhoHEff, nBasis);
  const nb2 = nBasis * nBasis;
  const { omegas, vectors } = solveRitz(K, M, nb2);
  const lam2 = [...omegas].map((w) => (D > 0 ? w * a * a * Math.sqrt(rhoHEff / D) : NaN));
  return {
    freqs: [...omegas].map((w) => w / (2 * Math.PI)),
    omegas: [...omegas],
    vectors,
    nBasis,
    a,
    b,
    scaleX,
    scaleY,
    lam2,
    eval: (mode, x, y) => {
      let s = 0;
      const v = mode * nb2;
      for (let i = 0; i < nBasis; i++) {
        const Xi = beamX(i, x / a) / scaleX[i]!;
        for (let j = 0; j < nBasis; j++) {
          const c = vectors[v + i * nBasis + j]!;
          if (c !== 0) s += (c * Xi * beamX(j, y / b)) / scaleY[j]!;
        }
      }
      return s;
    },
  };
}
