# Prism

A collimated white beam enters a cut glass prism and separates into a visible
spectrum. The emitter, refracted light and floor illumination share one optical
path calculation. Five planes describe the triangular optical body. The visible
surface has a 0.006-unit rounded edge, evaluated only near its perimeter.

The first ComputePass traces sixteen wavelengths from 400 to 700 nm with Snell's
law and Cauchy dispersion. It writes their source, entry, exit and floor-hit
positions and two beam bounds into a 1,344-byte storage buffer. A second ComputePass reads that buffer
and deposits the spectral footprints into a 384 × 384 HDR texture. Explicit buffer
accesses establish the pass dependency. The material reads both resources.

The camera uses a single 550 nm reference path for the room image. This removes
the separate red, green and blue silhouettes that appeared at reflected edges;
the illuminating beam and floor spectrum still use all sixteen wavelengths.
Exact dielectric Fresnel weights split transmission and reflection at every
interface, including total internal reflection. Paths stop below 0.008 remaining
weight or after six bounces. The unresolved tail uses low-frequency room light.

Internal transport uses the five optical faces without repeatedly tracing the
small rounded edge. This is a deliberate approximation: repeated images of that
edge formed a distracting lattice across the glass. The camera resolves the
rounded entry surface, and high-contrast boundaries receive four samples within
one physical pixel. Clear face interiors use one sample. There is no image blur
or temporal accumulation.

Beam visibility uses analytic Gaussian profiles. Cached bounds skip the sixteen
segment evaluations for rays outside the visible beam halo. The floor footprints,
scattering and reflection tail are approximations; this is not a spectral path
tracer. Shadows use inexpensive analytic footprints.

Move to turn the optical assembly and adjust the incident angle. Hold to increase
dispersion. Click the prism to cycle three glass grades. The canvas renders on
demand and stops after input settles. Reduced-motion preferences remove pointer
easing. There are no demo-specific HTML overlays.

Svelte, React and Vue share the material and passes. Runtime listeners are removed
on unmount. Intermediate color stays linear in rgba16float; the studio presentation
pass performs the only tone map and sRGB conversion. DPR follows the device's pixel ratio.

The [shared playground benchmark](../../../../../scripts/playground-benchmark/README.md)
measures the complete render graph at fixed physical resolutions and compares
canvas captures. Timing values depend on the browser, GPU and system load.
No frame-rate guarantee is implied.

The [glass revision measurements](../../../../../scripts/playground-benchmark/results/prism-glass.json)
compare this material with commit `1f739f22` on Apple / Metal 3. Default, interaction
and portrait cases all completed, with lower median times in these runs. The
identical-reference control varied by 14.7%, so the results do not establish a
precise speedup. Image differences are intentional and include the new glass
appearance. The default repeat produced the same image-difference metrics.

`createPrismScene()` returns only `material` and `passes`, matching the other
playground factories. Each framework runtime owns `createPrismInteraction()`.
The on-demand scene publishes only `uPointer`; it does not update unused time or
simulation uniforms. Cross-demo comparisons use the shared playground benchmark.

The scene uses the shared studio camera directly, including its shorter-side
normalization. It has no additional aspect-ratio zoom. Pointer hit projection
and the beam pixel footprint use that same camera. Compact emitter spacing and
a lower optical axis keep the source and floor spectrum visible at this scale.
