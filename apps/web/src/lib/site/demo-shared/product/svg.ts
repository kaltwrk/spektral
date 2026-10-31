import { readIndex } from './math';
import earcut from './earcut.js';
import { mesh, vertex, type Mesh } from './geometry';
import { normalize, type Vec3 } from './math';
type Point = [number, number];
const area = (ring: Point[]) =>
	ring.reduce((sum, p, i) => {
		const q = readIndex(ring, (i + 1) % ring.length);
		return sum + p[0] * q[1] - q[0] * p[1];
	}, 0) / 2;
function contains(ring: Point[], p: Point) {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const a = readIndex(ring, i),
			b = readIndex(ring, j);
		if (
			a[1] > p[1] !== b[1] > p[1] &&
			p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
		)
			inside = !inside;
	}
	return inside;
}
/** Deliberately small SVG subset used by these editable marks: closed M/L/H/V/C/Q/Z paths.
 * Curves are flattened once on the CPU; unsupported commands fail explicitly.
 * No DOM, images, scripts, URL loading, workers or per-frame tessellation. */
export function svgContours(svg: string, curveSteps = 12): Point[][] {
	if (svg.length > 100000 || curveSteps < 2 || curveSteps > 64)
		throw new Error('SVG exceeds the demo geometry budget.');
	if (/\btransform\s*=/.test(svg))
		throw new Error('Bake SVG transforms into path coordinates before extrusion.');
	const rings: Point[][] = [];
	for (const path of svg.matchAll(/<path\b[^>]*\bd\s*=\s*["']([^"']+)["'][^>]*>/g)) {
		const tokens =
			readIndex(path, 1).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
		let i = 0,
			command = '',
			current: Point = [0, 0],
			start: Point = [0, 0],
			ring: Point[] = [];
		const number = () => {
			const value = Number(readIndex(tokens, i++));
			if (!Number.isFinite(value)) throw new Error('Malformed SVG path.');
			return value;
		};
		const emit = (p: Point) => {
			const previous = ring.at(-1);
			if (!previous || Math.hypot(previous[0] - p[0], previous[1] - p[1]) > 1e-7) ring.push(p);
			current = p;
		};
		while (i < tokens.length) {
			if (/^[a-zA-Z]$/.test(readIndex(tokens, i))) command = readIndex(tokens, i++);
			const relative = command === command.toLowerCase(),
				op = command.toUpperCase();
			const xy = (): Point => [
				number() + (relative ? current[0] : 0),
				number() + (relative ? current[1] : 0)
			];
			if (op === 'M') {
				if (ring.length) throw new Error('Close each SVG subpath with Z.');
				emit(xy());
				start = [...current];
				command = relative ? 'l' : 'L';
			} else if (op === 'L') emit(xy());
			else if (op === 'H') emit([number() + (relative ? current[0] : 0), current[1]]);
			else if (op === 'V') emit([current[0], number() + (relative ? current[1] : 0)]);
			else if (op === 'C' || op === 'Q') {
				const a: Point = [...current],
					b = xy(),
					c = xy(),
					d = op === 'C' ? xy() : c;
				for (let step = 1; step <= curveSteps; step++) {
					const t = step / curveSteps,
						s = 1 - t;
					emit(
						op === 'C'
							? [
									s ** 3 * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t ** 3 * d[0],
									s ** 3 * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t ** 3 * d[1]
								]
							: [
									s * s * a[0] + 2 * s * t * b[0] + t * t * c[0],
									s * s * a[1] + 2 * s * t * b[1] + t * t * c[1]
								]
					);
				}
			} else if (op === 'Z') {
				if (
					ring.length > 1 &&
					Math.hypot(
						readIndex(ring, 0)[0] - readIndex(ring, ring.length - 1)[0],
						readIndex(ring, 0)[1] - readIndex(ring, ring.length - 1)[1]
					) < 1e-7
				)
					ring.pop();
				if (ring.length >= 3 && Math.abs(area(ring)) > 1e-8) rings.push(ring);
				ring = [];
				current = [...start];
				command = '';
			} else
				throw new Error(
					`Unsupported SVG command ${command || '(missing)'}. Convert to M/L/H/V/C/Q/Z paths.`
				);
			if (rings.reduce((total, points) => total + points.length, ring.length) > 12000)
				throw new Error('Too many SVG contour vertices.');
		}
		if (ring.length) throw new Error('Close each SVG subpath with Z.');
	}
	if (!rings.length) throw new Error('The SVG needs at least one filled closed path.');
	return rings;
}
/** Real watertight extrusion, including hole walls and quarter-circle bevels.
 * The cap is independently triangulated, so its normals cannot inherit side seams. */
