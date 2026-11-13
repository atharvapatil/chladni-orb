# AGENTS.md

## Repo layout

```
packages/core    chladni-orb-core — framework-agnostic engine (audio analysis,
                 plate physics, WebGL2 rendering). Plain TypeScript, no React.
packages/react   chladni-orb — <ChladniPlate /> wrapper over chladni-orb-core.
apps/docs        Vite + React playground / docs site (private, GitHub Pages).
docs/research    Research notes: figura-parameters.md, figura-behaviour.md,
                 plate-physics.md, figura-native-findings.md (Gate 0: no RE).
.github/workflows CI (lint/typecheck/test/build), docs deploy, release.
```

## Commands

```sh
pnpm install          # install all workspaces (pnpm 12 via corepack, Node 24)
                      # if `pnpm` is not on PATH: `corepack pnpm <cmd>`
                      # native build scripts are allow-listed in pnpm-workspace.yaml (allowBuilds)
pnpm -r build         # tsup build of packages, vite build of docs
pnpm -r test          # vitest run in each package
pnpm -r typecheck     # tsc --noEmit in each workspace
pnpm lint             # oxlint (no config file)
pnpm format           # prettier --write .
pnpm format:check     # prettier --check .
pnpm dev              # docs playground dev server
pnpm changeset        # add a changeset
pnpm release          # build + changeset publish
```

## Conventions

- Strict TypeScript (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`) via `tsconfig.base.json`.
- No default exports in library code (`packages/*`); named exports only.
- Tests live next to source as `*.test.ts` (vitest, node environment).
  `packages/*/src/api.test.ts(x)` pin the public export list: adding or
  removing an export must update them and add a changeset.
- `pnpm check` runs everything CI runs. Release process: `RELEASING.md`.
- Dependencies are pinned to exact versions; prefer releases ≥7 days old.
- `chladni-orb` depends on `chladni-orb-core` via `workspace:*`;
  react is a peer dependency (>=18).
- Docs site base path is set by `VITE_BASE` (CI uses `/chladni/` for
  GitHub Pages).

## Phase status

Phases 0-6 done, including Phase 5 Lab model (exact free-edge circle +
Rayleigh–Ritz rectangle, mode atlas). Repository: https://github.com/atharvapatil/chladni-orb,
docs at https://atharvapatil.github.io/chladni-orb/.
