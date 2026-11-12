# Figura parameter catalog

Source: Figura 1.3.2 User Manual (`/tmp/chladni-research/figura-manual.txt`,
PDF at acusmagic.com). Page numbers cite the `FIGURA / USER MANUAL <n>`
footers. Figura reports 151 host parameters, 57 of them FX (p. 25).

"Face" = controls on the main window's right column (MATTER / RESPONSE
panels) and bottom bar; "Settings" = the pages behind the FIGURA wordmark
(Listening, Matter, Appearance, Lissajous, Export, About & licence, plus
Audio in the standalone app) (p. 5, 7).

Where the manual gives no factory value, the default is marked **UNKNOWN**
rather than guessed.

## A. Listening (audio → partials)

Settings → Listening shows the measured spectrum in grey and the partials
reaching the plate in orange (p. 7–8). Controls (p. 8):

| Param    | Range          | Location                                          | Default | Meaning                                                                                                                   |
| -------- | -------------- | ------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| Input    | −24 to +24 dB  | Bottom bar (face)                                 | UNKNOWN | Gain applied to analysis only — "how hard the sound shakes the plate". Never changes the audio (p. 3, 8)                  |
| Partials | 1–32           | Settings → Listening (also matters to Lab, p. 12) | UNKNOWN | How many of the strongest frequencies reach the plate. At 1, sine/square/saw at one pitch draw the same figure (p. 8, 33) |
| Decay    | 10–2000 ms     | Face (RESPONSE panel) + Settings                  | UNKNOWN | How long a frequency keeps pushing after it stops (p. 8, 10/11 face)                                                      |
| Floor    | −100 to −30 dB | Settings → Listening                              | UNKNOWN | Below this level the plate hears silence (p. 8)                                                                           |
| FREEZE   | on/off         | Bottom bar (face)                                 | off     | Holds the current figure; listening stops until released (p. 6). Counted in Undo history (p. 6)                           |
| Reset    | action         | Bottom bar (face)                                 | —       | Returns every control to factory value, switches FREEZE off, spreads fresh sand (p. 6)                                    |
| BYPASS   | DAW's own      | Top right                                         | —       | Audio passes untouched; figure keeps listening (p. 6)                                                                     |

Fixed analysis facts (p. 9): up to **32 partials**, up to **12 kHz**,
measured over about the **last 170 ms** of sound, so two tones closer than
about **20 Hz** read as one. Dense sidebands of noisy sounds blend together.

## B. Plate / Matter (sand view)

Face controls, sand view (p. 10–11):

| Param           | Range                        | Location                    | Default                    | Meaning                                                                                                                             |
| --------------- | ---------------------------- | --------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Sand · Liquid   | substance                    | Face, MATTER                | UNKNOWN                    | View substance switch                                                                                                               |
| Circle · Square | shape                        | Face, MATTER                | UNKNOWN                    | Plate shape. Rectangle, Hexagon, Triangle live in Settings → Matter; they "fill the frame and are cut along their own edge" (p. 11) |
| Exciter · Pivot | drive                        | Face (circle & square only) | UNKNOWN                    | Exciter drives from the centre; Pivot is "Chladni's classic bench". In Settings → Matter: _Excitator_ and _Perno_ (p. 10)           |
| Size            | 5–100 cm                     | Face, RESPONSE              | UNKNOWN                    | Diameter or side. Bigger → denser figures, lower resonances (p. 8, 10)                                                              |
| Tension         | UNKNOWN (face knob)          | Face, RESPONSE              | UNKNOWN                    | Tighter plate raises every figure in pitch (p. 8, 10). The face knob's numeric range is not stated                                  |
| Density         | 400–12 000 kg/m³             | Face                        | UNKNOWN                    | Material mass per volume (p. 10)                                                                                                    |
| Exciter         | 0–1 (slider)                 | Face                        | UNKNOWN                    | 0 = sound pushes whole plate evenly; raising it gathers the push at one point (p. 9, 11)                                            |
| X, Y            | plate coords (range UNKNOWN) | Face + draggable dot        | centre                     | Drive point. Modes with a still line under the point stay silent. Double-click dot → centre (p. 9)                                  |
| Grain           | see Amount (0.1–1.5)         | Face                        | UNKNOWN                    | How much sand; writes Settings → Appearance → Amount. Becomes _Width_ in Ink look (p. 11, 18)                                       |
| Rotation        | 0–360°                       | Settings → Matter (Studio)  | UNKNOWN                    | Plate rotation; works on liquid too (p. 11, 14)                                                                                     |
| Model           | Studio · Lab                 | Settings → Matter           | **Studio** (stated, p. 11) | Physics model of the plate                                                                                                          |

**Studio model** — "a stretched membrane with some stiffness… figures tuned
to stay clear while you play" (p. 11):

