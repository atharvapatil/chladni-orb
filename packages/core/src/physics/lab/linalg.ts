/**
 * Small dense symmetric eigensolver for the Rayleigh–Ritz lab model.
 * Matrices are flat row-major Float64Array.
 */

/** M = L·Lᵀ, L lower-triangular. Throws if M is not positive-definite. */
export function cholesky(M: Float64Array, n: number): Float64Array {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = M[i * n + j]!;
      for (let k = 0; k < j; k++) s -= L[i * n + k]! * L[j * n + k]!;
      if (i === j) {
        if (s <= 0) throw new Error("matrix not positive definite");
        L[i * n + i] = Math.sqrt(s);
      } else {
        L[i * n + j] = s / L[j * n + j]!;
      }
    }
  }
  return L;
}

/** Solve L·x = b in place (L lower-triangular, n×n). */
export function solveLower(L: Float64Array, b: Float64Array, n: number): void {
  for (let i = 0; i < n; i++) {
    let s = b[i]!;
    for (let k = 0; k < i; k++) s -= L[i * n + k]! * b[k]!;
    b[i] = s / L[i * n + i]!;
  }
}

/** Solve Lᵀ·x = b in place. */
export function solveUpperT(L: Float64Array, b: Float64Array, n: number): void {
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i]!;
    for (let k = i + 1; k < n; k++) s -= L[k * n + i]! * b[k]!;
    b[i] = s / L[i * n + i]!;
  }
}

/**
 * Cyclic Jacobi eigen-solve for a symmetric n×n matrix A (modified in
 * place). Returns { values, vectors } with vectors column-major
 * (vectors[j*n + i] = i-th component of j-th eigenvector), sorted by
 * ascending eigenvalue.
 */
export function symmetricEigen(
  A: Float64Array,
  n: number,
  opts?: { sweeps?: number; tol?: number },
): { values: Float64Array; vectors: Float64Array } {
  const V = new Float64Array(n * n);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;
  const maxSweeps = opts?.sweeps ?? 60;
  const tol = opts?.tol ?? 1e-12;

  const offNorm = () => {
    let s = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) s += A[i * n + j]! * A[i * n + j]!;
    return Math.sqrt(s);
  };

  for (let sweep = 0; sweep < maxSweeps && offNorm() > tol; sweep++) {
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q]!;
        if (Math.abs(apq) < 1e-15) continue;
        const app = A[p * n + p]!;
        const aqq = A[q * n + q]!;
        const theta = (aqq - app) / (2 * apq);
        const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        // A ← Jᵀ A J for the (p,q) rotation
        for (let k = 0; k < n; k++) {
          const akp = A[k * n + p]!;
          const akq = A[k * n + q]!;
          A[k * n + p] = c * akp - s * akq;
          A[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p * n + k]!;
          const aqk = A[q * n + k]!;
          A[p * n + k] = c * apk - s * aqk;
          A[q * n + k] = s * apk + c * aqk;
        }
        // V ← V J
        for (let k = 0; k < n; k++) {
          const vkp = V[k * n + p]!;
          const vkq = V[k * n + q]!;
          V[k * n + p] = c * vkp - s * vkq;
          V[k * n + q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const order = [...Array(n).keys()].sort((a, b) => A[a * n + a]! - A[b * n + b]!);
  const values = new Float64Array(n);
  const vectors = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    const src = order[j]!;
    values[j] = A[src * n + src]!;
    for (let i = 0; i < n; i++) vectors[j * n + i] = V[i * n + src]!;
  }
  return { values, vectors };
}
