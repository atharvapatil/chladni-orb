# chladni

A voice-reactive Chladni plate for the web. Sound in, sand figures out —
a WebGL2 simulation of a vibrating plate driven by the strongest partials
of live audio, in the spirit of Ernst Chladni's brass plates.

## Packages

| Package                            | Description                                                                |
| ---------------------------------- | -------------------------------------------------------------------------- |
| [`@chladni/core`](packages/core)   | Framework-agnostic engine: audio analysis, plate physics, WebGL2 rendering |
| [`@chladni/react`](packages/react) | React wrapper (`<ChladniPlate />`) over `@chladni/core`                    |
| `docs` (private, `apps/docs`)      | Playground / documentation site                                            |

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

Research notes (physics, the Figura parameter catalog this project is
modelled on) live in [`docs/research`](docs/research).

## License

MIT