| Param      | Range         | Default | Notes                                    |
| ---------- | ------------- | ------- | ---------------------------------------- |
| Thickness  | 0.05–3 mm     | UNKNOWN |                                          |
| Tension    | 50–10 000 N/m | UNKNOWN |                                          |
| Elasticity | 0–400 GPa     | UNKNOWN | 0 = pure stretched membrane; steel ≈ 200 |
| Rotation   | 0–360°        | UNKNOWN |                                          |

**Lab model** — "a real free-edge plate in real units"; all five shapes;
each partial drives the plate at its own frequency; partials superpose
(p. 11–12):

| Param      | Range            | Default | Notes                                                                                |
| ---------- | ---------------- | ------- | ------------------------------------------------------------------------------------ |
| Thickness  | 0.05–12 mm       | UNKNOWN |                                                                                      |
| Sand       | 0–300 g          | UNKNOWN | More sand lowers each figure in pitch                                                |
| Elasticity | 0.1–450 GPa      | UNKNOWN | Aluminium ≈ 69                                                                       |
| Poisson    | 0.05–0.49        | UNKNOWN | Sideways swell on bending                                                            |
| Loss       | 0.001–0.2        | UNKNOWN | Damping; higher widens resonances and blends figures                                 |
| Contact    | 0.5–20 mm        | UNKNOWN | Radius of the tip pushing the plate (accepted: finite exciter disc in the Lab mixer) |
| Mass       | 0–200 g          | UNKNOWN | Mass moving with the tip ("tip mass") — accepted, no effect yet                      |
| Support    | 0–10 000 000 N/m | UNKNOWN | Spring holding the tip — accepted, no effect yet                                     |
| Pretension | 0–10 000 N/m     | UNKNOWN | In-plane tension; solid plates use 0 (Ritz model only; ignored for the circle)       |

Changing the model or the number of partials spreads fresh sand (p. 12).

## C. Response behaviour (rules, not knobs) — see figura-behaviour.md

- Near a resonance → clean figure; between two nearby resonances → blend;
  far from all → Tremor (whole-plate shake) (p. 8).
- Multi-tone: _Physical_ sums partial energies (figure holds still) vs
  _Morph_ lets them interfere (figure wanders) (p. 18).
- Sand memory: on silence the plate rings down, high modes first; sand
  stays where the last figure left it (p. 9).

## D. Appearance

Looks (p. 17): **Textured** (dark felt, cast shadows, cream ridges on still
lines, scattered grains), **Classic** (turned metal, fine grains), **Ink**
(still lines alone, no grains). Look changes painting only — same physics.
Face "Grains · Ink" tab switches to Ink; Grain knob becomes Width (p. 17).

Colour: dot on face → HSL + HEX picker with favourites row; sand, liquid
and Lissajous each keep their own colour (p. 17). All appearance controls
are automatable under the Appearance group (p. 17).

Sand, in Settings → Appearance (p. 18):

| Param            | Range             | Default | Meaning                                            |
| ---------------- | ----------------- | ------- | -------------------------------------------------- |
| Amount           | 0.1–1.5           | UNKNOWN | How much sand (face Grain knob writes this)        |
| Multi-tone       | Physical · Morph  | UNKNOWN | Energy sum (still) vs interference (wandering)     |
| Plate            | 0–2               | UNKNOWN | Plate brightness                                   |
| Light X, Light Y | −1 to 1           | UNKNOWN | Lamp position (shared with liquid, p. 19)          |
| Exposure         | 0.5–1.6           | UNKNOWN | Overall brightness, every view                     |
| Halo             | Still · Breathing | UNKNOWN | Glow around the plate breathes with sound energy   |
| Tremor           | Off · On          | UNKNOWN | Notes with no resonance shake the plate as a whole |

Ink replaces those with (p. 19): **Width** 0–1 (thread → band),
**Intensity** 0–2 (ink coverage on the felt), **Fill** 0–1 (how much of the
low valleys is inked; rich chords show more), **Glow** 0–1 (soft light
around lines; 0 = sharp ink).

Lissajous appearance (p. 19, out of v1 scope): Thickness 0.3–8, Glow 0–1,
Trail 0–0.95.

## E. Post-FX (out of v1 scope)

Chain of up to 4 effects applied in order (order matters; same effect may
repeat) on the plate (p. 20–21). Each chain row: drag handle, name/number,
on/off dot, × (p. 21). Self-moving effects have a Motion (Run/Stop) button
(p. 22). In the DAW each of the 4 slots exposes on/off + Motion + twelve
values FX n A … FX n L — automatable; the effect in a slot is saved with
the project but not automatable (p. 24).

Built-ins: Halftone, Mirror, Swirl, Displace, Tone (p. 22–23). Paid packs:
PRISMA (Prisma, 9 kaleidoscope modes), PRINT (Mezzotint, Riso, Etching,
Cyanotype, CMYK), LIGHT (Glow, Rays, Anamorphic, Neon) (p. 23). Demo: one
effect at a time, from the five built-ins (p. 25).

