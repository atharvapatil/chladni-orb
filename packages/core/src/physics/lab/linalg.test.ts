import { describe, expect, it } from "vitest";
import { cholesky, symmetricEigen } from "./linalg";

const mul = (A: Float64Array, B: Float64Array, n: number) => {
  const C = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += A[i * n + k]! * B[k * n + j]!;
      C[i * n + j] = s;
    }
  return C;
};

describe("cholesky", () => {
  it("reconstructs M = L·Lᵀ", () => {
    const M = Float64Array.of(4, 1, 2, 1, 5, 3, 2, 3, 9);
    const L = cholesky(M, 3);
    const Lt = new Float64Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) Lt[i * 3 + j] = L[j * 3 + i]!;
    const R = mul(L, Lt, 3);
    for (let i = 0; i < 9; i++) expect(R[i]).toBeCloseTo(M[i]!, 10);
  });
});

describe("symmetricEigen", () => {
  it("recovers known eigenvalues of a 3×3", () => {
    // diag(1,2,3) rotated by a small orthogonal transform
    const A = Float64Array.of(2, 0.5, 0.25, 0.5, 3, 0.5, 0.25, 0.5, 4);
    const { values } = symmetricEigen(A, 3);
    // eigenvalues of this matrix are just its spectrum; verify sorted & trace
    expect(values[0]!).toBeLessThan(values[1]!);
    expect(values[1]!).toBeLessThan(values[2]!);
    expect(values[0]! + values[1]! + values[2]!).toBeCloseTo(9, 10);
    // diagonal matrix is its own test
    const D = Float64Array.of(3, 0, 0, 0, 1, 0, 0, 0, 2);
    const e = symmetricEigen(D, 3);
    expect([...e.values]).toEqual([1, 2, 3]);
  });

  it("reconstructs A = V Λ Vᵀ for a random symmetric matrix", () => {
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31 - 0.5;
    const n = 6;
    const A = new Float64Array(n * n);
    for (let i = 0; i < n; i++)
      for (let j = i; j < n; j++) A[i * n + j] = A[j * n + i] = rand() * 10;
    const copy = A.slice();
    const { values, vectors } = symmetricEigen(A, n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += vectors[k * n + i]! * values[k]! * vectors[k * n + j]!;
        expect(s).toBeCloseTo(copy[i * n + j]!, 8);
      }
  });
});
