import type { PlateShape } from "@chladni/react";
import { useEffect, useRef } from "react";
import { insidePlate, platePath } from "./shapePath";

interface Props {
  sand: string;
  plate: string;
  shape?: PlateShape;
  /** grains, default 2200 */
  count?: number;
  /**
   * idle: grains only shiver in place.
   * connecting: pulses keep rolling out from the centre to the rim, springing
   * grains outward as they pass — the plate visibly "working".
   * listening: the same pulses, but drawn in from the rim to the centre —
   * the plate taking something in, with no waveform involved.
   */
  mode?: "idle" | "connecting" | "listening";
  /**
   * false pauses the loop (a beat later, so a CSS fade-out can finish) while
   * keeping every grain where it is; true resumes from the same positions.
   */
  active?: boolean;
}

/**
 * Loose sand on a plate, every grain sprung to its spot and shivering a
 * little. No figure, no response to sound — just enough motion to read as
 * alive. Pure 2D canvas; the Idle, Connecting and Listening states.
 */
export function SandField({
  sand,
  plate,
  shape = "circle",
  count = 2200,
  mode = "idle",
  active = true,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // live props are read by the running loop through a ref, so changing the
  // colours, shape or mode never restarts it — grains keep their positions
  const live = useRef({ sand, plate, shape, mode });
  live.current = { sand, plate, shape, mode };
  const loop = useRef<{ start(): void; stop(): void } | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const l = loop.current;
    if (!l) return;
    if (active) {
      l.start();
      return;
    }
    const id = setTimeout(l.stop, 700);
    return () => clearTimeout(id);
  }, [active]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const still = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    let raf = 0;
    let size = 0;

    // home positions in plate coords (−1..1), plus each grain's offset from
    // home and its velocity — grains are sprung to home, so a shove makes
    // them overshoot and bounce back
    const home = new Float32Array(count * 2);
    const off = new Float32Array(count * 2);
    const vel = new Float32Array(count * 2);
    let seededFor: PlateShape | null = null;
    const seed = (s: PlateShape) => {
      for (let i = 0; i < count; i++) {
        let x: number, y: number;
        do {
          x = Math.random() * 1.94 - 0.97;
          y = Math.random() * 1.94 - 0.97;
        } while (!insidePlate(x, y, s));
        if (seededFor !== null) {
          // re-home for a new outline: keep the grain where it is on screen
          // and let the spring carry it to its new spot
          off[i * 2] = off[i * 2]! + home[i * 2]! - x;
          off[i * 2 + 1] = off[i * 2 + 1]! + home[i * 2 + 1]! - y;
        }
        home[i * 2] = x;
        home[i * 2 + 1] = y;
      }
      seededFor = s;
    };
    seed(live.current.shape);

    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      size = Math.max(1, Math.round(r.width * dpr));
      canvas.width = size;
      canvas.height = size;
    });
    ro.observe(canvas);

    // connecting: pulses travel out from the centre; listening: they travel
    // in from the rim. Two pulses a period apart, so one is always on the
    // plate and the loop has no dead spot. The direction eases between modes
    // so a switch ramps the pulses down and back up instead of cutting.
    const dirFor = (m: Props["mode"]) => (m === "connecting" ? 1 : m === "listening" ? -1 : 0);
    let dir = dirFor(live.current.mode);
    const period = 2.2; // seconds per pulse
    const band = 0.12; // pulse thickness, plate units
    const kick = 2.4; // shove strength (plate units / s²)
    const spring = 60; // spring back to home
    const damping = 4.5; // low → springy overshoot and a couple of bounces
    const jitter = 0.5; // random shiver

    let last = 0;
    const draw = (ms: number) => {
      if (size === 0) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const t = ms / 1000;
      const dt = Math.min(1 / 30, last ? t - last : 1 / 60);
      last = t;
      const R = size / 2;
      const { sand, plate, shape, mode } = live.current;
      if (shape !== seededFor) seed(shape);
      // ease the pulse direction toward the mode's; passing through zero
      // ramps one pattern down before the other ramps up
      const target = dirFor(mode);
      dir += (target - dir) * Math.min(1, dt * 2.5);
      if (Math.abs(target - dir) < 0.01) dir = target;
      const amp = Math.abs(dir);
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = plate;
      platePath(ctx, size, shape);
      ctx.fill();

      // ring radii for the two live pulses (−0.2..1.35); eased so each pulse
      // leaves briskly and arrives softly, and faded at both ends of the run
      const rings: number[] = [];
      for (let n = 0; n < 2; n++) {
        const ph = ((t / period + n / 2) % 1) * 1.55 - 0.2;
        rings.push(dir > 0 ? ph : 1.15 - ph);
      }
      const edgeFade = (r: number) =>
        Math.min(1, Math.max(0, (r + 0.1) / 0.25)) *
        (1 - Math.min(1, Math.max(0, (r - 0.9) / 0.35)));

      const grain = Math.max(1, size / 260);
      ctx.fillStyle = sand;
      for (let i = 0; i < count; i++) {
        const hx = home[i * 2]!;
        const hy = home[i * 2 + 1]!;
        let ox = off[i * 2]!;
        let oy = off[i * 2 + 1]!;
        let vx = vel[i * 2]!;
        let vy = vel[i * 2 + 1]!;

        // spring + damping + shiver
        let ax = -spring * ox - damping * vx + (Math.random() - 0.5) * jitter;
        let ay = -spring * oy - damping * vy + (Math.random() - 0.5) * jitter;
        let glow = 0;
        if (amp > 0.01) {
          const d = Math.hypot(hx, hy) || 1e-4;
          for (const ring of rings) {
            const k = Math.exp(-(((d - ring) / band) ** 2)) * edgeFade(ring) * amp;
            if (k < 0.01) continue;
            glow = Math.max(glow, k);
            // shove along the pulse's direction of travel, plus a slight
            // tangential drift so the ring seems to turn as it goes
            const f = (Math.sign(dir) * k * kick) / d;
            const turn = k * kick * 0.25 * Math.sin(t * 0.6 + d * 5);
            ax += hx * f - hy * turn;
            ay += hy * f + hx * turn;
          }
        }
        vx += ax * dt;
        vy += ay * dt;
        ox += vx * dt;
        oy += vy * dt;
        off[i * 2] = ox;
        off[i * 2 + 1] = oy;
        vel[i * 2] = vx;
        vel[i * 2 + 1] = vy;

        ctx.globalAlpha = 0.85 - 0.35 * amp + 0.5 * glow;
        const x = R + (hx + ox) * R;
        const y = R + (hy + oy) * R;
        ctx.fillRect(x - grain / 2, y - grain / 2, grain, grain);
      }
      ctx.globalAlpha = 1;
      raf = still ? 0 : requestAnimationFrame(draw);
    };
    loop.current = {
      start() {
        if (!raf) {
          last = 0; // don't integrate the paused gap
          raf = requestAnimationFrame(draw);
        }
      },
      stop() {
        cancelAnimationFrame(raf);
        raf = 0;
      },
    };
    if (activeRef.current) loop.current.start();

    return () => {
      loop.current?.stop();
      loop.current = null;
      ro.disconnect();
    };
  }, [count]);

  return <canvas ref={ref} aria-hidden="true" />;
}
