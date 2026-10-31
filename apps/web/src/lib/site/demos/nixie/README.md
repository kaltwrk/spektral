# Nixie

Six exposed tubes display local time as HH MM SS. Click a tube or the wooden base
to switch to DD MM YY. The small physical button at the front cycles three
brightness levels. Pointer movement turns the clock slightly; the studio camera,
lighting and presentation remain shared with the other demos. Local reflection
cards add definition to the polished materials.

## HDR render targets and bloom

The base material produces linear HDR radiance. `bloom.ts` declares a half-resolution
`rgba16float` extraction target and two quarter-resolution targets. Three
`ShaderPass` instances extract highlights and apply separable Gaussian blur. These
passes use explicit named routing with `needsSwap: false`, preserving the original
scene in `source`.

The composite is a custom public `RenderPass`. It binds both `context.input` and the
blurred named target from `context.targets`, adds a small amount of bloom, then
swaps `source` and `target`. This is an actual two-texture composite; a `ShaderPass`
has only one input. The named passes are declared before the composite so its
secondary input has already been written. Spektral owns target allocation, resize
and destruction. The composite rebuilds its bind group when either view changes
and releases its own references in `dispose()`.

The final shared studio pass applies ACES Hill, sRGB encoding and stationary
subpixel dithering. Bloom is combined before those operations, while the targets
still contain HDR values.

## Material finish

The walnut uses a diffuse timber layer under a separate dielectric varnish. Its
clearcoat has lower roughness and gentler normal variation than the grain below;
Fresnel weighting balances the reflected and transmitted light. The coat follows
the rounded shoulder onto the front face. It reflects the studio, a broad strip
light and the active cathodes. Socket rims and the physical button use warm brass;
their darker bakelite inserts keep the small metal edges distinct.

## Clock and texture lifecycle

`clock.ts` reads local `Date` fields. Only cathodes whose digit changed crossfade,
over 120 ms. The wall clock determines the displayed value; frame delta determines
the fade. A timeout re-aligns to the next second after each wake, so a delayed tab
does not accumulate timing drift. Hidden documents stop the timer; visibility
restores the actual time. The on-demand canvas sleeps between transitions. In date
mode, unchanged dates do not invalidate the canvas.

The authored cathode-distance atlas and glass-stamp mask are loaded together with
`useTexture` as linear data, with mipmaps and explicit upload orientation. The
runtime publishes both textures and `uReady` together. Each framework uses the same
material, bloom, clock and interaction helpers, with its own mount/unmount lifecycle. Cleanup removes the
visibility listener and cancels the pending clock timeout.

The base uses [Smoked Walnut Veneer](https://polyhaven.com/a/smoked_walnut_veneer)
by Jenelle van Heerden / Poly Haven, CC0 1.0. Its sRGB albedo and linear OpenGL normal
and roughness maps load independently of the cathode atlas. The runtime publishes
all three wood maps in one frame once both texture hooks finish. Sources and
checksums are in `static/playground-media/nixie/NOTICE.txt` and `sources.json`.

## Tube construction and visual references

The six bulbs have separate glass walls and ten cathode planes. Each numeral is an
original continuous wire drawing in `cathodes.svg`; the distance atlas lets the
fragment shader shade the cold metal and its orange discharge separately. A
local trace resolves the depth of the supports, pins and rear shield. Perforated
mica spacers transmit tinted light according to viewing angle and sit at their
own depth among the electrodes. Twelve feedthrough pins follow a circular layout shared
with the socket holes. The two neon separators have their own smaller two-contact
sockets. An analytically intersected cylindrical cage wraps around the cathodes.
Its hexagonal pattern uses arc-length coordinates and a curved tangent frame.
The cage's wire normals catch studio reflections and light from the nearest
glowing cathode segment. Coverage is filtered against the physical pixel size.
The rear metal shield is curved as well.

Glass uses two refractions through the front wall, Fresnel studio reflections and
a thicker fused stem. Reflections include the dark studio floor and backdrop,
softboxes, narrow reflection cards and a small indirect room contribution. The
cards live in world space and follow the surface normals as the clock turns. A
reflected ray at the rear wall can catch the active cathode and the studio. This
rear reflection is composited before the tube contents, so the metal hardware
occludes it. The active and fading cathodes also illuminate the rear shield.
The stem also refracts the base seen beneath the pins. This
is a bounded realtime optical approximation, not a spectral path tracer. The
common studio supplies the camera, lights, floor and area-light shadows.

The exposed construction follows the user's photographic reference. Historical
clock research included the original magazine photographs of the
[1970/71 SWTPC Digi-Vista](https://deramp.com/swtpc.com/DigiVista/DigiVista.htm)
and [Ray Whitcombe's early-1970s clock](https://hanssummers.com/gallery7.html).
Tube internals were studied from the front and side photographs of
[IN-18](https://www.tube-tester.com/sites/nixie/data/in18.htm),
[IN-14](https://www.tube-tester.com/sites/nixie/data/in-14/in-14.htm) and the lit
[Z566M](https://commons.wikimedia.org/wiki/File:Z566M_digit_1.jpg).
This is an original clock inspired by those constructions, rather than a replica
of a specific historical tube or enclosure. Reference photos are not distributed
as runtime assets.

## Render cost

The shader keeps two camera samples and the existing bounded traces. The cage is
an analytic intersection. Procedural wood noise runs only before the texture set
arrives; cold-wire lighting runs only on covered pixels, and gas emission runs
only for lit cathodes. The material finish adds no render targets or postpasses.

To measure the full render pipeline at a fixed 12:34:56, use the Nixie cases in
[the shared playground benchmark](../../../../../scripts/playground-benchmark/README.md).
It loads the demo textures, warms up the render graph and checks canvas readback.
Timings cover CPU submission through GPU completion; they are not isolated GPU
timestamps or display frame rates. Keep machine workload comparable between runs.
