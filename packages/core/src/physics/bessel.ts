/** Bessel J_n(x) for integer n >= 0. Series for small x, asymptotic for large. */
export function besselJ(n: number, x: number): number {
  if (x < 0) return besselJ(n, -x) * (n % 2 === 0 ? 1 : -1);
  if (x >= 12) {
    // leading asymptotic form + first-order correction
    const chi = x - (n * Math.PI) / 2 - Math.PI / 4;
    const mu = 4 * n * n;
    const p = 1 - ((mu - 1) * (mu - 9)) / (2 * (8 * x) * (8 * x));
    const q = (mu - 1) / (8 * x);
    return Math.sqrt(2 / (Math.PI * x)) * (p * Math.cos(chi) - q * Math.sin(chi));
  }
  let sum = 0;
  let term = Math.pow(x / 2, n) / factorial(n);
  for (let s = 0; s < 60; s++) {
    sum += term;
    if (Math.abs(term) < 1e-12) break;
    // term_{s+1} / term_s = -(x/2)^2 / ((s+1)(s+1+n))
    term *= -((x / 2) * (x / 2)) / ((s + 1) * (s + 1 + n));
  }
  return sum;
}

/** Modified Bessel I_n(x) for integer n >= 0. Series, good for x <= ~30. */
export function besselI(n: number, x: number): number {
  if (x < 0) return besselI(n, -x) * (n % 2 === 0 ? 1 : -1);
  if (x === 0) return n === 0 ? 1 : 0;
  let sum = 0;
  let term = Math.pow(x / 2, n) / factorial(n);
  for (let s = 0; s < 80; s++) {
    sum += term;
    if (Math.abs(term) < 1e-15) break;
    term *= ((x / 2) * (x / 2)) / ((s + 1) * (s + 1 + n));
  }
  return sum;
}

function factorial(k: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return f;
}

/** First `count` positive zeros of J_n, by scan + bisection. */
export function besselZeros(n: number, count: number): number[] {
  const zeros: number[] = [];
  const step = 0.1;
  let xPrev = Math.max(n + 1, 0.1);
  let fPrev = besselJ(n, xPrev);
  for (let x = xPrev + step; zeros.length < count && x < 200; x += step) {
    const f = besselJ(n, x);
    if (f === 0 || Math.sign(f) !== Math.sign(fPrev)) {
      // bisect [xPrev, x]
      let lo = xPrev;
      let hi = x;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        const fm = besselJ(n, mid);
        if (Math.abs(hi - lo) < 1e-9 || fm === 0) {
          lo = mid;
          break;
        }
        if (Math.sign(fm) === Math.sign(besselJ(n, lo))) lo = mid;
        else hi = mid;
      }
      zeros.push((lo + hi) / 2);
    }
    xPrev = x;
    fPrev = f;
  }
  return zeros;
}
