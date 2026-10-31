import type { FrameState } from 'spektral';
import { projectToStudioPlane } from './camera';

export type GalleryPointer = { uv: [number, number]; inside: boolean; pressed: boolean };
type Runtime = { canvas: HTMLCanvasElement | undefined; invalidate(): void };

/** Direct manipulation only. Each scene owns this state and its cleanup. */
export function createGalleryInteraction(animated: boolean, onReset?: () => void) {
	let runtime: Runtime | undefined;
	let playing = animated;
	let reduced = false;
	let time = 1.6;
	let mode = 0;
	let x = 0;
	let y = 0;
	let pressure = 0;
	let keyboardX = 0;
	let changed = true;
	const request = () => {
		changed = true;
		runtime?.invalidate();
	};
	const interaction = {
		reset() {
			time = 1.6;
			mode = 0;
			keyboardX = 0;
			onReset?.();
			request();
		},
		connect(context: Runtime) {
			runtime = context;
			const media = matchMedia('(prefers-reduced-motion: reduce)');
			const preference = () => {
				reduced = media.matches;
				if (reduced) playing = false;
				request();
			};
			const key = (event: KeyboardEvent) => {
				if (event.altKey || event.ctrlKey || event.metaKey) return;
				if (event.key === ' ' && animated) playing = !playing;
				else if (event.key === 'Enter') mode = (mode + 1) % 3;
				else if (event.key === 'ArrowLeft') keyboardX = Math.max(-1, keyboardX - 0.15);
				else if (event.key === 'ArrowRight') keyboardX = Math.min(1, keyboardX + 0.15);
				else if (event.key.toLowerCase() === 'r') interaction.reset();
				else return;
				event.preventDefault();
				request();
			};
			preference();
			media.addEventListener('change', preference);
			context.canvas?.addEventListener('keydown', key);
			return () => {
				media.removeEventListener('change', preference);
				context.canvas?.removeEventListener('keydown', key);
				if (runtime === context) runtime = undefined;
			};
		},
		click(uv: readonly [number, number]) {
			const canvas = runtime?.canvas;
			if (!canvas) return;
			const point = projectToStudioPlane(uv, canvas.width, canvas.height, 0.65);
			if (Math.hypot(...point) > 1.25) return;
			if (animated) playing = !playing;
			else mode = (mode + 1) % 3;
			request();
		},
		update(frame: FrameState, pointer: GalleryPointer) {
			const dt = Math.min(Math.max(frame.delta, 0), 1 / 30);
			const targetX = Math.max(
				-1,
				Math.min(1, keyboardX + (pointer.inside ? (pointer.uv[0] - 0.5) * 2 : 0))
			);
			const targetY = pointer.inside ? (pointer.uv[1] - 0.5) * 2 : 0;
			const targetPressure = pointer.pressed ? 1 : 0;
			const settling =
				Math.abs(targetX - x) + Math.abs(targetY - y) + Math.abs(targetPressure - pressure) >
				0.0005;
			const follow = reduced ? 1 : 1 - Math.exp(-dt * 9);
			x += (targetX - x) * follow;
			y += (targetY - y) * follow;
			pressure += (targetPressure - pressure) * follow;
			if (playing) time += dt;
			if (animated) {
				frame.setUniform('uTime', time);
				frame.setUniform('uStep', playing ? dt : 0);
			}
			frame.setUniform('uPointer', [x, y, pressure, mode]);
			const dirty = changed || settling || playing;
			changed = false;
			if (settling || playing) frame.invalidate();
			return dirty;
		}
	};
	return interaction;
}
