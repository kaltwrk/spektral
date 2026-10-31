export type Vec3 = [number, number, number];
export type Mat4 = number[];
export function readIndex<T>(values: ArrayLike<T>, index: number): T {
	const value = values[index];
	if (value === undefined) throw new RangeError('Geometry index is outside its source array.');
	return value;
}
export const identity = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export const scaling = (value: number): Mat4 => [
	value,
	0,
	0,
	0,
	0,
	value,
	0,
	0,
	0,
	0,
	value,
	0,
	0,
	0,
	0,
	1
];
export const normalize = (v: Vec3): Vec3 => {
	const length = Math.hypot(...v) || 1;
	return [v[0] / length, v[1] / length, v[2] / length];
};
export const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
export function multiply(a: Mat4, b: Mat4): Mat4 {
	const m = new Array<number>(16).fill(0);
	for (let c = 0; c < 4; c++)
		for (let r = 0; r < 4; r++)
			for (let k = 0; k < 4; k++)
				m[c * 4 + r] = readIndex(m, c * 4 + r) + readIndex(a, k * 4 + r) * readIndex(b, c * 4 + k);
	return m;
}
export function translation(x: number, y: number, z: number): Mat4 {
	const m = identity();
	m[12] = x;
	m[13] = y;
	m[14] = z;
	return m;
}
export function rotation(axis: 'x' | 'y' | 'z', angle: number): Mat4 {
	const c = Math.cos(angle),
		s = Math.sin(angle);
	if (axis === 'x') return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
	if (axis === 'y') return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
	return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
export const compose = (...matrices: Mat4[]): Mat4 => matrices.reduce(multiply, identity());
export const around = (pivot: Vec3, matrix: Mat4): Mat4 =>
	compose(translation(...pivot), matrix, translation(-pivot[0], -pivot[1], -pivot[2]));
export function point(m: Mat4, p: Vec3, direction = false): Vec3 {
	const w = direction ? 0 : 1;
	return [
		readIndex(m, 0) * p[0] + readIndex(m, 4) * p[1] + readIndex(m, 8) * p[2] + readIndex(m, 12) * w,
		readIndex(m, 1) * p[0] + readIndex(m, 5) * p[1] + readIndex(m, 9) * p[2] + readIndex(m, 13) * w,
		readIndex(m, 2) * p[0] + readIndex(m, 6) * p[1] + readIndex(m, 10) * p[2] + readIndex(m, 14) * w
	];
}
export const at = (x: number, y: number, z: number, axis?: 'x' | 'y' | 'z', angle = 0) =>
	compose(translation(x, y, z), axis ? rotation(axis, angle) : identity());
