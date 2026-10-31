import { describe, expect, it, vi } from 'vitest';
import type { FrameState } from 'spektral';
import { createMagnetInteraction } from '$lib/site/demos/ferrofluid/interaction';

const pointer = { uv: [0.5, 0.5] as [number, number], inside: false, pressed: false };
function frame(delta = 1 / 60) {
	return {
		delta,
		canvas: { width: 1200, height: 800 },
		setUniform: vi.fn()
	} as unknown as FrameState & { setUniform: ReturnType<typeof vi.fn> };
}
describe('Ferrofluid uniform publication', () => {
	it('skips unchanged GPU values while still publishing a changed simulation step', () => {
		const update = createMagnetInteraction();
		const state = frame();
		update(state, pointer);
		expect(state.setUniform).toHaveBeenCalledWith('uMagnet', [0, 0, 0.8, 0]);
		expect(state.setUniform).toHaveBeenCalledWith('uStep', 1 / 120);
		state.setUniform.mockClear();
		for (let i = 0; i < 60; i++) update(state, pointer);
		expect(state.setUniform).not.toHaveBeenCalled();
		state.delta = 1 / 120;
		update(state, pointer);
		expect(state.setUniform).toHaveBeenCalledExactlyOnceWith('uStep', 1 / 240);
	});
	it('publishes a new magnet position and pressure after resting, with independent mounted state', () => {
		const update = createMagnetInteraction();
		const state = frame();
		update(state, pointer);
		state.setUniform.mockClear();
		update(state, { uv: [0.75, 0.6], inside: true, pressed: true });
		const magnet = state.setUniform.mock.calls.find(([key]) => key === 'uMagnet')?.[1] as number[];
		expect(magnet[0]).not.toBe(0);
		expect(magnet[2]).toBeGreaterThan(0.8);
		expect(magnet[3]).toBeGreaterThan(0);
		const independent = frame();
		createMagnetInteraction()(independent, pointer);
		expect(independent.setUniform).toHaveBeenCalledWith('uMagnet', [0, 0, 0.8, 0]);
	});
});
