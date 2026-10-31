import { describe, expect, it } from 'vitest';
import { point, identity } from '../../site/demo-shared/product/math';
import type { ProductModel } from '../../site/demo-shared/product/model';

const models = import.meta.glob('/src/lib/site/demos/*/model.ts', {
	eager: true,
	import: 'createModel'
}) as Record<string, () => ProductModel>;

describe('product mesh budgets and vertex contract', () => {
	it('registers the two retained product models', () => {
		expect(Object.keys(models)).toHaveLength(2);
	});
	for (const [path, create] of Object.entries(models)) {
		it(path, () => {
			const model = create();
			const count = model.vertices.length / 19;
			expect(count).toBeGreaterThan(100);
			expect(count).toBeLessThan(250_000);
			expect(model.indices.length / 3).toBeLessThan(250_000);
			expect(model.indices.every((index) => index < count)).toBe(true);
			expect(model.vertices.every(Number.isFinite)).toBe(true);
			let normalError = 0,
				top = 0,
				bottom = Infinity,
				heroBottom = Infinity,
				maxPart = 0;
			for (let i = 0; i < model.vertices.length; i += 19) {
				normalError = Math.max(
					normalError,
					Math.abs(
						Math.hypot(model.vertices[i + 3]!, model.vertices[i + 4]!, model.vertices[i + 5]!) - 1
					)
				);
				top = Math.max(top, model.vertices[i + 1]! * model.scale);
				bottom = Math.min(bottom, model.vertices[i + 1]! * model.scale);
				if (model.vertices[i + 15] === 1)
					heroBottom = Math.min(heroBottom, model.vertices[i + 1]! * model.scale);
				maxPart = Math.max(maxPart, model.vertices[i + 15]!);
			}
			expect(normalError).toBeLessThan(0.00001);
			expect(top).toBeLessThanOrEqual(1.42001);
			expect(maxPart).toBeLessThan(32);
			expect(bottom).toBeGreaterThanOrEqual(-0.00001);
			expect(bottom).toBeLessThan(0.002);
			if (path.includes('/mint/')) {
				expect(heroBottom).toBeGreaterThanOrEqual(0);
				expect(heroBottom).toBeLessThan(0.004);
			}
			expect(model.labels.length).toBeLessThanOrEqual(64);
			if (path.includes('/mint/')) {
				// The upright coin must clear both disks, including during inspection.
				for (const reveal of [0, 0.25, 0.5, 0.75, 1]) {
					const pose =
						model.pose?.({ x: 0, y: 0, time: 0, mode: 0, reveal, pressure: 1 })?.get(1) ??
						identity();
					let intersections = 0;
					for (let i = 0; i < model.vertices.length; i += 19) {
						if (model.vertices[i + 15] !== 1) continue;
						const [x, y, z] = point(pose, [
							model.vertices[i]!,
							model.vertices[i + 1]!,
							model.vertices[i + 2]!
						]);
						for (const [cx, cy, cz] of [
							[-0.37, 0.048, 0.25],
							[-0.31, 0.144, 0.24]
						]) {
							if (Math.abs(y - cy!) < 0.043 && Math.hypot(x - cx!, z - cz!) < 0.695)
								intersections++;
						}
					}
					expect(intersections).toBe(0);
				}
			}
		});
	}
});
