# @chladni/core

Voice-reactive Chladni plate engine for the web. Audio in, sand figures
out: the strongest partials of a live spectrum drive the vibration modes
of a simulated plate through Lorentzian resonance, and thousands of
grains jitter off the antinodes and settle on the nodal lines — rendered
in a single WebGL2 pass pipeline.

## Install

```sh
npm install @chladni/core
```

## Usage

```ts
import { createChladniPlate, SimulatedVoice, createMicAnalyser } from "@chladni/core";

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

## Parameters

`setParams` takes a `DeepPartial<ChladniParams>` merged over the current
state. The groups: `listening` (input/floor/decay/partials/freeze),
`plate` (shape/drive/exciter/material), `studio`, `lab` (Lab model),
`look` and `ink`. Every field, range and its meaning is generated from
`PARAM_SCHEMA` — see
[`docs/research/figura-parameters.md`](https://github.com/<user>/chladni/tree/main/docs/research/figura-parameters.md)
for the full catalog.

Ready-made figures ship as `PRESETS` (`voice`, `classic-square-pivot`,
`ink-square`, `drumhead`, `lab-aluminium`):

```ts
import { PRESETS } from "@chladni/core";
plate.setParams(PRESETS["drumhead"].params);
```

## Browser requirements

WebGL2 with `EXT_color_buffer_float` (falls back to
`EXT_color_buffer_half_float`). Without them `createChladniPlate`
returns `supported: false` and paints a static plate colour. A
`AudioContext`-based analyser requires a secure context and a user
gesture; `SimulatedVoice` works anywhere.

## License

MIT
