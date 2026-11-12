# @chladni/react

React wrapper for [`@chladni/core`](../core) — the voice-reactive Chladni
plate engine — as a `<ChladniPlate />` canvas component plus a
`useChladniPlate` hook for the imperative handle.

## Install

```sh
npm install @chladni/react
# the engine is a dependency; install it directly for its helpers/types
npm install @chladni/core
```

## Usage

```tsx
import { ChladniPlate, SimulatedVoice, PRESETS } from "@chladni/react";

function Demo() {
  return (
    <ChladniPlate
      params={PRESETS["voice"].params} // DeepPartial<ChladniParams>, authoritative diff over defaults
      analyser={new SimulatedVoice()} // SpectrumSource | AnalyserNode | null
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

## Browser requirements

Same as `@chladni/core`: WebGL2 + `EXT_color_buffer_float` (or the
half-float fallback). Microphone requires a secure context + user
gesture.

## License

MIT
