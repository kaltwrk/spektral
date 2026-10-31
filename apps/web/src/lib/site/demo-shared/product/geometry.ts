import { readIndex } from './math';
import { cross, normalize, type Vec3 } from './math';
export type Mesh = {
	positions: number[];
	normals: number[];
	uvs: number[];
	indices: number[];
};
export const mesh = (): Mesh => ({ positions: [], normals: [], uvs: [], indices: [] });
export function vertex(out: Mesh, p: Vec3, n: Vec3, uv: [number, number] = [0, 0]) {
	const index = out.positions.length / 3;
	out.positions.push(...p);
	out.normals.push(...n);
	out.uvs.push(...uv);
	return index;
}
export function quad(
	out: Mesh,
	points: [Vec3, Vec3, Vec3, Vec3],
	normals?: [Vec3, Vec3, Vec3, Vec3]
) {
	const a = points[0],
		b = points[1],
		c = points[2];
	const n = normalize(
		cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]])
	);
	const start = out.positions.length / 3;
	points.forEach((p, i) =>
		vertex(
			out,
			p,
			normals ? readIndex(normals, i) : n,
			readIndex<[number, number]>(
				[
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 1]
				],
				i
			)
		)
	);
	out.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
}
/** A closed rounded box: faces, edge cylinders and spherical corners share normals. */
export function roundedBox(
	width: number,
	height: number,
	depth: number,
	radius = 0.04,
	segments = 4
): Mesh {
	const out = mesh(),
		half: Vec3 = [width / 2, height / 2, depth / 2];
	const r = Math.min(radius, ...half),
		inner = half.map((v) => v - r) as Vec3;
	// A nonuniform grid spends vertices on the rounding, not on the flat panels.
	const grid = (axis: number) => {
		const h = readIndex(half, axis),
			a = readIndex(inner, axis);
		const values = [-h];
		for (let i = 1; i <= segments; i++)
			values.push(-a - r * Math.cos(((i / segments) * Math.PI) / 2));
		if (a > 0) values.push(a);
		for (let i = 1; i <= segments; i++)
			values.push(a + r * Math.sin(((i / segments) * Math.PI) / 2));
		return values;
	};
	for (let axis = 0; axis < 3; axis++)
		for (const sign of [-1, 1]) {
			const u = (axis + 1) % 3,
				v = (axis + 2) % 3,
				xs = grid(u),
				ys = grid(v);
			const start = out.positions.length / 3;
			for (const y of ys)
				for (const x of xs) {
					const p: Vec3 = [0, 0, 0];
					p[axis] = readIndex(half, axis) * sign;
					p[u] = x;
					p[v] = y;
					const core = p.map((value, i) =>
						Math.max(-readIndex(inner, i), Math.min(readIndex(inner, i), value))
					) as Vec3;
					const n = normalize([p[0] - core[0], p[1] - core[1], p[2] - core[2]]);
					vertex(out, [core[0] + n[0] * r, core[1] + n[1] * r, core[2] + n[2] * r], n, [x, y]);
				}
			for (let y = 0; y < ys.length - 1; y++)
				for (let x = 0; x < xs.length - 1; x++) {
					const a = start + y * xs.length + x,
						b = a + 1,
						c = b + xs.length,
						d = a + xs.length;
					out.indices.push(...(sign > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c]));
				}
		}
	return out;
}
/** Lathe around Y. Profile order follows the outward surface from bottom to top. */
export function lathe(
	profile: readonly [number, number][],
	segments = 96,
	sweep = Math.PI * 2,
	startAngle = 0,
	profileNormals?: [number, number][]
): Mesh {
	const out = mesh();
	for (let row = 0; row < profile.length; row++) {
		const [r, y] = readIndex(profile, row);
		const before = readIndex(profile, Math.max(0, row - 1)),
			after = readIndex(profile, Math.min(profile.length - 1, row + 1));
		const supplied = profileNormals ? readIndex(profileNormals, row) : undefined;
		const n2: Vec3 = supplied
			? [supplied[0], supplied[1], 0]
			: normalize([after[1] - before[1], before[0] - after[0], 0]);
		for (let i = 0; i <= segments; i++) {
			const angle = startAngle + (i / segments) * sweep,
				c = Math.cos(angle),
				s = Math.sin(angle);
			vertex(
				out,
				[r * c, y, r * s],
				[n2[0] * c, n2[1], n2[0] * s],
				[i / segments, row / (profile.length - 1)]
			);
		}
	}
	for (let row = 0; row < profile.length - 1; row++)
		for (let i = 0; i < segments; i++) {
			const a = row * (segments + 1) + i,
				b = a + 1,
				c = b + segments + 1,
				d = a + segments + 1;
			out.indices.push(a, d, c, a, c, b);
		}
	return out;
}
/** Lathed quarter-circle bevels with exact planar and cylindrical normals. */
function bevelProfile(
	outer: number,
	inner: number,
	h: number,
	bevel: number,
	segments: number,
	sweep = Math.PI * 2
): Mesh {
	const profile: [number, number][] = [],
		normals: [number, number][] = [];
	const add = (r: number, y: number, nr: number, ny: number) => {
		profile.push([r, y]);
		normals.push([nr, ny]);
	};
	const arc = (r: number, y: number, from: number, to: number) => {
		const steps = bevel < 0.004 ? 2 : 5;
		for (let i = 0; i <= steps; i++) {
			const a = from + ((to - from) * i) / steps;
			add(r + bevel * Math.cos(a), y + bevel * Math.sin(a), Math.cos(a), Math.sin(a));
		}
	};
	add(inner ? inner + bevel : 0, -h, 0, -1);
	arc(outer - bevel, -h + bevel, -Math.PI / 2, 0);
	arc(outer - bevel, h - bevel, 0, Math.PI / 2);
	if (inner) {
		arc(inner + bevel, h - bevel, Math.PI / 2, Math.PI);
		arc(inner + bevel, -h + bevel, Math.PI, Math.PI * 1.5);
	} else add(0, h, 0, 1);
	return lathe(profile, segments, sweep, 0, normals);
}
export function cylinder(radius: number, height: number, bevel = 0.012, segments = 96): Mesh {
	return bevelProfile(radius, 0, height / 2, Math.min(bevel, height / 3, radius / 3), segments);
}
export function ring(
	outer: number,
	inner: number,
	height: number,
	bevel = 0.01,
	segments = 96,
	sweep = Math.PI * 2
): Mesh {
	return bevelProfile(
		outer,
		inner,
		height / 2,
		Math.min(bevel, height / 3, (outer - inner) / 3),
		segments,
		sweep
	);
}
/** A single convex optical boundary. Its normal follows the spherical sag. */
export function lens(radius: number, curvature: number, segments = 128): Mesh {
	const profile: [number, number][] = [],
		normals: [number, number][] = [];
	const edge = Math.sqrt(curvature * curvature - radius * radius);
	for (let i = 0; i <= 20; i++) {
		const r = (radius * i) / 20,
			y = Math.sqrt(curvature * curvature - r * r);
		profile.push([r, y - edge]);
		normals.push([r / curvature, y / curvature]);
	}
	return lathe(profile, segments, Math.PI * 2, 0, normals);
}
export function torus(
	radius: number,
	tube: number,
	majorSegments = 96,
	minorSegments = 16,
	sweep = Math.PI * 2
): Mesh {
	const out = mesh();
	for (let j = 0; j <= minorSegments; j++)
		for (let i = 0; i <= majorSegments; i++) {
			const a = (i / majorSegments) * sweep,
				b = (j / minorSegments) * Math.PI * 2,
				c = Math.cos(a),
				s = Math.sin(a),
				cb = Math.cos(b),
				sb = Math.sin(b);
			vertex(
				out,
				[(radius + tube * cb) * c, tube * sb, (radius + tube * cb) * s],
				[cb * c, sb, cb * s],
				[i / majorSegments, j / minorSegments]
			);
		}
	for (let j = 0; j < minorSegments; j++)
		for (let i = 0; i < majorSegments; i++) {
			const a = j * (majorSegments + 1) + i,
				b = a + 1,
				c = b + majorSegments + 1,
				d = a + majorSegments + 1;
			out.indices.push(a, d, c, a, c, b);
		}
	return out;
}
