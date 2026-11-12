/** One shared hidden WebGL2 context for every ChladniPlate instance. */

export interface SharedGL {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  /** "float" needs EXT_color_buffer_float; "half" falls back to EXT_color_buffer_half_float */
  floatKind: "float" | "half";
}

interface Listener {
  rebuild(): void;
}

let shared: SharedGL | null | undefined;
let lost = false;
const listeners = new Set<Listener>();

export function getSharedGL(): SharedGL | null {
  if (shared !== undefined) return shared;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;width:0;height:0;pointer-events:none";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });
  if (!gl) {
    shared = null;
    return null;
  }
  let floatKind: SharedGL["floatKind"] | null = null;
  if (gl.getExtension("EXT_color_buffer_float")) floatKind = "float";
  else if (gl.getExtension("EXT_color_buffer_half_float")) floatKind = "half";
  if (!floatKind) {
    shared = null;
    return null;
  }
  gl.getExtension("OES_texture_float_linear");
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
    for (const l of listeners) l.rebuild();
  });
  shared = { canvas, gl, floatKind };
  return shared;
}

export function wasContextLost(): boolean {
  return lost;
}

export function registerInstance(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
