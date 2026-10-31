import { describe, expect, it, vi } from 'vitest';
import { posix } from 'node:path';

vi.mock('./playground-pages', () => ({
	getPlaygroundPages: () =>
		Object.keys(import.meta.glob('/src/lib/site/demos/*/svelte/App.svelte')).map((path) => {
			const id = path.split('/').at(-3)!;
			return { id, title: id, slug: id };
		})
}));

import { getPlaygroundDemoVariant } from './playground-demos';

describe('shared studio in playground demos', () => {
	for (const demoId of [
		'amber',
		'ferrofluid',
		'kinetic-array',
		'nixie',
		'signal',
		'prism',
		'aperture',
		'mint'
	]) {
		for (const framework of ['svelte', 'react', 'vue'] as const) {
			it(`includes a self-contained source tree for ${demoId} / ${framework}`, () => {
				const variant = getPlaygroundDemoVariant(demoId, framework)!;
				const appName = framework === 'react' ? 'App.tsx' : `App.${framework}`;
				const runtimeName = framework === 'react' ? 'runtime.tsx' : `runtime.${framework}`;
				const sources = {
					[appName]: variant.appSource,
					[runtimeName]: variant.runtimeSource!,
					...variant.additionalFiles
				};
				expect(Object.keys(sources)).toEqual(
					expect.arrayContaining([
						'shared/camera.ts',
						'shared/studio.wgsl',
						'shared/presentation.ts',
						'shared/presentation.wgsl',
						'shaders/fragment.wgsl'
					])
				);
				if (demoId === 'ferrofluid') {
					expect(sources).toHaveProperty('shaders/simulate.wgsl');
				}
				for (const [file, source] of Object.entries(sources)) {
					for (const match of source.matchAll(/\bfrom\s*['"](\.[^'"\n]+)['"]/g)) {
						const imported = match[1]!.split('?')[0]!;
						const resolved = posix.normalize(posix.join(posix.dirname(file), imported));
						expect(sources, `${file} imports missing ${resolved}`).toHaveProperty(resolved);
					}
				}
			});
		}
	}
	it('keeps the product renderer and SVG tessellator out of existing shader demos', () => {
		const sources = getPlaygroundDemoVariant('prism', 'svelte')!.additionalFiles;
		expect(Object.keys(sources).some((path) => path.startsWith('shared/product/'))).toBe(false);
	});
	it('includes the tessellator only in demos which extrude SVG', () => {
		expect(getPlaygroundDemoVariant('mint', 'svelte')!.additionalFiles).toHaveProperty(
			'shared/product/earcut.js'
		);
		expect(getPlaygroundDemoVariant('prism', 'svelte')!.additionalFiles).not.toHaveProperty(
			'shared/product/earcut.js'
		);
	});
});
