import { PartialAnalyser, type SpectrumSource } from "./audio/PartialAnalyser";
import type { SpectralPartial } from "./audio/peaks";
import { DEFAULT_PARAMS, mergeParams, type ChladniParams, type DeepPartial } from "./params";
import { AnalyticalModel } from "./physics/modes";
import { LabModel } from "./physics/lab/LabModel";
import { ResonanceMixer } from "./physics/ResonanceMixer";
import { Renderer } from "./render/Renderer";
import { getSharedGL } from "./render/context";

export interface ChladniPlateOptions {
  params?: DeepPartial<ChladniParams>;
  analyser?: SpectrumSource | AnalyserNode | null;
  /** cap on devicePixelRatio, default 2 */
  pixelRatio?: number;
  /** field texture size, default 256 */
  fieldResolution?: number;
  /** particle texture size P (P² grains), default 256 */
  particleTexSize?: number;
  /** default true */
  autoStart?: boolean;
}

export interface ChladniPlate {
  setParams(patch: DeepPartial<ChladniParams>): void;
  getParams(): ChladniParams;
  setAnalyser(a: SpectrumSource | AnalyserNode | null): void;
  freeze(on: boolean): void;
  /** factory params + fresh sand (Figura Reset semantics) */
  reset(): void;
  /** fresh sand only */
  resetSand(): void;
  start(): void;
  stop(): void;
  destroy(): void;
  readonly partials: readonly SpectralPartial[];
  /** per-frame signal level from the mixer; `solving` while the lab
   *  model is computing (analytical modes are used as a fallback) */
  readonly level: { energy: number; tremor: number; solving: boolean };
  readonly supported: boolean;
}

export function createChladniPlate(
  canvas: HTMLCanvasElement,
  options?: ChladniPlateOptions,
): ChladniPlate {
  const sh = getSharedGL();
  let params = options?.params
    ? mergeParams(DEFAULT_PARAMS, options.params)
    : { ...DEFAULT_PARAMS };
  const supported = sh !== null;
  const ctx2d = canvas.getContext("2d");

  if (!supported) {
    const rgb = /^#?([0-9a-f]{6})$/i.exec(params.look.color)?.[1] ?? "f3ead8";
    if (ctx2d) ctx2d.fillStyle = `#${rgb}`;
    ctx2d?.fillRect(0, 0, canvas.width, canvas.height);
    return {
      setParams() {},
      getParams: () => params,
      setAnalyser() {},
      freeze() {},
      reset() {},
      resetSand() {},
      start() {},
      stop() {},
      destroy() {},
      partials: [],
      level: { energy: 0, tremor: 0, solving: false },
      supported: false,
    };
  }

  const renderer = new Renderer({
    fieldResolution: options?.fieldResolution,
    particleTexSize: options?.particleTexSize,
  });
  const model = new AnalyticalModel();
  const lab = new LabModel();
  let labResetPending = false;
  const mixer = new ResonanceMixer();
  const dprCap = options?.pixelRatio ?? Math.min(globalThis.devicePixelRatio || 1, 2);
  const reducedMotion =
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  let pa: PartialAnalyser | null = null;
  let source: SpectrumSource | null = null;
  let raf = 0;
  let running = false;
  let visible = true;
  let destroyed = false;
  let last = 0;
  let time = 0;
  let lastPartials: readonly SpectralPartial[] = [];
  const level = { energy: 0, tremor: 0, solving: false };
  let needsFrame = true;

  const setSource = (a: SpectrumSource | AnalyserNode | null) => {
    source = a;
    pa = source ? new PartialAnalyser(source) : null;
  };
  if (options?.analyser) setSource(options.analyser);

  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
  });
  io.observe(canvas);
  const ro = new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect();
    renderer.resize(r.width * dprCap, r.height * dprCap);
    needsFrame = true;
  });
  ro.observe(canvas);

  const frame = (now: number) => {
    raf = 0;
    if (destroyed) return;
    if (!running || !visible || document.hidden) return;
    const dt = Math.min(1 / 20, last === 0 ? 1 / 60 : (now - last) / 1000);
    last = now;
    time += dt;
    if (reducedMotion && !needsFrame) return;
    needsFrame = false;

    const partials = pa ? pa.update(dt, params.listening) : [];
    lastPartials = partials;
    let modes;
    let atlas = null;
    if (params.plate.model === "lab") {
      // lab: exact/Ritz free-edge solver; falls back to analytical modes
      // while a fresh solution is still cooking
      const labModes = lab.modes(params);
      lab.step(6);
      level.solving = lab.status !== "ready";
      if (lab.status === "solving") labResetPending = true;
      if (lab.status === "ready" && labModes.length > 0) {
        modes = labModes;
        atlas = lab.atlas;
        if (labResetPending) {
          renderer.resetSand();
          labResetPending = false;
        }
      } else {
        modes = model.modes(params);
      }
    } else {
      level.solving = false;
      modes = model.modes(params);
    }
    const mix = mixer.update(dt, partials, modes, params);
    level.energy = mix.energy;
    level.tremor = mix.tremor;
    renderer.render({
      modes,
      atlas,
      coeffs: mix.coeffs,
      energy: mix.energy,
      tremor: mix.tremor,
      params,
      time,
      dpr: dprCap,
      stillSand: reducedMotion,
    });
    if (ctx2d && (canvas.width !== sh.canvas.width || canvas.height !== sh.canvas.height)) {
      canvas.width = sh.canvas.width;
      canvas.height = sh.canvas.height;
    }
    // "copy" replaces dst pixels incl. alpha — source-over would accumulate
    // translucent regions (halo, transparent plate) into an opaque dark band
    if (ctx2d) {
      ctx2d.globalCompositeOperation = "copy";
      ctx2d.drawImage(sh.canvas, 0, 0);
    }
  };

  const loop = (now: number) => {
    frame(now);
    if (running) raf = requestAnimationFrame(loop);
  };

  const api: ChladniPlate = {
    setParams(patch) {
      const prev = params;
      params = mergeParams(params, patch);
      // fresh sand on model or partial-count change (Figura rule)
      if (
        params.plate.model !== prev.plate.model ||
        params.listening.partials !== prev.listening.partials
      ) {
        renderer.resetSand();
      }
      needsFrame = true;
    },
    getParams: () => params,
    setAnalyser: setSource,
    freeze(on) {
      params = mergeParams(params, { listening: { freeze: on } });
      needsFrame = true;
    },
    reset() {
      params = { ...DEFAULT_PARAMS };
      renderer.resetSand();
      pa = source ? new PartialAnalyser(source) : null;
      needsFrame = true;
    },
    resetSand() {
      renderer.resetSand();
      needsFrame = true;
    },
    start() {
      if (running || destroyed) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    destroy() {
      destroyed = true;
      api.stop();
      io.disconnect();
      ro.disconnect();
      renderer.dispose();
    },
    get partials() {
      return lastPartials;
    },
    level,
    supported: true,
  };

  if (options?.autoStart !== false) api.start();
  return api;
}
