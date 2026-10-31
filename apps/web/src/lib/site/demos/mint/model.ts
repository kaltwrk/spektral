import { ModelBuilder, finishes as f } from '../../demo-shared/product/model';
import { cylinder, ring, roundedBox } from '../../demo-shared/product/geometry';
import { extrudeSvg } from '../../demo-shared/product/svg';
import { at, around, compose, rotation, translation } from '../../demo-shared/product/math';
import mark from './mark.svg?raw';

export function createModel() {
	const b = new ModelBuilder();
	const addCoin = (matrix: number[], part: number, relief: boolean) => {
		b.add(cylinder(0.71, 0.095, 0.013, 128), f.gold, matrix, part);
		b.add(
			ring(0.691, 0.628, 0.011, 0.003, 128),
			{ ...f.gold, roughness: 0.145 },
			compose(matrix, translation(0, 0.051, 0)),
			part
		);
		b.add(
			cylinder(0.626, 0.005, 0.001, 128),
			{ ...f.gold, roughness: 0.31, style: 4, color: [0.89, 0.65, 0.26] },
			compose(matrix, translation(0, 0.049, 0)),
			part
		);
		for (let i = 0; i < 128; i++) {
			const a = (i / 128) * Math.PI * 2;
			b.add(
				roundedBox(0.012, 0.064, 0.012, 0.003, 2),
				{ ...f.gold, roughness: 0.27 },
				compose(matrix, translation(Math.sin(a) * 0.708, 0, Math.cos(a) * 0.708), rotation('y', a)),
				part
			);
		}
		for (let i = 0; i < 64; i++) {
			const a = (i / 64) * Math.PI * 2;
			b.add(
				cylinder(0.006, 0.005, 0.001, 12),
				f.gold,
				compose(matrix, translation(Math.sin(a) * 0.61, 0.054, Math.cos(a) * 0.61)),
				part
			);
		}
		if (relief) {
			b.add(
				extrudeSvg(mark, 0.72, 0.026, 0.006, 12),
				{ ...f.gold, roughness: 0.18 },
				compose(matrix, translation(0, 0.064, 0), rotation('x', -Math.PI / 2)),
				part
			);
			b.label(
				'S P E K T R A L',
				0.64,
				0.05,
				compose(matrix, translation(0, 0.056, -0.46), rotation('x', -Math.PI / 2)),
				{ ...f.gold, color: [0.2, 0.09, 0.023] },
				part
			);
			b.label(
				'999.9   /   FINE GOLD',
				0.57,
				0.033,
				compose(matrix, translation(0, 0.056, 0.46), rotation('x', -Math.PI / 2)),
				{ ...f.gold, color: [0.2, 0.09, 0.023] },
				part
			);
		}
	};
	addCoin(at(-0.37, 0.048, 0.25, 'y', -0.2), 0, false);
	addCoin(at(-0.31, 0.144, 0.24, 'y', 0.2), 0, true);
	const hero = compose(translation(0.3, 0.71, -0.8), rotation('z', -0.14), rotation('x', 1.4));
	addCoin(hero, 1, true);
	return b.build({
		animated: false,
		yaw: 0.16,
		pose: (s) =>
			new Map([[1, around([0.3, 0.71, -0.8], rotation('y', s.reveal * 0.8 + s.pressure * 0.08))]])
	});
}
