# Plate physics reference

The physics we will implement in `@chladni/core`. Equations are
LaTeX-in-Markdown. This is _our_ model built on public literature —
nothing here is taken from Figura's implementation (its manual only
describes behaviours; see `figura-behaviour.md`).

## 1. Governing equations

### Stretched membrane (Figura "Studio" at Elasticity = 0)

Transverse displacement $w(x,y,t)$ of a membrane under tension $T$ (N/m)
with areal density $\rho h$:

$$\rho h\, \ddot{w} = T \nabla^2 w \quad\Longrightarrow\quad \omega = c\,k,\qquad c = \sqrt{\tfrac{T}{\rho h}}$$

Dispersion is _linear_: mode frequencies grow like the wave number $k$.

### Kirchhoff thin plate (Figura "Lab" idealisation)

$$D\nabla^4 w + \rho h\,\ddot{w} = 0,\qquad D = \frac{E h^3}{12(1-\nu^2)}$$

with $E$ Young's modulus, $h$ thickness, $\nu$ Poisson ratio, $\rho$
density. Dispersion is _quadratic_:

$$\omega = k^2 \sqrt{\frac{D}{\rho h}}$$

Note $D \propto h^3$: thin plates are dramatically floppier. The free-edge
boundary conditions (vanishing bending moment and effective shear) make
closed-form eigenmodes impossible except in special cases — hence §4 and
Phase 5's Ritz solver.

### Mixed membrane + stiffness (our Studio model)

Combining both restoring forces:

$$\boxed{\;\omega^2(k) = \frac{T\,k^2 + D\,k^4}{\rho h}\;}$$

$k^2$ dominates at low $k$ (membrane-like spacing), $k^4$ at high $k$
(plate-like spacing). Figura's Studio controls map directly:

