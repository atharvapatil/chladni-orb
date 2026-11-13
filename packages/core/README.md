# chladni-orb-core

Voice-reactive Chladni plate engine for the web. Audio in, sand figures
out: the strongest partials of a live spectrum drive the vibration modes
of a simulated plate through Lorentzian resonance, and thousands of
grains jitter off the antinodes and settle on the nodal lines — rendered
in a single WebGL2 pass pipeline.

## Install

```sh
npm install chladni-orb-core
```

## Usage

```ts
import { createChladniPlate, SimulatedVoice, createMicAnalyser } from "chladni-orb-core";

const plate = createChladniPlate(document.querySelector("canvas")!);

// any SpectrumSource | AnalyserNode | null
plate.setAnalyser(new SimulatedVoice()); // built-in demo source
const mic = await createMicAnalyser(); // or the real thing
plate.setAnalyser(mic.analyser);

plate.setParams({ plate: { shape: "square" }, look: { look: "ink" } });
plate.freeze(true);
plate.resetSand();
plate.destroy();
```

## API

### `createChladniPlate(canvas, options?)`

Creates a plate on a `<canvas>` and (by default) starts rendering. All
plates share one WebGL2 context and blit into their own canvas. The
plate follows the canvas's CSS box via `ResizeObserver`, pauses when
off-screen or the tab is hidden, and draws a single frame under
`prefers-reduced-motion: reduce`.

