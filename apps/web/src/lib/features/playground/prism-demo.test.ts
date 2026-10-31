import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'acorn';
import { resolveMaterial, type FrameState, type UniformValue } from 'spektral';
import { strip_types } from '$lib/playground-engine/workers/typescript-strip-types';
import { createPrismInteraction } from '$lib/site/demos/prism/interaction';
import { createGalleryInteraction } from '$lib/site/demo-shared/gallery';
import { createPrismScene as prism } from '$lib/site/demos/prism/material';
const sources = import.meta.glob(
	['/src/lib/site/demos/prism/*.ts', '/src/lib/site/demo-shared/*.ts'],
	{ query: '?raw', import: 'default', eager: true }
);
const pointer = { uv: [0.5, 0.5] as [number, number], inside: false, pressed: false };
const setupFrame = () => {
	const uniforms = new Map<string, UniformValue>();
	const invalidate = vi.fn();
	const frame = {
		delta: 1 / 60,
		invalidate,
		setUniform: (key: string, value: UniformValue) => uniforms.set(key, value)
	} as unknown as FrameState;
	return { frame, uniforms, invalidate };
};
describe('prism demo integration', () => {
	afterEach(() => vi.unstubAllGlobals());
	for (const [name, factory] of Object.entries({ prism })) {
		it(`resolves the shader contract and shared includes for ${name}`, () => {
			const resolved = resolveMaterial(factory().material);
			expect(resolved.fragmentWgsl).not.toContain('#include');
			expect(resolved.fragmentWgsl).toContain('fn frag(uv: vec2f)');
		});
	}
	it('keeps shared modules executable in the playground TypeScript pipeline', () => {
		for (const [path, source] of Object.entries(sources))
			expect(
				() => parse(strip_types(source as string), { ecmaVersion: 'latest', sourceType: 'module' }),
				path
			).not.toThrow();
	});
	it('stops requesting frames once the on-demand prism settles', () => {
		const interaction = createPrismInteraction();
		const { frame, uniforms, invalidate } = setupFrame();
		interaction.update(frame, { ...pointer, uv: [0.9, 0.6], inside: true });
		expect(invalidate).toHaveBeenCalled();
		expect([...uniforms.keys()]).toEqual(['uPointer']);
		for (let i = 0; i < 150; i++) interaction.update(frame, pointer);
		invalidate.mockClear();
		expect(interaction.update(frame, pointer)).toBe(false);
		expect(invalidate).not.toHaveBeenCalled();
	});
	it('starts reduced-motion scenes frozen and removes all listeners', () => {
		const preference = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
		vi.stubGlobal('matchMedia', () => preference);
		const canvas = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
		const interaction = createGalleryInteraction(true);
		const cleanup = interaction.connect({
			canvas: canvas as unknown as HTMLCanvasElement,
			invalidate: vi.fn()
		});
		const { frame, uniforms, invalidate } = setupFrame();
		for (let i = 0; i < 10; i++) interaction.update(frame, pointer);
		expect(uniforms.get('uTime')).toBe(1.6);
		expect(uniforms.get('uStep')).toBe(0);
		expect(invalidate).not.toHaveBeenCalled();
		cleanup();
		expect(canvas.removeEventListener).toHaveBeenCalledWith(
			...canvas.addEventListener.mock.calls[0]!
		);
		expect(preference.removeEventListener).toHaveBeenCalledWith(
			...preference.addEventListener.mock.calls[0]!
		);
	});
});
