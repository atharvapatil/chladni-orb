# chladni

A voice-reactive Chladni plate for the web. Sound in, sand figures out —
a WebGL2 simulation of a vibrating plate driven by the strongest partials
of live audio, in the spirit of Ernst Chladni's brass plates.

## Packages

| Package                             | Description                                                                |
| ----------------------------------- | -------------------------------------------------------------------------- |
| [`chladni-orb-core`](packages/core) | Framework-agnostic engine: audio analysis, plate physics, WebGL2 rendering |
| [`chladni-orb`](packages/react)     | React wrapper (`<ChladniPlate />`) over `chladni-orb-core`                 |
| `docs` (private, `apps/docs`)       | Playground / documentation site                                            |

## Quick start

```sh
npm i chladni-orb chladni-orb-core
```

```tsx
import { ChladniPlate, createMicAnalyser } from "chladni-orb";

const mic = await createMicAnalyser();

<ChladniPlate
  analyser={mic.analyser}
  state="talking" // idle | connecting | listening | talking
  params={{ listening: { idle: "relax" } }}
  style={{ width: 320, height: 320 }}
/>;
```

Full props, every `params` key with a live plate, and the voice-agent states
are on the docs site. Package READMEs:
[`chladni-orb`](packages/react/README.md), [`chladni-orb-core`](packages/core/README.md).

## Development

```sh
pnpm install          # install all workspaces
pnpm -r build         # build packages
pnpm -r test          # run vitest
pnpm -r typecheck     # tsc --noEmit everywhere
pnpm lint             # oxlint
pnpm format           # prettier --write
pnpm format:check     # prettier --check
pnpm dev              # run the docs playground
```

## Playground

The docs playground is published at `https://atharvapatil.github.io/chladni-orb/`
(see `pnpm dev` for the local version) — presets, a schema-generated
tuning panel, and live "how it works" demos.

## Releasing

See [RELEASING.md](RELEASING.md) for the one-time npm/GitHub setup, how a
release flows through Changesets, and how to maintain the packages.

## License

MIT
