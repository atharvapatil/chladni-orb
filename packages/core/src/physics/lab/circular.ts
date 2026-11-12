import { besselI, besselJ } from "../bessel";

/**
 * Exact eigen-solver for a free-edge circular Kirchhoff plate.
 * Mode shape W(r,θ) = R(r)·{cos nθ | sin nθ}, R(r) = J_n(k r) + C·I_n(k r),
 * λ = k·a. Free edge at r = a:
 *   moment  M_r = 0:  R'' + ν (R'/r − n² R/r²) = 0
 *   shear   V_r = 0:  R''' + R''/r − (1 + n²(2−ν)) R'/r² + n²(3−ν) R/r³ = 0
 * (Leissa, NASA SP-160 §2.)
 *
 * With f(x) = J_n(x) + C I_n(x) evaluated at x = λ:
 *   C = −[J'' + ν(J'/λ − n²J/λ²)] / [I'' + ν(I'/λ − n²I/λ²)]
 *   F(λ) = f''' + f''/λ − (1 + n²(2−ν)) f'/λ² + n²(3−ν) f/λ³ = 0
 */

// Derivative identities (integer n):
//   J' = (J_{n-1} − J_{n+1})/2        I' = (I_{n-1} + I_{n+1})/2
//   x²J'' + xJ' + (x²−n²)J = 0  →  J'' = −J'/x − (1−n²/x²)J
//   x²I'' + xI' − (x²+n²)I = 0  →  I'' = −I'/x + (1+n²/x²)I
// Differentiating the ODEs once more:
//   J''' = −J''/x + J'/x² − 2n²J/x³ − (1−n²/x²)·J'
//   I''' = −I''/x + I'/x² − 2n²I/x³ + (1+n²/x²)·I'

function jAt(n: number, x: number): number {
  if (n === 0) return besselJ(0, x);
  if (n < 0) return (Math.abs(n) % 2 === 0 ? 1 : -1) * besselJ(-n, x);
  return besselJ(n, x);
}
function iAt(n: number, x: number): number {
  // I_{-n} = I_n
  return besselI(Math.abs(n), x);
}

export function jPrime(n: number, x: number): number {
  return (jAt(n - 1, x) - jAt(n + 1, x)) / 2;
}
export function jSecond(n: number, x: number): number {
  return -jPrime(n, x) / x - (1 - (n * n) / (x * x)) * jAt(n, x);
}
export function jThird(n: number, x: number): number {
  return (
    -jSecond(n, x) / x +
    jPrime(n, x) / (x * x) -
    (2 * n * n * jAt(n, x)) / (x * x * x) -
    (1 - (n * n) / (x * x)) * jPrime(n, x)
  );
}
export function iPrime(n: number, x: number): number {
  return (iAt(n - 1, x) + iAt(n + 1, x)) / 2;
}
export function iSecond(n: number, x: number): number {
  return -iPrime(n, x) / x + (1 + (n * n) / (x * x)) * iAt(n, x);
}
export function iThird(n: number, x: number): number {
  return (
    -iSecond(n, x) / x +
    iPrime(n, x) / (x * x) -
    (2 * n * n * iAt(n, x)) / (x * x * x) +
    (1 + (n * n) / (x * x)) * iPrime(n, x)
  );
}

export interface CircularRoot {
  /** eigenvalue λ = k·a */
  lambda: number;
  /** J/I mixing coefficient for R(r) = J_n(λ r̂) + C·I_n(λ r̂) */
  C: number;
}

function moment(n: number, nu: number, lam: number, b: "J" | "I"): number {
  const v = b === "J" ? jAt(n, lam) : iAt(n, lam);
  const vp = b === "J" ? jPrime(n, lam) : iPrime(n, lam);
  const vpp = b === "J" ? jSecond(n, lam) : iSecond(n, lam);
  return vpp + nu * (vp / lam - (n * n * v) / (lam * lam));
}

function shear(n: number, nu: number, lam: number, b: "J" | "I"): number {
  const v = b === "J" ? jAt(n, lam) : iAt(n, lam);
  const vp = b === "J" ? jPrime(n, lam) : iPrime(n, lam);
  const vpp = b === "J" ? jSecond(n, lam) : iSecond(n, lam);
  const vppp = b === "J" ? jThird(n, lam) : iThird(n, lam);
  const l2 = lam * lam;
  return (
    vppp + vpp / lam - (1 + n * n * (2 - nu)) * (vp / l2) + n * n * (3 - nu) * (v / (l2 * lam))
  );
}

/** C(λ) from the free-edge moment condition. */
function mixC(n: number, nu: number, lam: number): number {
  return -moment(n, nu, lam, "J") / moment(n, nu, lam, "I");
}

/**
 * Frequency equation in determinant form: M_J·V_I − M_I·V_J = 0.
 * Equivalent to the shear condition for f = J + C·I but regular where
 * M_I crosses zero (the f-form has a pole there that can hide a root).
 */
export function shearF(n: number, nu: number, lam: number): number {
  return (
    moment(n, nu, lam, "J") * shear(n, nu, lam, "I") -
    moment(n, nu, lam, "I") * shear(n, nu, lam, "J")
  );
}

/**
 * Elastic roots of F for a given nodal-diameter count n, indexed s = 0,1,2…
 * (s = nodal circles). n = 1 has no s = 0 elastic root: its first root is
 * the s = 1 one (the scan starts above the rigid-body roots).
 */
export function circularRoots(n: number, nu: number, count: number, lamMax = 25): CircularRoot[] {
  const roots: CircularRoot[] = [];
  const step = 0.02;
  let lo = 0.5;
  let fLo = shearF(n, nu, lo);
  for (let hi = lo + step; hi <= lamMax && roots.length < count; hi += step) {
    const fHi = shearF(n, nu, hi);
    if (Number.isFinite(fLo) && Number.isFinite(fHi) && Math.sign(fLo) !== Math.sign(fHi)) {
      // bisect
      let a = lo;
      let b = hi;
      let fa = fLo;
      for (let i = 0; i < 80; i++) {
        const m = (a + b) / 2;
        const fm = shearF(n, nu, m);
        if (b - a < 1e-10 || fm === 0) {
          a = m;
          break;
        }
        if (Math.sign(fm) === Math.sign(fa)) {
          a = m;
          fa = fm;
        } else {
          b = m;
        }
      }
      const lam = (a + b) / 2;
      // discard poles: a true root has |F| ≈ 0, a discontinuity keeps |F| large
      if (Math.abs(shearF(n, nu, lam)) < 0.1) {
        roots.push({ lambda: lam, C: mixC(n, nu, lam) });
      }
    }
    lo = hi;
    fLo = fHi;
  }
  return roots;
}
