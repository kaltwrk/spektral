# Studio product collection

Aperture and Mint use the existing camera, charcoal floor, linear HDR buffers
and studio presentation. Each demo owns its model, scene factory, editable assets
and three framework hosts. The renderer is a public `RenderPass` implementation;
it does not import Spektral internals or add a second rendering library.

## Render and resource contract

1. `defineMaterial` renders the shared studio floor into the current source.
2. `ProductPass` renders a 1024² key-light depth map, composites its soft shadow
   over the source, then draws indexed mesh geometry into a 4× multisample target.
3. The target resolves into the render graph's output. The existing presentation
   pass applies ACES Hill, sRGB encoding and stationary dithering once.

The camera is unchanged. Tall models are uniformly fitted to 1.42 studio units
in height; their feet remain on the same floor. Pointer motion uses the existing
horizontal rotation convention. All hosts preserve native DPR and `maxDelta=1/30`.
There are no demo-specific HTML controls over the preview.

Positions, normals, primitive-local coordinates, UVs, linear material colors and rigid-part IDs share one
immutable vertex stream. One indexed beauty draw covers the model, and a second
draw produces its shadow. A palette of 32 matrices controls the moving parts.
SVG tessellation, primitive construction, label rasterization and mip generation
happen once per scene/device, never in the frame loop. Label atlas height follows
the actual number of labels. Only the MSAA color/depth targets resize with the
canvas. `dispose()` releases pass-owned buffers and textures; a changed GPU device
rebuilds them. The runtime owns graph targets and final presentation.

Static products render on demand while input or inspection transitions settle.
Reduced-motion preferences stop automatic animation. Framework mount cleanup
removes media-query listeners.

## Materials

The shared studio surface shader provides Fresnel-weighted diffuse and reflected
light. All eight playground scenes use the compact elliptical overhead key, cool rear light
and restrained fill from `../studio.wgsl`, with a near-black satin floor. Emitter
size controls reflection width and shadow softness. Three local reflection cards
keep polished product faces legible; their strength follows the shared reflection
fill so they do not flatten the contrast of the overhead lights.
Metal machining marks and rubber are procedural finishes with
screen-space filtering. Product lettering is a mipmapped grayscale atlas generated
from the model's labels, not a browser overlay.

These are bounded analytic studio approximations, not path tracing. The shadow
uses twelve blocker-search taps and twelve comparison taps. It models the key
light; the other studio lights remain fill. The lens has a convex transparent front
boundary with coated Fresnel reflection and a recessed iris. It does not trace a
multi-element refractive optical system. Transparent boundaries are excluded from
the opaque shadow draw. Bevel normals meet flat caps without smoothing across the
whole cap, and minified specular detail is filtered using the normal footprint.
Machining coordinates are local to each primitive, including rotated coins.

## SVG extrusion and the Godsend investigation

Godsend has two distinct logo pipelines. Its `metallic-logo` and `glass-logo`
effects shade a distance texture. Its `metallic-3d-logo` and `glass-3d-logo` instead
use CPU-generated geometry, a custom vertex program and depth-aware passes. The
latter is the relevant reference for a logo that must have real thickness.

The investigation covered `svg-extrusion-template.ts`,
`svg-geometry-runtime-template.ts`, `geometry-preparation-runtime-template.ts`,
`metallic-3d-logo.ts`, `logo-orbit.ts` and the shared metal material. The geometry
runtime classifies contour holes, triangulates caps with Earcut, builds bevel
profiles and sidewalls, and keeps cap normals separate from wall normals. It also
tracks contour tangents/UVs, transforms normals with the geometry, and manages GPU
resource replacement. Its broader importer supports SVG transforms, external
sources and cancellable preparation. The metal material adds filtered machining,
anisotropic reflection and a separate surface-depth occlusion pass.

This collection implements the extrusion independently for a deliberately smaller
editable SVG subset. `svg.ts` accepts closed filled `M/L/H/V/C/Q/Z` paths, including
relative commands, disconnected islands and nested holes. It normalizes bounds,
triangulates inset caps, builds actual hole walls and five-segment quarter-circle
bevels, and preserves hard contour corners. Unsupported commands and unbaked
transforms fail explicitly. It does not fetch remote SVGs or execute SVG content.
Curve tessellation is 12–16 steps in the supplied marks, rather than a large
general-purpose import budget. The source limits are 100 KB and 12,000 contour
vertices. Keep bevels smaller than the narrowest feature of an edited mark.

`earcut.js` is the unmodified Mapbox Earcut 3.2.3 npm source, with its ISC license
included in the file. The Spektral mark is the repository's existing branding;
the coin relief is extruded directly from that asset. No Godsend rendering dependency
or proprietary generated runtime is included.

## Verification

The app tests check SVG hole volume, both winding directions, cap separation,
finite normals, relative curves and invalid input. Every demo/framework source
tree is checked for missing local dependencies, and standalone TypeScript modules
are parsed through the playground's own type eraser. GPU validation, default and
interaction views, portrait framing and timings use the public-runtime harness in
`scripts/playground-benchmark`. See its README for the timing limitations.
