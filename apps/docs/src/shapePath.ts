import type { PlateShape } from "@chladni/react";

// the engine's diamond is a chamfered square stood on a corner, scaled 1.35
// and clipped |x'|+|y'| ≤ 1.9 in its own frame — in screen coords that is
// |u|+|v| ≤ √2/1.35 with the four tips flattened at 1.9/(1.35·√2)
const DIAMOND_CUT = Math.SQRT2 / 1.35;
const DIAMOND_TIP = 1.9 / (1.35 * Math.SQRT2);

/** plate outline in a size×size canvas, matching the engine's shape mask. */
export function platePath(ctx: CanvasRenderingContext2D, size: number, shape: PlateShape): void {
  const R = size / 2;
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(R, R, R, 0, Math.PI * 2);
  } else if (shape === "square") {
    ctx.rect(0, 0, size, size);
  } else {
    const a = DIAMOND_TIP * R;
    const b = (DIAMOND_CUT - DIAMOND_TIP) * R;
    const pts: [number, number][] = [
      [b, -a],
      [a, -b],
      [a, b],
      [b, a],
      [-b, a],
      [-a, b],
      [-a, -b],
      [-b, -a],
    ];
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(R + x, R + y) : ctx.lineTo(R + x, R + y)));
    ctx.closePath();
  }
}

/** is a plate-coords point (−1..1) inside the outline? */
export function insidePlate(x: number, y: number, shape: PlateShape): boolean {
  if (shape === "circle") return x * x + y * y <= 1;
  if (shape === "square") return Math.abs(x) <= 1 && Math.abs(y) <= 1;
  return (
    Math.abs(x) <= DIAMOND_TIP &&
    Math.abs(y) <= DIAMOND_TIP &&
    Math.abs(x) + Math.abs(y) <= DIAMOND_CUT
  );
}