| Option            | Type                                     | Default                    | Description                                                                                             |
| ----------------- | ---------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `params`          | `DeepPartial<ChladniParams>`             | `DEFAULT_PARAMS`           | Initial settings, merged over the defaults. See the [parameter reference](#parameter-reference).        |
| `analyser`        | `SpectrumSource \| AnalyserNode \| null` | `null`                     | Initial audio source.                                                                                   |
| `state`           | `AgentState`                             | `"talking"`                | `idle`, `connecting`, `listening` or `talking`. See `setState` below.                                   |
| `pixelRatio`      | `number`                                 | `min(devicePixelRatio, 2)` | Cap on the render resolution multiplier.                                                                |
| `fieldResolution` | `number`                                 | `256`                      | Side of the vibration-field texture (N×N). Higher gives sharper nodal lines at a higher per-frame cost. |
| `particleTexSize` | `number`                                 | `256`                      | Side of the particle texture; up to N² grains (65 536 at 256). `look.amount` scales how many are drawn. |
| `autoStart`       | `boolean`                                | `true`                     | Start the render loop immediately. Pass `false` and call `start()` yourself.                            |

### The `ChladniPlate` handle

| Member                           | Signature                                              | Description                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setParams(patch)`               | `(DeepPartial<ChladniParams>) => void`                 | Merge a patch over the current params. Changing `plate.model`, `listening.partials`, `plate.shape` or `plate.aspect` re-seeds the sand.                                                                                                                                                                  |
| `getParams()`                    | `() => ChladniParams`                                  | The fully-resolved current params.                                                                                                                                                                                                                                                                       |
| `setAnalyser(source)`            | `(SpectrumSource \| AnalyserNode \| null) => void`     | Swap the audio source; `null` is silence.                                                                                                                                                                                                                                                                |
| `setState(state)` / `getState()` | `(AgentState) => void` / `() => AgentState`            | The plate as a voice agent's presence. `talking` is the normal plate. The quiet states ignore the sound: `idle` rests the sand evenly spread and shivering, `connecting` adds pulses rolling out from the centre, `listening` pulses drawing in from the rim. The same grains carry over between states. |
| `freeze(on)`                     | `(boolean) => void`                                    | Hold / release the figure (sets `listening.freeze`).                                                                                                                                                                                                                                                     |
| `reset()`                        | `() => void`                                           | Factory params **and** fresh sand.                                                                                                                                                                                                                                                                       |
| `resetSand()`                    | `() => void`                                           | Fresh sand only; params untouched.                                                                                                                                                                                                                                                                       |
| `start()` / `stop()`             | `() => void`                                           | Control the render loop.                                                                                                                                                                                                                                                                                 |
| `destroy()`                      | `() => void`                                           | Release GL resources and observers. The handle is inert afterwards.                                                                                                                                                                                                                                      |
| `partials`                       | `readonly SpectralPartial[]`                           | Tracked peaks from the last frame — `{ freq: Hz, amp: 0..1 }`, strongest first.                                                                                                                                                                                                                          |
| `level`                          | `{ energy: number; tremor: number; solving: boolean }` | Live meters: summed partial amplitude, 0–1 off-resonance shake, and whether the Lab model is still solving (analytical modes are used meanwhile).                                                                                                                                                        |
| `supported`                      | `boolean`                                              | `false` when WebGL2 / float render targets are unavailable; a flat plate colour is painted and every method is a no-op.                                                                                                                                                                                  |

### Audio sources

Anything that satisfies `SpectrumSource` can drive a plate — a Web Audio
`AnalyserNode` does out of the box:

```ts
interface SpectrumSource {
  readonly fftSize: number;
  readonly frequencyBinCount: number;
  readonly context: { readonly sampleRate: number };
  getFloatFrequencyData(array: Float32Array): void; // dBFS per bin
}
```

| Export                            | Returns                         | Description                                                                                                                                                              |
| --------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createMicAnalyser(ctx?)`         | `Promise<AnalyserHandle>`       | Microphone via `getUserMedia` (echo cancellation, noise suppression and AGC off). Needs a secure context and a user gesture.                                             |
| `createElementAnalyser(el, ctx?)` | `AnalyserHandle`                | Taps an `<audio>` / `<video>` element and routes it on to the speakers.                                                                                                  |
| `new SimulatedVoice()`            | `SpectrumSource`                | A synthetic voice: gliding pitch with harmonics, three wandering formants, syllabic gating and pauses. Self-clocked, shareable between plates. `seek(t)` sets its clock. |
| `AnalyserHandle`                  | `{ analyser, context, stop() }` | What the two `create*` helpers return; `stop()` disconnects and releases the stream / element.                                                                           |
| `PartialAnalyser`, `pickPeaks`    | —                               | The peak picker and partial tracker the plate uses internally, exported for custom pipelines.                                                                            |

Both `create*` helpers configure the analyser with `fftSize = 8192` and
`smoothingTimeConstant = 0.5`; if you build your own node, those are good
values.

### Presets

`PRESETS` is a `Record<string, Preset>` of starter scenes, each a
`DeepPartial<ChladniParams>` with a `label` and `description`:

| Key                    | Scene                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `voice`                | Slow thin circular plate, off-centre exciter — diameters and petals for speech and song. |
| `classic-square-pivot` | Chladni's bench: centre-clamped square plate, turned-metal look.                         |
| `ink-square`           | Nodal lines only, drawn in ink on a square plate.                                        |
| `drumhead`             | Pure stretched membrane: elasticity 0, high tension.                                     |
| `lab-aluminium`        | Free-edge aluminium disc in real units (Lab model).                                      |

```ts
import { PRESETS } from "chladni-orb-core";
plate.setParams(PRESETS["drumhead"].params);
```

### Everything else that is exported

`DEFAULT_PARAMS`, `PARAM_SCHEMA` (label / kind / range / unit / help per
key — the docs' tuning panel and the table below are generated from it),
`mergeParams`, the param types (`ChladniParams`, `DeepPartial`,
`PlateShape`, `PlateDrive`, `PlateModelKind`, `Look`, `MultiTone`,
`Halo`), and the physics internals for the curious: `AnalyticalModel`,
`LabModel`, `ResonanceMixer`, `evalMode`, `dispersionHz`, Bessel helpers,
plus `Renderer` and `getSharedGL`.

## Parameter reference

`ChladniParams` has six groups. `setParams` takes a
`DeepPartial<ChladniParams>` merged over the current state; the React
component merges over `DEFAULT_PARAMS` instead so its `params` prop is
authoritative. Ranges are the ones the schema (and the docs' Tune panel)
enforce — values outside them are not clamped by the engine.

### `listening` — how audio becomes partials

| Key                  | Label      | Type / values         | Default  | Description                                                                                                                  |
| -------------------- | ---------- | --------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `listening.input`    | Input      | `number` -24..24 dB   | `0`      | How hard the sound shakes the plate. Never changes the audio.                                                                |
| `listening.partials` | Partials   | `number` 1..32        | `16`     | How many of the strongest frequencies reach the plate.                                                                       |
| `listening.decay`    | Decay      | `number` 10..2000 ms  | `350`    | How long a frequency keeps pushing after it stops.                                                                           |
| `listening.floor`    | Floor      | `number` -100..-30 dB | `-72`    | Below this level the plate hears silence.                                                                                    |
| `listening.freeze`   | Freeze     | `boolean`             | `false`  | Hold the current figure; listening stops.                                                                                    |
| `listening.idle`     | In silence | `"hold"` \| `"relax"` | `"hold"` | Hold keeps the last figure when the sound stops; Relax lets the sand spread back over the plate and shiver until it returns. |

### `plate` — geometry and drive

| Key                   | Label     | Type / values                           | Default     | Description                                                                                       |
| --------------------- | --------- | --------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `plate.shape`         | Shape     | `"circle"` \| `"square"` \| `"diamond"` | `"circle"`  | Plate outline. A square with aspect ≠ 1 is a rectangle; diamond is a square with the corners cut. |
| `plate.drive`         | Drive     | `"exciter"` \| `"pivot"`                | `"exciter"` | Exciter drives from a point; Pivot is Chladni's centre-clamped bench.                             |
| `plate.size`          | Size      | `number` 5..100 cm                      | `30`        | Diameter or side. Bigger → denser figures, lower resonances.                                      |
| `plate.aspect`        | Aspect    | `number` 0.5..2                         | `1`         | Rectangle width/height ratio. Ignored for other shapes.                                           |
| `plate.density`       | Density   | `number` 400..12000 kg/m³               | `2700`      | How heavy the material is.                                                                        |
| `plate.exciterAmount` | Exciter   | `number` 0..1                           | `0.7`       | 0 = whole plate pushed evenly, 1 = point drive.                                                   |
| `plate.exciterX`      | Exciter X | `number` -1..1                          | `0`         | Drive point. Modes with a still line under it stay silent.                                        |
| `plate.exciterY`      | Exciter Y | `number` -1..1                          | `0`         | Drive point. Modes with a still line under it stay silent.                                        |
| `plate.rotation`      | Rotation  | `number` 0..360 °                       | `0`         | Plate rotation.                                                                                   |
| `plate.model`         | Model     | `"studio"` \| `"lab"`                   | `"studio"`  | Studio is a stretched membrane with some stiffness; Lab a free-edge plate in real units.          |

### `studio` — the Studio material model (`plate.model: "studio"`)

| Key                 | Label      | Type / values          | Default | Description                                         |
| ------------------- | ---------- | ---------------------- | ------- | --------------------------------------------------- |
| `studio.thickness`  | Thickness  | `number` 0.05..3 mm    | `0.8`   | Studio plate thickness.                             |
| `studio.tension`    | Tension    | `number` 50..10000 N/m | `800`   | Tighter raises every figure in pitch.               |
| `studio.elasticity` | Elasticity | `number` 0..400 GPa    | `40`    | 0 is a pure stretched membrane; steel is about 200. |

### `lab` — the Lab material model (`plate.model: "lab"`)

| Key              | Label          | Type / values            | Default  | Description                                                        |
| ---------------- | -------------- | ------------------------ | -------- | ------------------------------------------------------------------ |
| `lab.thickness`  | Lab thickness  | `number` 0.05..12 mm     | `1`      | How thick the plate is.                                            |
| `lab.sandMass`   | Sand           | `number` 0..300 g        | `20`     | More sand lowers each figure in pitch.                             |
| `lab.elasticity` | Lab elasticity | `number` 0.1..450 GPa    | `69`     | How stiff the plate is. Aluminium is about 69.                     |
| `lab.poisson`    | Poisson        | `number` 0.05..0.49      | `0.33`   | How much the material swells sideways as it bends.                 |
| `lab.loss`       | Loss           | `number` 0.001..0.2      | `0.02`   | Damping. Higher values widen the resonances and blend the figures. |
| `lab.contact`    | Contact        | `number` 0.5..20 mm      | `5`      | The radius of the tip that pushes the plate.                       |
| `lab.tipMass`    | Mass           | `number` 0..200 g        | `10`     | Mass moving with the tip.                                          |
| `lab.support`    | Support        | `number` 0..10000000 N/m | `100000` | The spring holding the tip.                                        |
| `lab.pretension` | Pretension     | `number` 0..10000 N/m    | `0`      | Tension in the plane of the plate. Solid plates use 0.             |

### `look` — painting (same physics)

| Key                    | Label         | Type / values                          | Default       | Description                                                                                      |
| ---------------------- | ------------- | -------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| `look.look`            | Look          | `"textured"` \| `"classic"` \| `"ink"` | `"textured"`  | Textured felt / turned metal / nodal lines only. Painting only, same physics.                    |
| `look.color`           | Color         | `string` (hex / hsl)                   | `"#f3ead8"`   | Sand colour.                                                                                     |
| `look.amount`          | Grain         | `number` 0.1..1.5                      | `1`           | How much sand is on the plate.                                                                   |
| `look.multiTone`       | Multi-tone    | `"physical"` \| `"morph"`              | `"physical"`  | Physical adds partial energies (figure holds still); Morph lets them interfere (figure wanders). |
| `look.plateBrightness` | Plate         | `number` 0..2                          | `1`           | The brightness of the plate.                                                                     |
| `look.plateAlpha`      | Plate opacity | `number` 0..1                          | `1`           | Opacity of the plate surface. 0 draws only the sand on whatever is behind the canvas.            |
| `look.plateColor`      | Plate color   | `string` (hex / hsl)                   | `"#1a1a1c"`   | Colour of the plate surface (felt).                                                              |
| `look.lightX`          | Light X       | `number` -1..1                         | `-0.5`        | Lamp position.                                                                                   |
| `look.lightY`          | Light Y       | `number` -1..1                         | `0.8`         | Lamp position.                                                                                   |
| `look.exposure`        | Exposure      | `number` 0.5..1.6                      | `1`           | Overall brightness, in every view.                                                               |
| `look.halo`            | Halo          | `"none"` \| `"still"` \| `"breathing"` | `"breathing"` | The glow around the plate: off, steady, or breathing with the energy of the sound.               |
| `look.tremor`          | Tremor        | `boolean`                              | `true`        | Notes with no resonance shake the plate as a whole.                                              |

### `ink` — the Ink look (`look.look: "ink"`)

| Key             | Label         | Type / values | Default | Description                                                        |
| --------------- | ------------- | ------------- | ------- | ------------------------------------------------------------------ |
| `ink.width`     | Ink width     | `number` 0..1 | `0.4`   | From a thread to a band.                                           |
| `ink.intensity` | Ink intensity | `number` 0..2 | `1`     | How strongly the ink covers the felt.                              |
| `ink.fill`      | Ink fill      | `number` 0..1 | `0.5`   | How much of the low valleys is inked. Rich chords show more of it. |
| `ink.glow`      | Ink glow      | `number` 0..1 | `0.3`   | The soft light around the lines. 0 is sharp ink.                   |

## Browser requirements

WebGL2 with `EXT_color_buffer_float` (falls back to
`EXT_color_buffer_half_float`). Without them `createChladniPlate`
returns `supported: false` and paints a static plate colour. An
`AudioContext`-based analyser requires a secure context and a user
gesture; `SimulatedVoice` works anywhere.

## License

MIT
