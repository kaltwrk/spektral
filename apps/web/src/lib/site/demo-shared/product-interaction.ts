import type { FrameState } from 'spektral';
import { projectToStudioPlane } from './camera';
import type { GalleryPointer } from './gallery';
import type { ProductState } from './product/model';

type Runtime = { canvas: HTMLCanvasElement | undefined; invalidate(): void };
export type ProductInteraction = ReturnType<typeof createProductInteraction>;

/** Same studio pointer convention as the shader demos; no preview controls or timers. */
export function createProductInteraction(state: ProductState, animated: boolean) {
	let runtime: Runtime | undefined;
	let reduced = false,
		playing = animated;
	const request = () => runtime?.invalidate();
	const interaction = {
		connect(context: Runtime) {
			runtime = context;
			const media = matchMedia('(prefers-reduced-motion: reduce)');
			const preference = () => {
				reduced = media.matches;
				playing = animated && !reduced;
				request();
			};
			preference();
			media.addEventListener('change', preference);
			return () => {
				media.removeEventListener('change', preference);
				if (runtime === context) runtime = undefined;
			};
		},
		click(uv: readonly [number, number]) {
			const canvas = runtime?.canvas;
			if (!canvas) return;
			const p = projectToStudioPlane(uv, canvas.width, canvas.height, 0.7);
			if (Math.hypot(...p) < 1.65) {
				state.mode = (state.mode + 1) % 3;
				request();
			}
		},
		update(frame: FrameState, pointer: GalleryPointer) {
			const dt = Math.min(Math.max(frame.delta, 0), 1 / 30);
			const x = Math.max(-1, Math.min(1, pointer.inside ? (pointer.uv[0] - 0.5) * 2 : 0));
			const y = pointer.inside ? (pointer.uv[1] - 0.5) * 2 : 0;
			const pressure = pointer.pressed ? 1 : 0,
				reveal = state.mode / 2;
			const settling =
				Math.abs(x - state.x) +
					Math.abs(y - state.y) +
					Math.abs(pressure - state.pressure) +
					Math.abs(reveal - state.reveal) >
				0.0005;
			const follow = reduced ? 1 : 1 - Math.exp(-dt * 8);
			state.x += (x - state.x) * follow;
			state.y += (y - state.y) * follow;
			state.pressure += (pressure - state.pressure) * follow;
			state.reveal += (reveal - state.reveal) * follow;
			if (playing) state.time += dt;
			frame.setUniform('uPointer', [state.x, state.y, state.pressure, state.mode]);
			frame.setUniform('uTime', state.time);
			if (settling || playing) frame.invalidate();
		}
	};
	return interaction;
}
