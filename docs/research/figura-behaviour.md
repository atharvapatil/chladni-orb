# Figura response behaviour — the rules our engine must reproduce

Qualitative contract extracted from the Figura 1.3.2 User Manual
(`/tmp/chladni-research/figura-manual.txt`). Page numbers cite the
`FIGURA / USER MANUAL <n>` footers. These are _behaviours_, not knobs —
they follow from how the model listens and how the plate answers.

## 1. Resonance proximity decides the figure (p. 8)

"A real plate answers strongly only near its resonant frequencies, and so
does Figura's." Three regimes per incoming partial:

- **On a resonance** → a clean, stable figure.
- **Between two nearby resonances** → the figure _blends_ the two modes.
- **Far from every resonance** → no organised figure; the sand trembles
  without organising — the **Tremor** behaviour (toggleable in
  Settings → Appearance, p. 8, 18). Troubleshooting confirms: "The sand
  trembles and draws nothing — the note is far from a resonance. Turn Size
  or Tension" (p. 33).

The manual's own exercise demonstrates the sweep behaviour: hold a sine,
turn Tension slowly → sand trembles, snaps into a figure at a resonance,
trembles again, then finds the next one (p. 12). So resonance capture is
narrow and discrete, not gradual.

**Engine rule:** per partial, compute a resonance weight per mode
(Lorentzian kernel, see plate-physics.md §Resonance weighting). Field =
weighted mode superposition; when the best weight falls below a threshold
and Tremor is on, add uniform jitter instead of a figure.

## 2. Size and Tension move the resonances (p. 8, 10)

- **Size**: bigger plate → denser figures (more mode lines per figure) and
  lower resonances. "Low notes read best on large plates, high notes on
  small ones" (p. 8).
- **Tension**: tighter plate → every figure rises in pitch (all mode
  frequencies scale up together).
- **Density** (400–12 000 kg/m³, p. 10): heavier material — implied to
  lower resonances (mass loading); direction consistent with physics.

## 3. Exciter position selects which modes sound (p. 9, 33)

- Exciter slider 0 → "the sound pushes the whole plate evenly". Raising it
  gathers the drive at one point, movable via X/Y or by dragging the dot;
  double-click returns it to centre (p. 9).
- **Modes that have a still line (node) under the drive point stay
  silent** — moving the point changes which figures appear (p. 9).
- Corollary from troubleshooting: "The figure is always made of rings —
  with the exciter at the centre, only ring-shaped modes answer" (p. 33).
  On the circle, a centred point drive only excites axisymmetric modes.

**Engine rule:** multiply each mode's weight by a factor of
|φ_mode(x_e, y_e)|^β, blended in by the Exciter amount (β and the exact
blend are UNKNOWN — manual doesn't specify; see plate-physics.md).

## 4. Exciter vs Pivot drive (p. 10)

- **Exciter**: drives the plate from the centre (point drive underneath —
  "a plate on a bench with an exciter underneath", p. 10).
- **Pivot**: "Chladni's classic bench" — the historical clamped-centre,
  edge-bowed configuration. On the face it applies to circle and square;
  in Settings → Matter the two are named _Excitator_ and _Perno_ (p. 10).
- What Pivot changes concretely (boundary conditions, which modes are
  allowed) is **UNKNOWN** from the manual; physics interpretation in
  plate-physics.md (centre clamp → modes must vanish at centre, matching
  Bourke's clamped-centre nodal functions).

## 5. Physical vs Morph multi-tone (p. 18)

Settings → Appearance → **Multi-tone**:

- **Physical**: "adds up the energy of the partials and the figure holds
  still" — incoherent sum of per-partial intensity fields; static picture
  for a held chord.
- **Morph**: "lets them interfere and the figure wanders" — coherent sum;
  beating between partials makes the nodal pattern drift.

**Engine rule:** Physical = field ∝ Σ_p Σ_k w²φ² (energy sum); Morph =
|Σ_p Σ_k w φ cos(ω_p t + φ)| (amplitude sum, time-dependent).

## 6. Sand memory and ring-down (p. 9, 33–34)

- "When the sound stops, the figure stays." The plate keeps ringing for a
  moment and "fades like a real one, **high modes first**, so the figure
  simplifies as it settles."
- "The sand then stays where the last figure left it" — sand state
  persists after silence; the figure doesn't reset on its own. (p. 34:
  "the plate may be holding its last figure".)

**Engine rule:** on input below Floor, don't zero the field — run a
per-mode decay envelope with τ_k ∝ 1/f_k (high frequencies die first);
leave particle positions untouched when the field goes quiet.

## 7. Fresh sand triggers (p. 6, 12)

Fresh (re-spread, randomised) sand on:

- **Reset** — also returns every control to factory value and switches
  FREEZE off (p. 6);
- **Changing the model** (Studio ↔ Lab);
- **Changing the number of partials** (p. 12).

Notably _not_ on silence, Freeze, or ordinary parameter changes — the sand
keeps its memory through all of those.

## 8. Freeze / Reset / Bypass semantics (p. 6)

- **FREEZE**: holds the figure currently shown; listening stops until
  released. Included in Undo history.
- **Reset**: all controls → factory values, FREEZE off, fresh sand.
- **BYPASS**: DAW bypass; audio untouched "while the figure keeps
  listening" — i.e. visual analysis continues under bypass.

## 9. What a partial is (p. 8–9)

Figura picks the strongest spectral peaks: "a synth note gives its
fundamental and harmonics, a chord gives its notes, a voice gives its
formants." Each partial drives whichever plate modes are close to it
(p. 8). Analysis ceiling 12 kHz, ~170 ms window, ~20 Hz resolution; dense
noisy sidebands blend (p. 9). In Lab mode each partial drives the plate at
its own frequency and their vibrations add up; Partials = 1 makes the
plate answer only the strongest (p. 12).

## 10. Scene 09 — Voice & music (p. 25)

"moves the exciter off-centre on a slow, thin plate, so spoken words and
songs draw figures with diameters and petals." Our voice preset should
reproduce this recipe: off-centre exciter (breaks the rings-only
degeneracy of §3), low tension ("slow"), small thickness — i.e. low,
dense resonances across the voice band.

## Things the manual does NOT state (UNKNOWN)

- The resonance weighting kernel / Q width (Loss widens it in Lab, p. 11).
- Sand particle dynamics (speed, count, jitter law) — only the outcomes.
- Ring-down time constants; only the "high modes first" ordering.
- The Exciter amount → drive-locality blend curve.
- What Pivot changes about the mode set beyond the bench analogy.
- Numeric factory defaults for any of the above (see
  figura-parameters.md).
