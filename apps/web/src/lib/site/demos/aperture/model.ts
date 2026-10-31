import { ModelBuilder, finishes as f, type ProductState } from '../../demo-shared/product/model';
import { cylinder, ring, roundedBox, torus, lens } from '../../demo-shared/product/geometry';
import {
	at,
	compose,
	rotation,
	translation,
	around,
	type Mat4
} from '../../demo-shared/product/math';
import { extrudeSvg } from '../../demo-shared/product/svg';

const front = (z: number) => compose(translation(0, 0.78, z), rotation('x', Math.PI / 2));
export function createModel() {
	const b = new ModelBuilder();
	// Separate coaxial barrels leave real recesses between the focusing and aperture rings.
	b.add(ring(0.64, 0.445, 0.78, 0.025), f.black, front(-0.08));
	b.add(ring(0.69, 0.49, 0.14, 0.016), f.titanium, front(0.39));
	b.add(ring(0.662, 0.5, 0.025, 0.006), f.chrome, front(0.476));
	b.add(ring(0.55, 0.445, 0.035, 0.008), f.ink, front(0.49));
	b.add(ring(0.485, 0.445, 0.025, 0.004), f.gold, front(0.5));
	b.add(cylinder(0.435, 0.045, 0.01), f.optic, front(0.16));
	b.add(torus(0.405, 0.006, 96, 8), { ...f.optic, color: [0.035, 0.09, 0.12] }, front(0.19));
	b.add(ring(0.625, 0.47, 0.11, 0.018), f.black, front(-0.58));
	b.add(ring(0.63, 0.48, 0.025, 0.006), f.chrome, front(-0.64));
	for (const z of [-0.36, 0.08]) {
		b.add(ring(0.683, 0.635, 0.2, 0.012), f.rubber, front(z));
		for (let i = 0; i < 88; i++) {
			const a = (i / 88) * Math.PI * 2;
			b.add(
				roundedBox(0.018, 0.028, 0.17, 0.006, 2),
				f.black,
				compose(translation(Math.sin(a) * 0.684, 0.78 + Math.cos(a) * 0.684, z), rotation('z', -a))
			);
		}
	}
	const blade = extrudeSvg(
		'<svg><path d="M13 -40 C29 -37 42 -22 42 0 C42 22 29 37 13 40 Z"/></svg>',
		0.8,
		0.008,
		0.0015,
		8
	);
	for (let i = 0; i < 9; i++) {
		const a = (i / 9) * Math.PI * 2;
		b.add(
			blade,
			{ ...f.titanium, color: [0.13, 0.15, 0.17], roughness: 0.32 },
			compose(translation(0, 0.78, 0.25 + i * 0.0015), rotation('z', a), translation(0.275, 0, 0)),
			i + 1
		);
	}
	// A recessed retaining ring separates the glass from the moving iris.
	b.add(ring(0.45, 0.405, 0.023, 0.003), f.black, front(0.29));
	b.add(roundedBox(0.78, 0.11, 0.68, 0.045), f.black, at(0, 0.055, -0.13));
	b.add(roundedBox(0.32, 0.16, 0.35, 0.028), f.titanium, at(0, 0.17, -0.13));
	for (let i = 0; i < 12; i++) {
		const a = (i - 5.5) * 0.12;
		b.add(
			roundedBox(0.007, 0.025 + (i % 3 === 0 ? 0.018 : 0), 0.002, 0.001, 1),
			f.white,
			compose(translation(Math.sin(a) * 0.59, 0.78 + Math.cos(a) * 0.59, 0.48), rotation('z', -a))
		);
	}
	// The iris remains a real layered mechanism behind a convex coated lens.
	b.overlay(
		lens(0.443, 1.32),
		{ color: [0.02, 0.01, 0.03], metal: 0, roughness: 0.055, style: 15 },
		compose(translation(0, 0.78, 0.405), rotation('x', Math.PI / 2))
	);
	// Labels sit on the flat chrome annulus, clear of both rounded edges and the raised retaining ring.
	b.label('S P E K T R A L', 0.44, 0.03, at(0, 1.375, 0.4892), f.ink);
	b.label('35   /   T 1.4', 0.34, 0.03, at(0, 0.185, 0.4892), f.ink);
	b.label('C I N E M A   P R I M E', 0.53, 0.016, at(0, 0.055, 0.211));
	b.add(
		cylinder(0.012, 0.006, 0.002, 20),
		f.red,
		compose(translation(0.44, 1.16, 0.505), rotation('x', Math.PI / 2))
	);
	return b.build({
		animated: false,
		yaw: 0.2,
		pose(state: ProductState) {
			const poses = new Map<number, Mat4>();
			for (let i = 0; i < 9; i++) {
				const a = (i / 9) * Math.PI * 2;
				const pivot: [number, number, number] = [
					Math.cos(a) * 0.37,
					0.78 + Math.sin(a) * 0.37,
					0.25
				];
				poses.set(
					i + 1,
					compose(
						translation(
							Math.cos(a) * (state.reveal * 0.16 - state.pressure * 0.035),
							Math.sin(a) * (state.reveal * 0.16 - state.pressure * 0.035),
							0
						),
						around(pivot, rotation('z', -state.reveal * 0.12))
					)
				);
			}
			return poses;
		}
	});
}
