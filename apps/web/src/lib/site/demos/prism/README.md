# Prism

A collimated white beam enters a cut glass prism and separates into a visible
spectrum. The emitter, refracted light and floor illumination share one optical
path calculation. Fourteen clipping planes describe the main faces and polished
chamfers.

The first ComputePass traces sixteen wavelengths from 400 to 700 nm with Snell's
law and Cauchy dispersion. It writes their source, entry, exit and floor-hit
positions into a 1,280-byte storage buffer. A second ComputePass reads that buffer
and deposits the spectral footprints into a 384 × 384 HDR texture. Explicit buffer
accesses establish the pass dependency. The material reads both resources.

The camera shader traces three color channels through the glass, including up to
six internal reflections. Beam visibility uses analytic Gaussian profiles. The
floor footprints and scattering are artistic approximations; this is not a
spectral path tracer. Shadows use inexpensive analytic footprints.

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

`createPrismScene()` returns only `material` and `passes`, matching the other
playground factories. Each framework runtime owns `createPrismInteraction()`.
The on-demand scene publishes only `uPointer`; it does not update unused time or
simulation uniforms. Cross-demo comparisons use the shared playground benchmark.

The scene uses the shared studio camera directly, including its shorter-side
normalization. It has no additional aspect-ratio zoom. Pointer hit projection
and the beam pixel footprint use that same camera. Compact emitter spacing and
a lower optical axis keep the source and floor spectrum visible at this scale.
