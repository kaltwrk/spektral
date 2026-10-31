# Optimization session — 2026-10-31

These captures precede the subsequent Prism framing correction.

All six demos now use named scene factories and direct resource props in the
Svelte, React and Vue hosts. Prism interaction state belongs to its runtime.

## Retained changes

| Demo          | Change                                                                                                                                             | Maximum RGB channel difference across three cases |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Amber         | Conservative shadow bound skips expensive warped geometry only when the original step and visibility cannot change.                                | 0                                                 |
| Ferrofluid    | Cache published float32 uniform values; skip redundant magnet/timestep writes while preserving full-precision easing. Simulation shaders retained. | 0                                                 |
| Kinetic Array | Skip mechanisms behind a closer pin head; avoid overwritten isotropic lighting; use a conservative shadow bound.                                   | 0                                                 |
| Nixie         | Constant-time selection of the nearest tube; conservative bound for shadow geometry. Polished materials and bloom retained.                        | 1/255                                             |
| Prism         | Publish only the pointer uniform; remove unused time/step bindings. Preserve on-demand scheduling and optical shader calculations.                 | 0                                                 |
| Signal        | Bound detailed knobs and bezel geometry; skip inactive emission paths; bound distant shadow samples.                                               | 2/255                                             |

No capture has a pixel whose RGB channel error exceeds 2/255. The reference
includes the polished Nixie materials from before this optimization session.
Resolution, sample limits, simulation grids, HDR formats and effects were held
constant. These are fixed-view comparisons, not a proof over all inputs or GPUs.

## Timing evidence

[Full paired capture](results/paired-final.json): Apple / Metal 3, 40 samples after
warmup, public runtime, CPU frame callback through GPU queue completion. Default
views are 1200 × 800 physical pixels. Values below are medians in milliseconds.
They are **not isolated GPU times**.

| Demo          | Reference ms | Current ms | Change in this run |
| ------------- | -----------: | ---------: | -----------------: |
| amber         |         7.32 |       7.63 |              +4.2% |
| ferrofluid    |         7.51 |       7.81 |              +3.9% |
| kinetic-array |        12.09 |      10.26 |             -15.2% |
| nixie         |        11.31 |       8.44 |             -25.4% |
| prism         |         2.70 |       3.78 |             +40.4% |
| signal        |         7.89 |       7.28 |              -7.8% |

Nixie and Kinetic Array consistently benefited in repeated paired runs. Amber's
portrait case improved by 20.2% and its interaction case by 11.9% in the saved run;
its default case did not improve in that run. Signal improved by 2.7–17.8% across
its three cases. Small differences need longer profiling on the target device.

Short renders had substantial scheduling noise. The identical-reference
[Prism A/A control](results/control-prism.json) differed by +20.3%; a subsequent
[Prism A/B repeat](results/prism-repeat.json) changed from 4.00 to 3.41 ms (−14.9%),
reversing the saved full-run result. The
[Ferrofluid A/A control](results/control-ferrofluid.json) differed by −2.8%.
No GPU speedup is claimed for Prism or Ferrofluid. Their retained optimizations
reduce redundant CPU uniform operations, which this fixed-input render harness
does not measure. Tests verify publication and settling behavior separately.

Experiments with cached Prism beam geometry, more aggressive shader branches and
Ferrofluid trigonometric rewrites were discarded because they did not establish
a repeatable improvement. A Prism shading reorder also changed a handful of edge
pixels and was reverted.

## Validation

- 18 render comparisons: default, interaction and portrait for every demo.
- 95 app tests passed, including interaction publication, on-demand settling,
  shader contracts and playground source assembly.
- Svelte check: zero errors and warnings; modified components pass the Svelte autofixer.
- App ESLint and configuration coverage passed.
- All three local benchmark TypeScript projects passed.
- Production app build completed successfully.
- Browser checks: all six React hosts, Prism in all three frameworks, and native keyboard focus/input; no console errors observed.
