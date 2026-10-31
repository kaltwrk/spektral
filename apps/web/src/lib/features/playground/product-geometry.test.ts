import { describe, expect, it } from 'vitest';
import { extrudeSvg, svgContours } from '../../site/demo-shared/product/svg';
import { cylinder, ring, type Mesh } from '../../site/demo-shared/product/geometry';

function volume(mesh: Mesh) {
	let total = 0;
	for (let i = 0; i < mesh.indices.length; i += 3) {
		const p = mesh.indices
			.slice(i, i + 3)
			.map((index) => mesh.positions.slice(index * 3, index * 3 + 3));
		const [a, b, c] = p as [number[], number[], number[]];
		total +=
			(a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) +
				a[1]! * (b[2]! * c[0]! - b[0]! * c[2]!) +
				a[2]! * (b[0]! * c[1]! - b[1]! * c[0]!)) /
			6;
	}
	return total;
}
describe('SVG solid geometry', () => {
	it('preserves holes, including reversed SVG winding, as empty volume', () => {
		for (const path of ['M0 0H10V10H0Z M3 3H7V7H3Z', 'M0 0V10H10V0Z M3 3V7H7V3Z']) {
			const solid = extrudeSvg(`<svg><path d="${path}"/></svg>`, 1, 0.2, 0);
			expect(volume(solid)).toBeCloseTo((1 - 0.16) * 0.2, 5);
			// Cap triangles must not cover the center of the hole.
			for (let i = 0; i < solid.indices.length; i += 3) {
				const indices = solid.indices.slice(i, i + 3);
				if (!indices.every((index) => Math.abs(solid.normals[index * 3 + 2]!) > 0.999)) continue;
				const x = indices.reduce((sum, index) => sum + solid.positions[index * 3]!, 0) / 3;
				const y = indices.reduce((sum, index) => sum + solid.positions[index * 3 + 1]!, 0) / 3;
				expect(Math.abs(x) >= 0.2 - 1e-6 || Math.abs(y) >= 0.2 - 1e-6).toBe(true);
			}
		}
	});
	it('creates finite unit normals and bevel surfaces without smoothing the cap into the wall', () => {
		const solid = extrudeSvg('<svg><path d="M0 0H10V10H0Z"/></svg>', 1, 0.2, 0.03);
		expect(volume(solid)).toBeGreaterThan(0.17);
		expect(volume(solid)).toBeLessThan(0.2);
		for (let i = 0; i < solid.normals.length; i += 3)
			expect(Math.hypot(...solid.normals.slice(i, i + 3))).toBeCloseTo(1, 6);
		expect(solid.normals.some((value) => value > 0.2 && value < 0.8)).toBe(true);
	});
	it('supports disconnected islands and cubic relative curves', () => {
		const rings = svgContours('<svg><path d="M0 0c2 0 2 3 4 3l0 4h-4Z M10 0H12V2H10Z"/></svg>');
		expect(rings).toHaveLength(2);
		expect(rings[0]!.length).toBeGreaterThan(12);
		expect(
			volume(extrudeSvg('<svg><path d="M0 0H2V2H0Z M4 0H6V2H4Z"/></svg>', 6, 1, 0))
		).toBeCloseTo(8);
	});
	it('rejects unsupported input instead of silently inventing geometry', () => {
		expect(() => svgContours('<svg><path d="M0 0A2 2 0 0 0 4 4Z"/></svg>')).toThrow(
			'Unsupported SVG command'
		);
		expect(() => svgContours('<svg><path d="M0 0L4 4"/></svg>')).toThrow('Close each SVG subpath');
		expect(() => svgContours('<svg><path transform="scale(2)" d="M0 0H2V2Z"/></svg>')).toThrow(
			'Bake SVG transforms'
		);
	});
});

describe('machined product surfaces', () => {
	it('keeps planar caps flat and joins them to round bevel normals', () => {
		for (const shape of [cylinder(0.7, 0.1, 0.01), ring(0.7, 0.5, 0.1, 0.01)]) {
			for (let i = 0; i < shape.positions.length; i += 3) {
				const y = shape.positions[i + 1]!;
				if (Math.abs(Math.abs(y) - 0.05) < 1e-8) {
					expect(shape.normals[i]!).toBeCloseTo(0, 6);
					expect(shape.normals[i + 1]!).toBeCloseTo(Math.sign(y), 6);
					expect(shape.normals[i + 2]!).toBeCloseTo(0, 6);
				}
			}
			expect(volume(shape)).toBeGreaterThan(0);
		}
	});
});
