# Playground demos

Add a new demo by creating a folder in this directory:

- `demos/<demo-id>/svelte/App.svelte` (required, Svelte variant)
- `demos/<demo-id>/svelte/runtime.svelte` (optional, Svelte runtime helpers)
- `demos/<demo-id>/react/App.tsx` (required, React variant)
- `demos/<demo-id>/react/runtime.tsx` (optional, React runtime helpers)
- `demos/<demo-id>/vue/App.vue` (required, Vue variant)
- `demos/<demo-id>/vue/runtime.vue` (optional, Vue runtime helpers)
- `demos/<demo-id>/<any-file>` (optional shared file; loaded as `src/<any-file>`)
- `demos/<demo-id>/shaders/**/*.wgsl` (preferred shared WGSL shader/include files; import from every variant with `?raw`)
- `demos/<demo-id>/<framework>/<any-file>` (optional framework-specific file; loaded as `src/<any-file>` for that framework)
- `demos/<demo-id>/<framework>/shaders/**/*.wgsl` (optional framework-specific WGSL shader/include files; use only when variants need different shader code)

Rules:

- `<demo-id>` should be kebab-case (for example `flow-field`).
- Add `../content/playground/<slug>.svelte`, exporting the metadata shown below. Export its title, description, `order` and `data.demo` in `metadata`. Pass the demo ID and title to the shared `PlaygroundPage`. The filename defines the URL; no separate registration is needed.
- Source files are discovered at build time. Every source folder must have a matching content page.
- `index.svelte` configures the Playground view and can remain an empty workspace without `data.demo`.
- All framework variants are required for every demo (`svelte`, `react`, `vue`).
- Common camera, studio lighting and shading live in `../demo-shared/`. The loader
  includes those files as `src/shared/` in every demo; do not copy the studio into
  individual demo folders.
- Use relative imports that resolve on disk (for example `../material` from a
  framework entry, or `../../demo-shared/studio.wgsl?raw` from the demo root).
  The loader relocates those imports when constructing the editor's file tree.

Example page metadata (in a `<script module lang="ts">` block):

```ts
import type { ContentFrontmatter } from '$lib/content/types';

export const metadata = {
	title: 'Flow Field',
	description: 'Describe the API concept demonstrated here.',
	order: 10,
	data: { demo: 'flow-field' }
} satisfies ContentFrontmatter;
```

Import `PlaygroundPage` from `$lib/features/playground/PlaygroundPage.svelte` in
an instance script, then render
`<PlaygroundPage demoId={metadata.data.demo} title={metadata.title} />`.

Example directory:

```
demos/
  flow-field/
    svelte/
      App.svelte
      runtime.svelte
    react/
      App.tsx
      runtime.tsx
    vue/
      App.vue
      runtime.vue
    shaders/
      fragment.wgsl
    shader.ts
```

## Example coverage

Every scene shares the studio camera, charcoal floor, finite softboxes and
linear lighting. One presentation pass tone maps, encodes sRGB and dithers the
output. Scene interactions use the canvas directly, without demo-specific control overlays.

| Demo          | Main API concept                              | Interaction                  |
| ------------- | --------------------------------------------- | ---------------------------- |
| Amber         | Texture maps and mip filtering                | Rotate a glass specimen      |
| Ferrofluid    | `PingPongComputePass`, storage textures       | Shape a magnetic surface     |
| Kinetic Array | Storage buffers and dependent compute passes  | Depress a coupled pin matrix |
| Nixie         | Named HDR targets and bloom                   | Switch clock and date        |
| Signal        | Video textures and decoded-frame invalidation | Power and scrub a monitor    |
| Prism         | On-demand compute-to-texture caustics         | Steer a dispersed spectrum   |

Prism uses no external assets. Its pointer transport lives in
`demo-shared/gallery.ts` and analytic intersection helpers in `optics.wgsl`.
The Prism README describes its optics, approximations and controls.

To compare demo rendering locally, use the shared
[playground benchmark](../../../../scripts/playground-benchmark/README.md).
It measures the complete render graph and compares canvas captures at fixed
physical resolutions, including compute and presentation. It is not published.

## Host and runtime pattern

Each demo exports a named `create<Name>Scene()` factory from `material.ts`.
The factory owns the material and render passes, plus named render targets when
needed. Destructure these resources in the host and pass them directly to
`FragCanvas`: `{material}`, `{passes}`, and optionally `{renderTargets}` in
Svelte, with the equivalent explicit props in React and Vue. React uses a lazy
`useState(create<Name>Scene)` initializer so resources survive rerenders.

Create interaction state inside the descendant runtime component. It accesses
`useSpektral`, `useFrame` and pointer hooks within the canvas context, and cleans
up its listeners on unmount. Do not pass a scene container through the component
tree or place DOM listeners in a material factory. Framework variants share the
same factory and interaction implementation.

## Optimization and visual comparisons

Use the [full-gallery benchmark](../../../../scripts/playground-benchmark/README.md)
for paired renders and image comparisons across all six demos. Keep physical
resolution, simulation grids, samples and render passes unchanged when measuring
an implementation optimization.

Shaders using `studio.wgsl` provide both `studio_occluder_distance(p)` and
`studio_occluder_lower_bound(p)`. The second function must never overestimate the
first wherever it returns a positive value. Return zero to disable the shortcut.
The shadow marcher uses this bound only when it proves that both the capped
step and current angular visibility minimum remain unchanged. The bound itself
never contributes a shadow or replaces the detailed field near the surface.