export function extrudeSvg(
	svg: string,
	size: number,
	depth: number,
	bevel = 0.012,
	curveSteps = 12
): Mesh {
	const contours = svgContours(svg, curveSteps);
	const points = contours.flat();
	const xs = points.map((p) => p[0]),
		ys = points.map((p) => p[1]);
	const minX = Math.min(...xs),
		maxX = Math.max(...xs),
		minY = Math.min(...ys),
		maxY = Math.max(...ys);
	const scale = size / Math.max(maxX - minX, maxY - minY),
		cx = (minX + maxX) / 2,
		cy = (minY + maxY) / 2;
	const rings = contours.map((ring) =>
		ring.map(([x, y]): Point => [(x - cx) * scale, -(y - cy) * scale])
	);
	const parents = rings.map((ring, i) => {
		let parent = -1,
			smallest = Infinity;
		rings.forEach((candidate, j) => {
			const a = Math.abs(area(candidate));
			if (
				i !== j &&
				a > Math.abs(area(ring)) &&
				a < smallest &&
				contains(candidate, readIndex(ring, 0))
			) {
				parent = j;
				smallest = a;
			}
		});
		return parent;
	});
	const nesting = (i: number): number =>
		readIndex(parents, i) === -1 ? 0 : nesting(readIndex(parents, i)) + 1;
	rings.forEach((ring, i) => {
		if (area(ring) > 0 !== (nesting(i) % 2 === 0)) ring.reverse();
	});
	const out = mesh(),
		b = Math.max(0, Math.min(bevel, depth * 0.45));
	const offsets = rings.map((ring) =>
		ring.map((p, i): Point => {
			const prev = readIndex(ring, (i + ring.length - 1) % ring.length),
				next = readIndex(ring, (i + 1) % ring.length);
			const a = normalize([p[1] - prev[1], prev[0] - p[0], 0]),
				c = normalize([next[1] - p[1], p[0] - next[0], 0]);
			const n = normalize([a[0] + c[0], a[1] + c[1], 0]);
			const miter = Math.min(2.5, 1 / Math.max(0.15, n[0] * a[0] + n[1] * a[1]));
			return [n[0] * miter, n[1] * miter];
		})
	);
	const inset = (r: number, i: number, amount: number): Point => [
		readIndex(readIndex(rings, r), i)[0] - readIndex(readIndex(offsets, r), i)[0] * amount,
		readIndex(readIndex(rings, r), i)[1] - readIndex(readIndex(offsets, r), i)[1] * amount
	];
	for (let r = 0; r < rings.length; r++) {
		if (nesting(r) % 2) continue;
		const group = [r, ...rings.map((_, i) => i).filter((i) => readIndex(parents, i) === r)];
		const flat: number[] = [],
			holes: number[] = [];
		group.forEach((ring, index) => {
			if (index) holes.push(flat.length / 2);
			readIndex(rings, ring).forEach((_, i) => flat.push(...inset(ring, i, b)));
		});
		const triangles = earcut(flat, holes, 2);
		for (const sign of [-1, 1]) {
			const start = out.positions.length / 3;
			for (let i = 0; i < flat.length; i += 2)
				vertex(
					out,
					[readIndex(flat, i), readIndex(flat, i + 1), (sign * depth) / 2],
					[0, 0, sign],
					[readIndex(flat, i), readIndex(flat, i + 1)]
				);
			for (let i = 0; i < triangles.length; i += 3) {
				const a = start + readIndex(triangles, i),
					c = start + readIndex(triangles, i + 1),
					d = start + readIndex(triangles, i + 2);
				out.indices.push(...(sign > 0 ? [a, c, d] : [a, d, c]));
			}
		}
	}
	const layers: {
		z: number;
		inset: number;
		nz: number;
		radial: number;
	}[] = [];
	for (const sign of [-1, 1])
		for (let i = 0; i <= 5; i++) {
			const angle = (((sign < 0 ? i : 5 - i) / 5) * Math.PI) / 2;
			layers.push({
				z: sign * (depth / 2 - b + b * Math.cos(angle)),
				inset: b * (1 - Math.sin(angle)),
				nz: sign * Math.cos(angle),
				radial: Math.sin(angle)
			});
		}
	rings.forEach((ring, r) => {
		for (let i = 0; i < ring.length; i++) {
			const next = (i + 1) % ring.length,
				edge = normalize([
					readIndex(ring, next)[1] - readIndex(ring, i)[1],
					readIndex(ring, i)[0] - readIndex(ring, next)[0],
					0
				]);
			const start = out.positions.length / 3;
			for (const layer of layers)
				for (const j of [i, next]) {
					const p = inset(r, j, layer.inset),
						averaged = normalize([...readIndex(readIndex(offsets, r), j), 0] as Vec3);
					const smooth = averaged[0] * edge[0] + averaged[1] * edge[1] > 0.96;
					const radial = smooth ? averaged : edge;
					vertex(
						out,
						[p[0], p[1], layer.z],
						normalize([radial[0] * layer.radial, radial[1] * layer.radial, layer.nz]),
						[j / ring.length, layer.z]
					);
				}
			for (let l = 0; l < layers.length - 1; l++) {
				const a = start + l * 2;
				out.indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
			}
		}
	});
	return out;
}
