# Aperture

A cinema prime lens with a recessed nine-blade iris, two knurled control rings, a convex coated front lens, optical backing and a machined support.

Click to move between three iris openings. Holding the pointer closes it slightly further. Move horizontally to inspect the object. Reduced-motion preferences stop autonomous motion and remove interpolation.

## Spektral pattern

`material.ts` creates one stable scene with `defineMaterial`, the public custom `RenderPass` contract and the shared studio presentation. Svelte, React and Vue use the same geometry and interaction state; their runtime children own pointer hooks and lifecycle cleanup. The camera, charcoal floor and tone mapping match the existing playground. Native DPR is preserved, with 4× MSAA on geometry and no preview controls.

The mesh and label atlas are created once. Each frame updates a small palette of rigid transforms. Static scenes stop rendering after pointer and inspection motion settle. The GPU buffers, shadow map and multisample targets are released by the pass; resize recreates only size-dependent targets.

## Scope

The front optical boundary is a tessellated convex surface with a low-reflectance
coating and neutral grazing Fresnel. It is composited after the opaque iris and
excluded from the opaque shadow map. The rear element is a dark coated reflective
surface. This preserves visible depth without tracing a full multi-element lens.
Nine overlapping blades form the aperture; each has its own depth and transform.