## F. Scenes

Nine factory scenes; a scene sets plate + look and leaves Bypass, Output,
Mix, Input and listening untouched (p. 25). Only **scene 09 — Voice &
music** is described: "moves the exciter off-centre on a slow, thin plate,
so spoken words and songs draw figures with diameters and petals" (p. 25).
The other eight scenes are unnamed in the manual (**UNKNOWN**).

## G. Not ported (audio/DAW/export/projection)

Mix, Output, BYPASS, Phase-to-audio (p. 16), PNG/MP4 export (p. 26),
projection window (p. 28–29), preset folder/sync, the other 8 scenes,
Liquid and Lissajous views, standalone audio settings (p. 31). Liquid
vessel physics for reference: Size 5–50 cm, Viscosity 0.3–2000 mPa·s,
Depth 1–50 mm, Density 0.6–13.6 g/cm³, Surface 15–500 mN/m, Refraction
1.2–1.8 (p. 13–14).

## Mapping to our library — proposed `ChladniParams`

Ranges adopt Figura's where stated (so the playground feels familiar);
defaults marked `†` are our proposals — the manual does not state factory
values. `lab` group is Phase 5 scope.

```ts
// ours: circle + square only (aspect ≠ 1 gives a rectangle)
export type PlateShape = "circle" | "square";
export type PlateDrive = "exciter" | "pivot";
export type PlateModelKind = "studio" | "lab";
export type Look = "textured" | "classic" | "ink";
export type MultiTone = "physical" | "morph";
export type Halo = "still" | "breathing";

export interface ChladniParams {
  listening: {
    /** dB, −24..+24. Analysis gain only. †0 */
    input: number;
    /** 1..32 strongest spectral peaks. †16 */
    partials: number;
    /** ms, 10..2000. Per-partial envelope after it stops. †350 */
    decay: number;
    /** dB, −100..−30. Silence threshold. †−72 */
    floor: number;
    /** Hold current figure, stop listening. */
    freeze: boolean;
  };
  plate: {
    shape: PlateShape; // †"circle"
    drive: PlateDrive; // †"exciter"
    /** cm, 5..100 (diameter / side). †30 */
    size: number;
    /** kg/m³, 400..12000. †2700 (aluminium-ish) */
    density: number;
    /** 0..1: 0 = whole plate driven evenly, 1 = point drive. †0.7 */
    exciterAmount: number;
    /** drive point in plate coords, −1..1. †(0, 0); scene-09 preset moves it */
    exciterX: number;
    exciterY: number;
    /** degrees, 0..360. †0 */
    rotation: number;
    model: PlateModelKind; // †"studio"
  };
  studio: {
    /** mm, 0.05..3. †0.8 */
    thickness: number;
    /** N/m, 50..10000. †800 */
    tension: number;
    /** GPa, 0..400 (0 = pure membrane; steel ≈200). †40 */
    elasticity: number;
  };
  lab: {
    /** mm, 0.05..12 */ thickness: number;
    /** g, 0..300 */ sandMass: number;
    /** GPa, 0.1..450 (Al ≈69) */ elasticity: number;
    /** 0.05..0.49 */ poisson: number;
    /** 0.001..0.2 — damping; widens resonances, blends figures */ loss: number;
    /** mm, 0.5..20 — drive tip radius */ contact: number;
    /** g, 0..200 — mass moving with the tip */ tipMass: number;
    /** N/m, 0..1e7 — spring holding the tip */ support: number;
    /** N/m, 0..10000 — in-plane tension; solid plates 0 */ pretension: number;
  };
  look: {
    look: Look; // †"textured"
    /** HSL/HEX sand colour. †cream */
    color: string;
    /** 0.1..1.5 — how much sand (face "Grain"). †1 */
    amount: number;
    multiTone: MultiTone; // †"physical"
    /** 0..2 plate brightness. †1 */
    plateBrightness: number;
    /** 0..1 plate surface opacity; 0 draws only the sand (ours, not Figura). †1 */
    plateAlpha: number;
    /** HSL/HEX plate surface colour (ours, not Figura). †#1a1a1c */
    plateColor: string;
    /** −1..1 lamp position. †(−0.5, 0.8) */
    lightX: number;
    lightY: number;
    /** 0.5..1.6 overall brightness. †1 */
    exposure: number;
    halo: Halo; // †"breathing"
    /** Off-resonance whole-plate shake. †true */
    tremor: boolean;
  };
  ink: {
    /** 0..1 thread → band. †0.4 */ width: number;
    /** 0..2 coverage. †1 */ intensity: number;
    /** 0..1 how much of the low valleys is inked. †0.5 */ fill: number;
    /** 0..1 soft light around lines; 0 = sharp. †0.3 */ glow: number;
  };
}
```

Actions rather than state: `reset()` (factory values + fresh sand; also
implicitly on model change and partial-count change) and `freeze(bool)`.
