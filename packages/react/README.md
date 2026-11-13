# chladni-orb

React wrapper for [`chladni-orb-core`](../core) — the voice-reactive Chladni
plate engine — as a `<ChladniPlate />` canvas component plus a
`useChladniPlate` hook for the imperative handle.

## Install

```sh
npm install chladni-orb
# the engine is a dependency; install it directly for its helpers/types
npm install chladni-orb-core
```

## Usage

```tsx
import { ChladniPlate, SimulatedVoice, PRESETS } from "chladni-orb";

function Demo() {
  return (
    <ChladniPlate
      params={PRESETS["voice"].params} // DeepPartial<ChladniParams>, authoritative diff over defaults
      analyser={new SimulatedVoice()} // SpectrumSource | AnalyserNode | null
      state="talking" // idle | connecting | listening | talking
      state="talking" // idle | connecting | listening | talking
      frozen={false}
      style={{ width: 480, aspectRatio: 1 }}
      onReady={(plate) => console.log(plate.supported)}
    />
  );
}
```

- `params` is **authoritative**: it is merged over `DEFAULT_PARAMS`, so
  removing a key resets it rather than leaving a stale value.
- `ref` gives the core `ChladniPlate` handle (`setParams`, `freeze`,
  `resetSand`, `partials`, `level`, …); `useChladniPlate()` is a
  convenience hook for the same.
- SSR-safe: nothing touches the DOM until mount.

Everything the component needs is re-exported (`ChladniParams`,
`DEFAULT_PARAMS`, `PARAM_SCHEMA`, `SpectrumSource`, `SimulatedVoice`,
`createMicAnalyser`, `createElementAnalyser`, `PRESETS`, …), so React
apps only need this package.

## `<ChladniPlate />` props

| Prop              | Type                                                 | Default                    | Description                                                                                                                                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `params`          | `DeepPartial<ChladniParams>`                         | `DEFAULT_PARAMS`           | The plate's settings. Merged over `DEFAULT_PARAMS` on every change and deep-compared (JSON), so a fresh object literal each render is fine. Removing a key resets it to the default.                                                                                                                     |
| `analyser`        | `SpectrumSource \| AnalyserNode \| null`             | `null`                     | What the plate listens to: a Web Audio `AnalyserNode`, anything implementing `SpectrumSource` (e.g. `SimulatedVoice`), or `null` for silence. Can be swapped at any time.                                                                                                                                |
| `state`           | `"idle" \| "connecting" \| "listening" \| "talking"` | `"talking"`                | The plate as a voice agent's presence. `talking` is the normal plate. The quiet states ignore the sound: `idle` rests the sand evenly spread and shivering, `connecting` adds pulses rolling out from the centre, `listening` pulses drawing in from the rim. The same grains carry over between states. |
| `frozen`          | `boolean`                                            | `false`                    | Hold the current figure and stop listening (same as `listening.freeze`).                                                                                                                                                                                                                                 |
| `pixelRatio`      | `number`                                             | `min(devicePixelRatio, 2)` | Cap on the render resolution multiplier. Fixed at mount.                                                                                                                                                                                                                                                 |
| `fieldResolution` | `number`                                             | `256`                      | Side of the vibration-field texture (N×N). Higher gives sharper nodal lines at a higher per-frame cost. Fixed at mount.                                                                                                                                                                                  |
| `particleTexSize` | `number`                                             | `256`                      | Side of the particle texture; the plate carries up to N² grains (65 536 at 256). `look.amount` scales how many are drawn. Fixed at mount.                                                                                                                                                                |
| `onReady`         | `(plate: ChladniPlate) => void`                      | —                          | Called once after mount with the imperative handle (see below).                                                                                                                                                                                                                                          |
| `ref`             | `Ref<ChladniPlate \| null>`                          | —                          | The same handle via a ref; `null` after unmount.                                                                                                                                                                                                                                                         |
| …canvas props     | `CanvasHTMLAttributes`                               | —                          | `className`, `style`, `aria-*`, event handlers, etc. are forwarded to the `<canvas>`. Size it with CSS — the plate follows its box via `ResizeObserver`.                                                                                                                                                 |

`params` keys are documented in full in the
[`chladni-orb-core` parameter reference](../core/README.md#parameter-reference).

## The handle (`ChladniPlate`)

Available through `ref`, `onReady`, or `useChladniPlate().plate`.

| Member                           | Signature                                              | Description                                                                                                                             |
| -------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `setParams(patch)`               | `(DeepPartial<ChladniParams>) => void`                 | Merge a patch over the current params. Changing `plate.model`, `listening.partials`, `plate.shape` or `plate.aspect` re-seeds the sand. |
| `getParams()`                    | `() => ChladniParams`                                  | The fully-resolved current params.                                                                                                      |
| `setAnalyser(source)`            | `(SpectrumSource \| AnalyserNode \| null) => void`     | Swap the audio source.                                                                                                                  |
| `setState(state)` / `getState()` | `(AgentState) => void` / `() => AgentState`            | Switch between `idle`, `connecting`, `listening` and `talking`.                                                                         |
| `freeze(on)`                     | `(boolean) => void`                                    | Hold / release the figure.                                                                                                              |
| `reset()`                        | `() => void`                                           | Factory params **and** fresh sand.                                                                                                      |
| `resetSand()`                    | `() => void`                                           | Fresh sand only; params untouched.                                                                                                      |
| `start()` / `stop()`             | `() => void`                                           | Control the render loop (it auto-starts, and pauses when off-screen or the tab is hidden).                                              |
| `destroy()`                      | `() => void`                                           | Tear down GL resources and observers. The component does this on unmount.                                                               |
| `partials`                       | `readonly SpectralPartial[]`                           | The tracked peaks from the last frame (`{ freq, amp }`), strongest first.                                                               |
| `level`                          | `{ energy: number; tremor: number; solving: boolean }` | Live meters: summed partial amplitude, 0–1 off-resonance shake, and whether the Lab model is still solving.                             |
| `supported`                      | `boolean`                                              | `false` when WebGL2 / float textures are unavailable (a flat plate colour is painted instead).                                          |

## `useChladniPlate()`

```tsx
const { ref, plate } = useChladniPlate();
return <canvas ref={ref} />;
// plate is the handle once mounted (null before / after)
```

Creates a plate with default options on the canvas you attach `ref` to.
Use the component when you want props; use the hook when you want to own
the canvas and call the handle directly.

## Browser requirements

Same as `chladni-orb-core`: WebGL2 + `EXT_color_buffer_float` (or the
half-float fallback). Microphone requires a secure context + user
gesture.

## License

MIT
