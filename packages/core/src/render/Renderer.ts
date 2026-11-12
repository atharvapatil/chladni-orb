import type { ChladniParams } from "../params";
import type { Mode } from "../physics/modes";
import { besselJ } from "../physics/bessel";
import { getSharedGL, registerInstance, type SharedGL } from "./context";
import {
  COMPOSITE_FRAG,
  FIELD_FRAG,
  MAX_MODES,
  PARTICLE_INIT_FRAG,
  PARTICLE_UPDATE_FRAG,
  QUAD_VERT,
  SAND_FRAG,
  SAND_VERT,
} from "./shaders";

export interface RenderFrame {
  modes: readonly Mode[];
  /** signed per-mode coefficients from ResonanceMixer */
  coeffs: Float32Array;
  /** lab atlas (packed mode-shape tiles); re-uploaded when version changes */
  atlas?: {
    data: Float32Array;
    tileSize: number;
    cols: number;
    width: number;
    height: number;
    version: number;
  } | null;
  energy: number;
  tremor: number;
  params: ChladniParams;
  time: number;
  dpr: number;
  /** skip the particle update pass (reduced motion) */
  stillSand?: boolean;
}

const BESSEL_N = 13;
const BESSEL_X = 1024;
const BESSEL_DOMAIN = 40;
// shader mask indices: 0 circle, 1 square, 2 rectangle (square, aspect ≠ 1)

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(
      `chladni shader compile failed:\n${log}\n${src.split("\n").slice(0, 8).join("\n")}`,
    );
  }
  return s;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`chladni program link failed: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

interface Target {
  tex: WebGLTexture;
  fb: WebGLFramebuffer;
}

export class Renderer {
  private sh: SharedGL;
  private fieldRes: number;
  private P: number;
  private w = 0;
  private h = 0;
  private pendingInit = true;
  private flip = false;

  private vao!: WebGLVertexArrayObject;
  private emptyVao!: WebGLVertexArrayObject;
  private fieldProg!: WebGLProgram;
  private initProg!: WebGLProgram;
  private updateProg!: WebGLProgram;
  private sandProg!: WebGLProgram;
  private compositeProg!: WebGLProgram;
  private besselTex!: WebGLTexture;
  private atlasTex: WebGLTexture | null = null;
  private atlasVersion = -1;
  private field!: Target;
  private posA!: Target;
  private posB!: Target;
  private density: Target | undefined;
  private locs = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private modeA = new Float32Array(MAX_MODES * 4);
  private modeB = new Float32Array(MAX_MODES * 4);
  private unregister: () => void;

  constructor(opts: {
    fieldResolution?: number | undefined;
    particleTexSize?: number | undefined;
  }) {
    const sh = getSharedGL();
    if (!sh) throw new Error("Renderer requires a shared WebGL2 context");
    this.sh = sh;
    this.fieldRes = opts.fieldResolution ?? 256;
    this.P = opts.particleTexSize ?? 256;
    this.build();
    this.unregister = registerInstance(this);
  }

  rebuild(): void {
    this.locs.clear();
    this.build();
    this.pendingInit = true;
  }

  private loc(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = this.locs.get(p);
    if (!m) {
      m = new Map();
      this.locs.set(p, m);
    }
    if (!m.has(name)) m.set(name, this.sh.gl.getUniformLocation(p, name));
    return m.get(name) ?? null;
  }

  private makeTarget(w: number, h: number, internal: number, format: number, type: number): Target {
    const { gl } = this.sh;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb };
  }

  private build(): void {
    const { gl } = this.sh;
    const half = this.sh.floatKind === "half";
    const chanType = half ? gl.HALF_FLOAT : gl.FLOAT;
    const rgInternal = half ? gl.RG16F : gl.RG32F;
    const rInternal = half ? gl.R16F : gl.R32F;

    // fullscreen triangle
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.emptyVao = gl.createVertexArray()!;

    this.fieldProg = program(gl, QUAD_VERT, FIELD_FRAG);
    this.initProg = program(gl, QUAD_VERT, PARTICLE_INIT_FRAG);
    this.updateProg = program(gl, QUAD_VERT, PARTICLE_UPDATE_FRAG);
    this.sandProg = program(gl, SAND_VERT, SAND_FRAG);
    this.compositeProg = program(gl, QUAD_VERT, COMPOSITE_FRAG);

    // bessel LUT: rows n = 0..12, x ∈ [0, 40]
    this.besselTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.besselTex);
    const lut = new Float32Array(BESSEL_X * BESSEL_N);
    for (let n = 0; n < BESSEL_N; n++) {
      for (let i = 0; i < BESSEL_X; i++) {
        lut[n * BESSEL_X + i] = besselJ(n, (i / (BESSEL_X - 1)) * BESSEL_DOMAIN);
      }
    }
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      rInternal,
      BESSEL_X,
      BESSEL_N,
      0,
      gl.RED,
      chanType,
      half ? floatToHalfBits(lut) : lut,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // atlas texture placeholder; sized on first upload
    this.atlasTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.atlasVersion = -1;

    this.field = this.makeTarget(this.fieldRes, this.fieldRes, rgInternal, gl.RG, chanType);
    this.posA = this.makeTarget(this.P, this.P, rgInternal, gl.RG, chanType);
    this.posB = this.makeTarget(this.P, this.P, rgInternal, gl.RG, chanType);
    // density target is created on first resize() since it tracks output size
  }

  resize(w: number, h: number): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    const { gl } = this.sh;
    const half = this.sh.floatKind === "half";
    this.density = this.makeTarget(
      this.w,
      this.h,
      half ? gl.R16F : gl.R32F,
      gl.RED,
      half ? gl.HALF_FLOAT : gl.FLOAT,
    );
  }

  resetSand(): void {
    this.pendingInit = true;
  }

  private quad(): void {
    const { gl } = this.sh;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  private bindTex(unit: number, tex: WebGLTexture, loc: WebGLUniformLocation | null): void {
    const { gl } = this.sh;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (loc) gl.uniform1i(loc, unit);
  }

  render(f: RenderFrame): void {
    const { gl, canvas } = this.sh;
    if (this.w === 0 || this.h === 0) return;
    if (canvas.width !== this.w || canvas.height !== this.h) {
      canvas.width = this.w;
      canvas.height = this.h;
    }
    const p = f.params;

    // pack mode uniforms
    const count = Math.min(f.modes.length, MAX_MODES);
    for (let i = 0; i < count; i++) {
      const m = f.modes[i]!;
      this.modeA[i * 4] = m.basis === "rect" ? 0 : m.basis === "atlas" ? 2 : 1;
      this.modeA[i * 4 + 1] = m.basis === "atlas" ? i : m.n; // atlas tile index
      this.modeA[i * 4 + 2] = m.m;
      this.modeA[i * 4 + 3] = m.sign;
      this.modeB[i * 4] = m.basis === "polar" ? m.k * (p.plate.size / 200) : 0; // k·R = j_{n,m}
      this.modeB[i * 4 + 1] = f.coeffs[i] ?? 0;
      this.modeB[i * 4 + 2] = m.freq;
      this.modeB[i * 4 + 3] = m.pair;
    }
    const aspect = p.plate.aspect;
    const shapeIdx = p.plate.shape === "circle" ? 0 : p.plate.aspect !== 1 ? 2 : 1;
    const morph = p.look.multiTone === "morph" ? 1 : 0;

    // upload the atlas when the lab solver publishes a new version
    if (f.atlas && f.atlas.version !== this.atlasVersion && this.atlasTex) {
      const half = this.sh.floatKind === "half";
      gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        half ? gl.R16F : gl.R32F,
        f.atlas.width,
        f.atlas.height,
        0,
        gl.RED,
        half ? gl.HALF_FLOAT : gl.FLOAT,
        half ? floatToHalfBits(f.atlas.data) : f.atlas.data,
      );
      this.atlasVersion = f.atlas.version;
    }

    // 1. field pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.field.fb);
    gl.viewport(0, 0, this.fieldRes, this.fieldRes);
    gl.useProgram(this.fieldProg);
    gl.uniform4fv(this.loc(this.fieldProg, "uModeA"), this.modeA);
    gl.uniform4fv(this.loc(this.fieldProg, "uModeB"), this.modeB);
    gl.uniform1i(this.loc(this.fieldProg, "uModeCount"), count);
    gl.uniform1f(this.loc(this.fieldProg, "uMorph"), morph);
    gl.uniform1f(this.loc(this.fieldProg, "uTime"), f.time);
    gl.uniform1f(this.loc(this.fieldProg, "uRotation"), (p.plate.rotation * Math.PI) / 180);
    gl.uniform1f(this.loc(this.fieldProg, "uAspect"), aspect);
    gl.uniform1i(this.loc(this.fieldProg, "uShape"), shapeIdx);
    this.bindTex(0, this.besselTex, this.loc(this.fieldProg, "uBessel"));
    if (this.atlasTex) this.bindTex(1, this.atlasTex, this.loc(this.fieldProg, "uAtlas"));
    this.quad();

    // 2. particle init / update
    gl.viewport(0, 0, this.P, this.P);
    if (this.pendingInit) {
      for (const target of [this.posA, this.posB]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
        gl.useProgram(this.initProg);
        gl.uniform1f(this.loc(this.initProg, "uTime"), f.time);
        this.bindTex(0, this.field.tex, this.loc(this.initProg, "uField"));
        this.quad();
      }
      this.pendingInit = false;
      this.flip = false;
    } else if (!f.stillSand) {
      const src = this.flip ? this.posB : this.posA;
      const dst = this.flip ? this.posA : this.posB;
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.useProgram(this.updateProg);
      gl.uniform1f(this.loc(this.updateProg, "uTime"), f.time);
      gl.uniform1f(this.loc(this.updateProg, "uEta"), 0.03);
      gl.uniform1f(this.loc(this.updateProg, "uAlpha"), 0.012);
      gl.uniform1f(this.loc(this.updateProg, "uSettle"), 0.05);
      gl.uniform1f(this.loc(this.updateProg, "uMaxStep"), 0.02);
      gl.uniform1f(this.loc(this.updateProg, "uTremor"), f.tremor);
      gl.uniform2f(this.loc(this.updateProg, "uFieldTexel"), 1 / this.fieldRes, 1 / this.fieldRes);
      this.bindTex(0, src.tex, this.loc(this.updateProg, "uPos"));
      this.bindTex(1, this.field.tex, this.loc(this.updateProg, "uField"));
      this.quad();
      this.flip = !this.flip;
    }

    // 3. sand accumulate
    if (!this.density) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.density.fb);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const posTex = this.flip ? this.posB : this.posA;
    const count2 = Math.max(
      1,
      Math.min(this.P * this.P, Math.floor((p.look.amount / 1.5) * this.P * this.P)),
    );
    gl.useProgram(this.sandProg);
    gl.uniform1i(this.loc(this.sandProg, "uP"), this.P);
    gl.uniform1f(this.loc(this.sandProg, "uPointSize"), Math.max(1, 1.5 * f.dpr));
    this.bindTex(0, posTex.tex, this.loc(this.sandProg, "uPos"));
    gl.bindVertexArray(this.emptyVao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, count2);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);

    // 4. composite to the shared canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const lookIdx = p.look.look === "textured" ? 0 : p.look.look === "classic" ? 1 : 2;
    const rgb = hexToRgb(p.look.color);
    gl.useProgram(this.compositeProg);
    gl.uniform1i(this.loc(this.compositeProg, "uLook"), lookIdx);
    gl.uniform3f(this.loc(this.compositeProg, "uColor"), rgb[0], rgb[1], rgb[2]);
    gl.uniform2f(this.loc(this.compositeProg, "uLight"), p.look.lightX, p.look.lightY);
    gl.uniform1f(this.loc(this.compositeProg, "uPlate"), p.look.plateBrightness);
    const pcrgb = hexToRgb(p.look.plateColor);
    gl.uniform3f(this.loc(this.compositeProg, "uPlateColor"), pcrgb[0], pcrgb[1], pcrgb[2]);
    gl.uniform1f(this.loc(this.compositeProg, "uPlateAlpha"), p.look.plateAlpha);
    gl.uniform1f(this.loc(this.compositeProg, "uExposure"), p.look.exposure);
    gl.uniform1f(
      this.loc(this.compositeProg, "uHaloAmp"),
      (p.look.halo === "breathing" ? 0.3 + 0.7 * Math.min(1, f.energy) : 0.5) * 0.25,
    );
    gl.uniform1f(this.loc(this.compositeProg, "uDScale"), 0.35);
    gl.uniform2f(this.loc(this.compositeProg, "uTexel"), 1 / this.w, 1 / this.h);
    gl.uniform4f(
      this.loc(this.compositeProg, "uInk"),
      p.ink.width,
      p.ink.intensity,
      p.ink.fill,
      p.ink.glow,
    );
    this.bindTex(0, this.field.tex, this.loc(this.compositeProg, "uField"));
    this.bindTex(1, this.density.tex, this.loc(this.compositeProg, "uDensity"));
    this.quad();
  }

  dispose(): void {
    this.unregister();
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.95, 0.92, 0.85];
  const v = parseInt(m[1]!, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

// minimal float32 -> float16 bit conversion for the LUT upload
function floatToHalfBits(src: Float32Array): Uint16Array {
  const out = new Uint16Array(src.length);
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);
  for (let i = 0; i < src.length; i++) {
    f32[0] = src[i]!;
    const x = u32[0]!;
    const sign = (x >> 16) & 0x8000;
    const e = ((x >> 23) & 0xff) - 112;
    const mant = x & 0x7fffff;
    if (e <= 0) {
      out[i] = sign;
    } else if (e >= 31) {
      out[i] = sign | 0x7bff;
    } else {
      out[i] = sign | (e << 10) | (mant >> 13);
    }
  }
  return out;
}
