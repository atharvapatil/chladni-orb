# chladni-orb

## 0.1.0

### Minor Changes

- a361f7c: First public release.

  - WebGL2 Chladni plate engine: audio partials, plate physics (Studio and Lab models), sand simulation.
  - `<ChladniPlate />` React component and `createChladniPlate()` for everything else.
  - Voice-agent states: `state` prop / `setState()` with `idle`, `connecting`, `listening`, `talking`.
  - `listening.idle: "relax"` lets the sand spread back over the plate in silence.
  - `look.halo: "none"`.
  - `frozen` stays frozen across `params` changes.

### Patch Changes

- Updated dependencies [a361f7c]
  - chladni-orb-core@0.1.0
