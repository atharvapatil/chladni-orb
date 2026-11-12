/** GLSL ES 3.00 sources. Shared snippets are concatenated where needed. */

export const MAX_MODES = 128;

export const QUAD_VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const COMMON = `
float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
vec2 rot(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}
// shape: 0 circle, 1 square, 2 rectangle, 3 hexagon, 4 triangle
float shapeMask(int shape, vec2 p, float aspect) {
  float d;
  if (shape == 0) {
    d = length(p);
  } else if (shape == 1) {
    d = max(abs(p.x), abs(p.y));
  } else if (shape == 2) {
    d = max(abs(p.x), abs(p.y * aspect));
  } else if (shape == 3) {
    const float h = 0.8660254;
    d = max(abs(p.y) / h,
        max(abs(h * p.x + 0.5 * p.y), abs(h * p.x - 0.5 * p.y)) / h);
  } else {
    // equilateral, pointing up, circumradius 1
    float inside = max(-p.y - 0.5, p.y - (1.0 - 1.7320508 * abs(p.x)));
    d = inside * 20.0 + 0.5; // signed distance-ish to a 0..1 edge value
    return smoothstep(1.0, 0.5, d);
  }
  return smoothstep(1.0, 0.99, d);
}
`;

export const FIELD_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uBessel;
uniform vec4 uModeA[${MAX_MODES}]; // basis(0 rect,1 polar), n, m, sign
uniform vec4 uModeB[${MAX_MODES}]; // bessel zero, coef, freq, pair(0/1/2)
uniform sampler2D uAtlas;         // mode-shape tiles for basis=2 (16×96 px per tile, 8 rows)
uniform int uModeCount;
uniform float uMorph;    // 0 physical, 1 morph
uniform float uTime;
uniform float uRotation; // radians
uniform float uAspect;
uniform int uShape;
in vec2 vUv;
out vec4 outColor;
const float PI = 3.141592653589793;
${COMMON}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p = rot(p, -uRotation);
  float mask = shapeMask(uShape, p, uAspect);
  // rectangle modes live on plate coords with v scaled by aspect
  vec2 q = vec2(p.x, p.y * uAspect);
  float E = 0.0;
  float W = 0.0;
  float acc = 0.0;   // coherent sum inside a degenerate pair
  float n2 = 0.0;    // Σ coef²
  for (int i = 0; i < ${MAX_MODES}; i++) {
    if (i >= uModeCount) break;
    vec4 A = uModeA[i];
    vec4 B = uModeB[i];
    float coef = B.y;
    n2 += coef * coef;
    float phi;
    if (A.x < 0.5) {
      float n = A.y, m = A.z;
      float prod = cos(n * PI * q.x * 0.5) * cos(m * PI * q.y * 0.5);
      if (A.w != 0.0) {
        prod += A.w * cos(m * PI * q.x * 0.5) * cos(n * PI * q.y * 0.5);
      }
      phi = prod;
    } else if (A.x > 1.5) {
      // atlas mode: tile index in A.y, bilinear sample over q ∈ [−1,1]
      float idx = A.y;
      vec2 tuv = clamp(q * 0.5 + 0.5, 0.0, 1.0);
      phi = texture(uAtlas, vec2((mod(idx, 16.0) + tuv.x) / 16.0,
                                (floor(idx / 16.0) + tuv.y) / 8.0)).r;
    } else {
      float n = A.y;
      float r = length(p);
      float th = atan(p.y, p.x);
      float J = texture(uBessel, vec2(B.x * r / 40.0, (n + 0.5) / 13.0)).r;
      phi = J * (A.w > 0.0 ? cos(n * th) : sin(n * th));
    }
    float c = coef * phi;
    if (uMorph > 0.5) {
      W += c * cos(B.z * 0.0314159 * uTime); // omega*t slowed ~1/200
    }
    if (B.w < 0.5) {
      E += c * c;            // singleton
    } else if (B.w < 1.5) {
      acc = c;               // first of a pair
    } else {
      acc += c;              // second: close the pair coherently
      E += acc * acc;
      acc = 0.0;
    }
  }
  float norm = max(1e-4, sqrt(n2));
  float val = uMorph > 0.5 ? abs(W) / norm : sqrt(E) / norm;
  outColor = vec4(val, mask, 0.0, 1.0);
}`;

export const PARTICLE_INIT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform float uTime;
in vec2 vUv;
out vec4 outColor;
${COMMON}
void main() {
  vec2 base = vUv * 761.31 + fract(uTime * 0.37) * 11.7;
  vec2 p = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    vec2 c = vec2(hash(base + float(i) * 1.37), hash(base + float(i) * 2.71 + 4.29)) * 2.0 - 1.0;
    p = c;
    if (texture(uField, c * 0.5 + 0.5).g > 0.5) break;
  }
  outColor = vec4(p, 0.0, 1.0);
}`;