- **Tension** $T$ — scales the $k^2$ term ("tighter raises every figure").
- **Elasticity** $E$ — scales $D$ via $h^3$; 0 → pure membrane.
- **Thickness** $h$ — enters $D$ (cubed) _and_ $\rho h$; thinner → "slow",
  lower resonances (cf. scene 09's "slow, thin plate").
- **Density** $\rho$ — inertial loading, $\omega \propto \rho^{-1/2}$.
- **Pretension** (Lab) — same slot as $T$ but applied to a solid plate.

## 2. Square / rectangular plate — Bourke's nodal functions

For Chladni's classic setup — centre clamped, edges free, bowed at the
edge — the standard visualisation (Paul Bourke) uses the superposition of
two standing-wave products:

$$\phi_{n,m}(x,y) = \cos\!\frac{n\pi x}{L}\cos\!\frac{m\pi y}{L} \;-\; \cos\!\frac{m\pi x}{L}\cos\!\frac{n\pi y}{L}$$

with $x,y$ measured from the plate centre, $n,m$ integers. Properties:

- $n = m$ is trivially zero — exclude it (or give it a separate branch
  with a `+` sign, which yields the symmetric complement
  $\cos n \cos m + \cos m \cos n$).
- Swapping $n \leftrightarrow m$ negates $\phi$ — same nodal lines, so
  index pairs are degenerate; keep only $n < m$ (and the `+` family as a
  second degenerate partner when we want denser figures).
- The minus sign enforces $\phi(0,0) = 0$: the centre is a node, matching
  the clamped centre. This is why the **Pivot** drive (centre clamp) maps
  to this family, while a free-centre **Exciter** drive wants the `+`
  family or a sum of both.

Wave number and frequency (mixed model):

$$ k_{n,m}^2 = \pi^2\left[\Big(\tfrac{n}{L_x}\Big)^{2} + \Big(\tfrac{m}{L_y}\Big)^{2}\right],
\qquad \omega_{n,m}^2 = \frac{T k_{n,m}^2 + D k_{n,m}^4}{\rho h}$$

Rectangles fall out for free via $L_x \neq L_y$. The **superposition
slider** generalisation used by dynamicmath.xyz and others —

$$\phi = \cos(n\pi x)\cos(m\pi y) + s\,\cos(m\pi x)\cos(n\pi y),\quad s\in[-1,1]$$

— interpolates between the symmetric ($s=+1$) and antisymmetric ($s=-1$)
families and is a cheap way to animate between related figures.

*Caveat:* these are nodal-line functions, not true free-edge eigenmodes
of a square plate. Real free-edge square modes require a numerical solve
(Phase 5, Ritz with free-free beam functions). Visually they are
excellent.

## 3. Circular plate

Mode shapes separate in polar coordinates:

$$\phi_{n,s}(r,\theta) = J_n(k_{n,s} r)\,\cos(n\theta + \psi_n)$$

$J_n$ = Bessel function of the first kind, $n$ = nodal diameter count,
$s$ = nodal circle count (+1 indexing).

### Fixed rim (simplest boundary)

Rim clamped at $r = R$: $J_n(k R) = 0$, so $k_{n,s} = j_{n,s}/R$ with
$j_{n,s}$ the $s$-th zero of $J_n$:

| $n$ | $s=1$ | $s=2$ | $s=3$ |
|----|--------|--------|--------|
| 0 | 2.4048 | 5.5201 | 8.6537 |
| 1 | 3.8317 | 7.0156 | 10.1735 |
| 2 | 5.1356 | 8.4172 | — |
| 3 | 6.3802 | 9.7610 | — |
| 4 | 7.5883 | — | — |
| 5 | 8.7715 | — | — |
| 6 | 9.9361 | — | — |

(all thirteen values from the brief: 2.4048, 3.8317, 5.1356, 5.5201,
6.3802, 7.0156, 7.5883, 8.4172, 8.6537, 8.7715, 9.7610, 9.9361, 10.1735 —
sorted into the table by index). Frequencies $\omega_{n,s} = c\,k_{n,s}$
(membrane) or $\propto k_{n,s}^2$ (plate). Fixed rim is the right model
for a *membrane* (drum); Chladni plates are free-edge, but fixed-rim zeros
still produce convincing figures and are our v1 fallback.

### Free edge (physically correct) — implemented in `physics/lab/`

For a free-edge Kirchhoff plate, $W(r,\theta) = R(r)\,\cos n\theta$ with
$R(r) = J_n(kr) + C\,I_n(kr)$, $\lambda = kR$. The free edge at $r = R$
requires vanishing moment and Kirchhoff shear:

$$R'' + \nu\Big(\frac{R'}{r} - \frac{n^2 R}{r^2}\Big) = 0,\qquad
R''' + \frac{R''}{r} - \bigl(1 + n^2(2-\nu)\bigr)\frac{R'}{r^2} + n^2(3-\nu)\frac{R}{r^3} = 0$$

$C$ falls out of the moment equation; the shear residual $F(\lambda)$
(scanned + bisected) yields the eigenvalues. Leissa *Vibration of
Plates* NASA SP-160 Table 2.5 / Itao & Crandall (1979), $\nu = 0.33$ —
$\lambda^2$:

| (n,s) | (2,0) | (0,1) | (3,0) | (1,1) | (4,0) | (5,0) | (2,1) | (0,2) | (6,0) | (3,1) | (1,2) | (4,1) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| λ² | 5.262 | 9.069 | 12.244 | 20.513 | 21.527 | 33.062 | 35.243 | 38.507 | 46.809 | 52.921 | 59.859 | 73.378 |

Frequency $\omega = (\lambda^2/R^2)\sqrt{D/\rho h_{eff}}$ with the sand
mass folded into $\rho h_{eff}$. $n=0,1$ have no $s=0$ elastic root
(rigid modes). Pretension is ignored for the circle (membrane term
incompatible with the exact form) — limitation.

### Rayleigh–Ritz free rectangle (`physics/lab/ritz.ts`)

For non-circular shapes we minimise the Kirchhoff energy over products
$X_i(x)\,Y_j(y)$ of free–free beam functions ($N=9$, 81 terms):

$$K = D\bigl[A^{22}B^{00} + A^{00}B^{22} + \nu(A^{20}B^{02} + A^{02}B^{20}) + 2(1-\nu)A^{11}B^{11}\bigr] + T\bigl[A^{11}B^{00} + A^{00}B^{11}\bigr],\quad
M = \rho h_{eff}\,A^{00}B^{00}$$

$Kv = \omega^2 Mv$ via Cholesky + Jacobi eigen-solve; the three rigid
modes are dropped. Validated against Leissa 1973 (36-term Ritz,
free square, $\nu=0.3$): $\lambda^2 = 13.489, 19.789, 24.432, 35.024,
35.024, 61.526$ — our 81-term upper bound lands just below each value.

### Mode atlas

Lab shapes (exact circle or Ritz rectangle) are precomputed on a
$96\times96$ grid per mode and packed into a texture atlas (16 tiles
per row); the field shader samples them like any other basis, and
`evalMode` bilinearly interpolates them for the mixer. The solver runs
incrementally (`LabModel.step(budgetMs)`), publishing a `version` bump
per solution so the GPU texture is only re-uploaded on change. Tip mass
and support spring are accepted parameters but not yet modelled.

### Computing $J_n$ in JS / GLSL

Series (good for small $x$):

$$J_n(x) = \sum_{s=0}^{\infty} \frac{(-1)^s}{s!\,\Gamma(n+s+1)}\Big(\frac{x}{2}\Big)^{n+2s}$$

Recurrence for the shader (three-term, stable downward or via Miller's
algorithm upward):

$$J_{n+1}(x) = \frac{2n}{x}J_n(x) - J_{n-1}(x)$$

In practice ~10 series terms suffice for $kR < 20$; or bake $J_n$ into a
1-D texture per $n$ and sample it in the fragment shader.

## 4. Hexagon / triangle (v1 approach)

No closed-form free-edge modes. v1 approach (same as Figura's description
"fill the frame and cut along their edge", p. 11):

- Evaluate the rectangular ($\cos\cdot\cos \pm \cos\cdot\cos$) or polar
  ($J_n\cos n\theta$) basis over the bounding square, then apply a
  **shape mask** that clips the plate — and the sand — to the hexagon /
  triangle outline.
- Limitation: the mask cuts figures along their edge rather than the
  modes adapting to the boundary; nodal lines won't respect true
  symmetry. Acceptable visually; flagged for Phase 5 (Ritz can use
  shape-appropriate trial functions or a penalty-method boundary).

## 5. Resonance weighting — partials → modes

Each detected partial $p$ has frequency $f_p$ and amplitude $a_p$
(post Input gain, above Floor, with its Decay envelope). Each mode $k$
has eigenfrequency $f_k$ (from the dispersion above) and shape
$\phi_k(x,y)$. Coupling weight — a Lorentzian (resonant response of a
damped oscillator, width set by Loss/Q):

$$w_{pk} = \frac{a_p}{1 + \left(\dfrac{f_p - f_k}{\gamma\, f_k}\right)^2}$$

$\gamma$ is the relative half-width: in Lab terms $\gamma \approx$
Loss (0.001–0.2); small $\gamma$ → sharp capture (clean figures only
nearly on-resonance), large $\gamma$ → broad blending. This realises the
clean / blend / tremor trichotomy of figura-behaviour.md §1.

**Physical mode** (stationary, energy sum):

$$E(x,y) = \sum_p \sum_k w_{pk}^2\,\phi_k(x,y)^2$$

**Morph mode** (coherent interference, wanders):

$$w(x,y,t) = \Big|\sum_p \sum_k w_{pk}\,\phi_k(x,y)\cos(\omega_p t + \psi_p)\Big|$$

**Exciter weighting**: a point drive at $(x_e,y_e)$ cannot excite a mode
that has a node there. Factor $| \phi_k(x_e,y_e) |^{\beta}$ per mode,
blended by the Exciter amount $e \in [0,1]$:

$$W_{pk} = w_{pk}\cdot\left[(1-e) + e\,|\phi_k(x_e,y_e)|^{\beta}\right]$$

($\beta$ shapes how sharply locality silences modes; $\beta \approx 1$–2
to start — not specified by Figura, our choice.) For **Pivot**, replace
the point factor with a centre-clamp constraint (only the antisymmetric /
centre-node family allowed, §2).

**Degenerate pairs are summed coherently.** A polar $(\cos n\theta,
\sin n\theta)$ pair or a rect $\pm$ pair shares $k$; summing their energies
separately gives $\cos^2+\sin^2=1$ — angularly uniform rings regardless of
drive point. The physical response to a point drive is the coherent
combination $c_i \propto \phi_i(x_e,y_e)$ (unit-normalised, blended with
$(1-e)/\sqrt2$), so the implementation emits *signed coefficients* per
mode and the field shader accumulates pair members into a single
$\big(\sum_i c_i\phi_i\big)^2$ term.

**Tremor**: when $\max_k w_{pk}$ is below a threshold for all partials,
skip the mode sum and add small uniform whole-plate jitter instead
(Figura: "the sand trembles without organising", p. 8).

**Ring-down**: on silence each mode carries an envelope
$A_k(t) = A_k(0)\,e^{-t/\tau_k}$ with $\tau_k \propto 1/f_k$ — high modes
die first so the figure simplifies as it settles (p. 9). Sand positions
are not touched after the field quiets.

## 6. Sand particle rule

Prior art: github.com/luciopaiva/chladni (2-D web demo) and
emergentmind.com/visualizations/chladni-plate (WebGL, Ritz eigenmodes).
Both use the same stochastic rule, which we adopt:

Per grain at position $\mathbf{x}$:

1. **Jitter ∝ local vibration**: random step of magnitude
   $\eta\,|w(\mathbf{x})|$ — grains on antinodes hop far, grains near
   nodes barely move.
2. **Downhill drift**: step $-\alpha\,\nabla|w(\mathbf{x})|$ toward lower
   vibration amplitude (gradient via finite differences of the field,
   or analytic derivatives of the mode functions).
3. **Settle**: where $|w(\mathbf{x})| < \varepsilon$ the grain stops —
   grains accumulate on nodal lines.
4. Crowding / line width is controlled by grain count N (50k–200k) and by
   the jitter amplitude $\eta$ (higher $\eta$ → fuzzier lines); Figura's
   **Amount/Grain** maps to N, **Ink Width** maps to the visual line
   threshold $\varepsilon$ rather than physics.

GPU plan: positions in ping-pong float textures, update in a fragment
pass sampling the displacement field texture.

## 7. Audio pipeline

Web Audio `AnalyserNode` → peak picking → partials:

- `fftSize` 4096–8192 at 48 kHz → bin width ≈ 11.7 Hz / 5.9 Hz. Figura's
  "~170 ms window ≈ 20 Hz resolution" (p. 9) corresponds to ~8192
  samples at 48 kHz; use 8192 by default, 4096 on weaker devices.
- Chain: `getFloatFrequencyData` → **Input** gain (dB, analysis only) →
  drop bins below **Floor** → local-maximum **peak picking** with
  **parabolic interpolation** on the log-magnitude bins (refines $f_p$
  to sub-bin accuracy and estimates amplitude) → keep the top-N peaks by
  amplitude = **Partials** (≤32) → per-partial **Decay** envelope
  (attack fast, release over the Decay time so partials keep pushing
  after they stop, p. 8) → **Freeze** halts the whole update.
- Cap analysis at 12 kHz to match Figura's stated band (p. 9).

## 8. References

- Paul Bourke, *Chladni Plates* — square-plate nodal functions §2.
  https://paulbourke.net/geometry/chladni/ (also
  https://paulbourke.net/geometry/polygonmesh/ mirrors).
- dynamicmath.xyz Chladni patterns — superposition slider idea (§2).
  https://dynamicmath.xyz/chladni-patterns/
- github.com/luciopaiva/chladni — stochastic sand rule (§6).
  https://github.com/luciopaiva/chladni
- emergentmind.com — Chladni plate visualisation with free-edge Ritz
  eigenmodes (§4, §6, Phase 5 approach).
  https://emergentmind.com/visualizations/chladni-plate
- cymatics npm package — prior art for JS chladni fields.
  https://www.npmjs.com/package/cymatics
- vibrationdata.com circular plate tutorial (Bessel fixed-rim zeros §3).
  https://www.vibrationdata.com/circular.pdf
- Itao, K. & Crandall, S.H. (1979), "Natural modes and natural
  frequencies of uniform, circular, free-edge plates",
  *J. Appl. Mech.* 46(2) — free-edge eigenvalues for ν = 0.33 (§3).
  doi:10.1115/1.3424569
- Leissa, A.W., *Vibration of Plates* (1969) — eigenvalue tables.
- Figura 1.3.2 User Manual — behavioural targets (see
  figura-parameters.md / figura-behaviour.md).

*Verification note:* the Bessel zeros and dispersion relations are
textbook-standard; the free-edge $\lambda_{n,s}$ table is deliberately
left UNKNOWN pending the Itao & Crandall paper rather than quoted from
memory.
$$
