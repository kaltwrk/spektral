# Mint

Three milled gold coins combine a matte field, polished rim, bead border and raised Spektral SVG relief.

Click turns the upright coin. Holding the pointer turns it slightly further. Move horizontally to inspect the object. Reduced-motion preferences stop autonomous motion and remove interpolation.

## Spektral pattern

`material.ts` creates one stable scene with `defineMaterial`, the public custom `RenderPass` contract and the shared studio presentation. Svelte, React and Vue use the same geometry and interaction state; their runtime children own pointer hooks and lifecycle cleanup. The camera, charcoal floor and tone mapping match the existing playground. Native DPR is preserved, with 4× MSAA on geometry and no preview controls.

The mesh and label atlas are created once. Each frame updates a small palette of rigid transforms. Static scenes stop rendering after pointer and inspection motion settle. The GPU buffers, shadow map and multisample targets are released by the pass; resize recreates only size-dependent targets.

## Scope

The upright coin meets the floor throughout its Y-axis inspection rotation. Flat
faces have planar normals, while the rolled edges have explicit circular bevel
normals. Gold uses warm conductor reflectance; the frosted field, polished relief
and milled edge have separate roughness. Machining follows each coin's own local
coordinates. The arrangement is authored; no rigid-body physics is simulated.