export const PARTICLE_UPDATE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPos;
uniform sampler2D uField;
uniform vec2 uFieldTexel;
uniform float uTime;
uniform float uEta;
uniform float uAlpha;
uniform float uSettle;
uniform float uMaxStep;
uniform float uTremor;
in vec2 vUv;
out vec4 outColor;
${COMMON}
void main() {
  vec2 pos = texture(uPos, vUv).rg;
  vec2 uv = pos * 0.5 + 0.5;
  float a = texture(uField, uv).r;
  float gx = texture(uField, uv + vec2(uFieldTexel.x, 0.0)).r -
             texture(uField, uv - vec2(uFieldTexel.x, 0.0)).r;
  float gy = texture(uField, uv + vec2(0.0, uFieldTexel.y)).r -
             texture(uField, uv - vec2(0.0, uFieldTexel.y)).r;
  vec2 grad = vec2(gx, gy) / (4.0 * uFieldTexel); // per plate unit
  // grains at nodes stop entirely; elsewhere jitter + capped downhill drift
  float hop = smoothstep(uSettle, uSettle * 3.0, a);
  float jit = uEta * hop * (0.3 + a) + 0.4 * uEta * uTremor;
  vec2 seed = vUv * 913.7 + gl_FragCoord.xy * 0.37 + fract(uTime) * 7.13;
  vec2 rnd = vec2(hash(seed), hash(seed + 1.7)) * 2.0 - 1.0;
  float gl2 = length(grad);
  vec2 drift = gl2 > 1e-6 ? uAlpha * hop * (grad / gl2) * min(1.0, gl2) : vec2(0.0);
  vec2 np = pos + jit * rnd - drift;
  vec2 d = np - pos;
  float dl = length(d);
  if (dl > uMaxStep) np = pos + d * (uMaxStep / dl);
  if (texture(uField, np * 0.5 + 0.5).g < 0.5) np = pos; // reflect at the rim
  outColor = vec4(np, 0.0, 1.0);
}`;

export const SAND_VERT = `#version 300 es
uniform sampler2D uPos;
uniform int uP;
uniform float uPointSize;
void main() {
  ivec2 tc = ivec2(gl_VertexID % uP, gl_VertexID / uP);
  vec2 pos = texelFetch(uPos, tc, 0).rg;
  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = uPointSize;
}`;

export const SAND_FRAG = `#version 300 es
precision mediump float;
out vec4 outColor;
void main() {
  outColor = vec4(1.0, 0.0, 0.0, 1.0);
}`;

export const COMPOSITE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uField;   // R field, G mask
uniform sampler2D uDensity; // accumulated grain hits
uniform int uLook;          // 0 textured, 1 classic, 2 ink
uniform vec3 uColor;
uniform vec2 uLight;        // lamp x,y
uniform float uPlate;
uniform float uExposure;
uniform float uHaloAmp;
uniform float uDScale;      // density -> coverage scale
uniform vec2 uTexel;        // density texel size
uniform vec4 uInk;          // width, intensity, fill, glow
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  vec4 F = texture(uField, vUv);
  float field = F.r;
  float mask = F.g;
  float d = texture(uDensity, vUv).r;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (mask > 0.5) {
    vec3 plate;
    if (uLook == 0) plate = vec3(0.10, 0.10, 0.11);
    else if (uLook == 1) plate = vec3(0.34, 0.34, 0.36) * (0.9 + 0.1 * sin(length(p) * 140.0));
    else plate = vec3(0.13, 0.13, 0.13);
    col = plate * uPlate;
    alpha = 1.0;
    if (uLook < 2) {
      float g = clamp(d * uDScale, 0.0, 1.0);
      vec3 sc = uColor;
      if (uLook == 0) {
        float gx = texture(uDensity, vUv + vec2(uTexel.x, 0.0)).r -
                   texture(uDensity, vUv - vec2(uTexel.x, 0.0)).r;
        float gy = texture(uDensity, vUv + vec2(0.0, uTexel.y)).r -
                   texture(uDensity, vUv - vec2(0.0, uTexel.y)).r;
        vec3 nrm = normalize(vec3(-gx * 6.0, -gy * 6.0, 1.0));
        vec3 L = normalize(vec3(uLight, 0.8));
        float diff = clamp(dot(nrm, L), 0.0, 1.0);
        sc *= 0.35 + 0.85 * diff;
      }
      col = mix(col, sc, g);
    } else {
      float lines = smoothstep(0.08 + 0.35 * uInk.x, 0.0, field);
      float valleys = uInk.z * smoothstep(0.6, 0.05, field) * 0.35;
      float ink = lines + valleys;
      float glow = 0.0;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7853982;
        float f2 = texture(uField, vUv + vec2(cos(a), sin(a)) * uInk.w * 0.05).r;
        glow += smoothstep(0.08 + 0.35 * uInk.x, 0.0, f2);
      }
      ink += uInk.w * glow * 0.125 * 0.5;
      ink = clamp(uInk.y * ink, 0.0, 1.0);
      col = mix(col, uColor, ink);
    }
  } else {
    float r = length(p);
    float halo = max(0.0, 1.0 - max(0.0, r - 1.0) * 3.0) * uHaloAmp;
    col = uColor * halo;
    alpha = halo;
  }
  col *= uExposure;
  outColor = vec4(col * alpha, alpha); // premultiplied
}`;
