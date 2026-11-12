# Figura native analysis — Gate 0 outcome

Plan Phase 1b proposed inspecting the free Figura demo binary with REA
(bundle resources, strings, targeted Ghidra decompile) to recover factory
defaults and the internal resonance / sand formulas. The phase was gated on
reading the licence bundled with the installer. **Result: stopped at Gate 0.
No binary inspection, string extraction or decompilation was performed.**

## What was checked

- Downloaded `Figura-1.3.4-macOS.pkg` (90.6 MB, `application/x-xar`) from
  `https://acusmagic.com/demo/figura/mac` into `/tmp/chladni-research/`.
- Expanded it with `pkgutil --expand` (no install) and read
  `Resources/EULA.html` — "END USER LICENSE AGREEMENT — Figura, Version 1.2,
  last updated 4 November 2026". This is stricter and more specific than the
  plain-language summary at acusmagic.com/eula.

## Relevant clauses

- **§9(a)** — you may not "reverse engineer, decompile, or disassemble the
  Software except to the extent such restriction is prohibited by applicable
  law (e.g. for interoperability under EU Directive 2009/24/EC …)". Our
  purpose is not interoperability, so the statutory exception does not apply.
- **§9(d)** — you may not "use the Software's protected elements, or the
  results of studying it, to develop or market a competing product. This does
  not limit your right to observe, study or test the functioning of the
  Software in the course of permitted use (Art. 5(3) Directive 2009/24/EC)".
- **§4.3** — anti-circumvention: no "tools that modify the Software's
  binaries for any purpose".
- **§6.2** — Factory Content (presets, the Quantum Collection, scenes) may
  not be "extracted, isolated, reconstructed or redistributed … as part of a
  competing product". This also rules out mining the factory preset files for
  default values.

## Decision

- Native RE (strings, bundle-resource mining, decompilation) is **off the
  table** for this project. The sidebar in the original plan noting its low
  ROI stands: the public manual already enumerates all 151 parameters with
  ranges, and the plate physics is textbook.
- **Permitted and still useful:** black-box observation of the demo in normal
  use (Art. 5(3) as preserved by §9(d)) — e.g. playing sine sweeps, chords
  and speech through the standalone app and noting how fast sand settles, how
  figures blend between resonances, what Pivot vs Exciter changes. Record such
  observations in `figura-behaviour.md`, qualitatively, without reproducing
  factory presets or scenes.
- Everything in `@chladni/core` is our own implementation of public
  literature (`plate-physics.md`); defaults in `figura-parameters.md` marked
  `†` are our choices, not Figura's.

## Environment notes (for the record)

Had Phase 1b proceeded, this machine would have needed: Node ≥ 24.22.1 (has
24.19.0), a JDK 21 and Ghidra (none installed), and `npx rea-agents setup`.
None of this was installed.
