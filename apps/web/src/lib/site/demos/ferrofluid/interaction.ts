import type { FrameState } from 'spektral';
import { projectToStudioPlane } from '../../demo-shared/camera';

type MagnetPointer = { uv: [number, number]; inside: boolean; pressed: boolean };

/** Each mounted canvas owns its magnet state; the GPU owns the evolving surface. */
export function createMagnetInteraction() {
	let x = 0;
	let z = 0;
	let strength = 0.8;
	let pressure = 0;
	let published: [number, number, number, number] | undefined;
	let publishedStep: number | undefined;

	return (frame: FrameState, pointer: MagnetPointer) => {
		const engaged = pointer.inside || pointer.pressed;
		const projected = engaged
			? projectToStudioPlane(pointer.uv, frame.canvas.width, frame.canvas.height, 0.135)
			: [0, 0];
		const radius = Math.hypot(projected[0]!, projected[1]!);
		const clamp = Math.min(1, 0.78 / Math.max(radius, 0.001));
		const delta = Math.max(0, Math.min(frame.delta, 1 / 30));
		const follow = 1 - Math.exp(-delta * 12);
		const response = 1 - Math.exp(-delta * 7);
		x += (projected[0]! * clamp - x) * follow;
		z += (projected[1]! * clamp - z) * follow;
		strength += ((pointer.pressed ? 1.22 : engaged ? 1 : 0.8) - strength) * response;
		pressure += ((pointer.pressed ? 1 : 0) - pressure) * response;
		// Compare the values the GPU actually receives, retaining full precision
		// in the easing state. A settled magnet needs no repeated uniform writes.
		const nextX = Math.fround(x);
		const nextZ = Math.fround(z);
		const nextStrength = Math.fround(strength);
		const nextPressure = Math.fround(pressure);
		if (
			!published ||
			published[0] !== nextX ||
			published[1] !== nextZ ||
			published[2] !== nextStrength ||
			published[3] !== nextPressure
		) {
			frame.setUniform('uMagnet', [x, z, strength, pressure]);
			published = [nextX, nextZ, nextStrength, nextPressure];
		}
		// Two state updates run before each fragment render; their total time is one frame.
		const nextStep = Math.fround(delta / 2);
		if (nextStep !== publishedStep) {
			frame.setUniform('uStep', delta / 2);
			publishedStep = nextStep;
		}
	};
}
