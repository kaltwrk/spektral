# Playground comparison

A development-only harness for Amber, Ferrofluid, Kinetic Array, Nixie, Prism,
Signal, Aperture and Mint. It uses the public Spektral runtime and each demo's complete render graph,
including compute, HDR targets, bloom and presentation. It is not published.

Run from the repository root:

```sh
pnpm --dir apps/web exec vite --config scripts/playground-benchmark/vite.config.ts
```

Open `http://127.0.0.1:4182`. Capture a baseline before editing, then choose
**Compare current**. Baseline RGBA captures persist in IndexedDB across reloads.
Click a result row to inspect the two images. The JSON below the table contains
adapter information, medians, p95 and image differences.

For back-to-back timing, snapshot the source before editing:

```sh
snapshot=$(mktemp -d /tmp/spektral-comparison.XXXXXX)
cp -R apps/web/src/lib/site/demos "$snapshot/demos"
cp -R apps/web/src/lib/site/demo-shared "$snapshot/demo-shared"
SPEKTRAL_BASELINE_DIR="$snapshot" pnpm --dir apps/web exec vite --config scripts/playground-benchmark/vite.config.ts
```

The snapshot must expose the current named scene factories. **Compare current**
then renders the reference and working tree consecutively, alternating their order
between cases. The **Compare reference to itself** checkbox runs an A/A control
against the same snapshot to reveal timing noise. It requires a snapshot path.

## What is measured

Each demo has a default and interaction case at 1200 × 800 physical pixels and a
portrait case at 600 × 800. DPR is one. Time, pointer values, digits and the decoded
video frame are fixed. Texture maps use the real demo assets. Ferrofluid warms up
for 120 frames, then freezes its simulation timestep; its compute passes still
execute. Other cases warm up for 24 frames, followed by 40 measured frames.

Timing starts in the frame callback and ends at GPU queue completion. It includes
CPU submission and browser callback scheduling, excludes the wait for animation
frames, and is **not an isolated GPU timestamp or an FPS measurement**. Background
work, GPU power state and scheduling can materially affect short cases. Repeat
paired runs and inspect the A/A control before claiming a small improvement.
Product interaction callbacks run during warmup and freeze for measured frames.
Framework mount cost is not measured here; their
behavior is covered by app tests and browser checks.

An extra unmeasured frame copies the presented texture for comparison. Empty
captures and incorrect frame counts fail the run. MAE and maximum error use RGB
channel units from 0 to 255. The changed-pixel percentage counts pixels with any
channel difference greater than two. Inspect images as well: these fixed views
cannot prove equivalence for every input, animation time or GPU.

See [the optimization results](RESULTS.md) for retained changes and limitations.
