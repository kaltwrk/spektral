import { readIndex } from './math';
import { identity, normalize, point, type Mat4, type Vec3 } from './math';
import { mesh, quad, type Mesh } from './geometry';
export type Finish = {
	color: Vec3;
	metal: number;
	roughness: number;
	style?: number;
	emission?: number;
};
// Linear reflectance, not display RGB. The shared studio pass performs the only tone map.
export const finishes = {
	black: { color: [0.026, 0.03, 0.036], metal: 0.65, roughness: 0.27, style: 1 },
	chrome: { color: [0.78, 0.82, 0.86], metal: 1, roughness: 0.09 },
	titanium: { color: [0.35, 0.38, 0.42], metal: 1, roughness: 0.28, style: 1 },
	gold: { color: [0.98, 0.76, 0.34], metal: 1, roughness: 0.2, style: 4 },
	rubber: { color: [0.012, 0.014, 0.018], metal: 0, roughness: 0.52, style: 9 },
	ink: { color: [0.009, 0.012, 0.016], metal: 0, roughness: 0.37 },
	white: { color: [0.72, 0.76, 0.78], metal: 0.05, roughness: 0.38 },
	red: { color: [0.5, 0.028, 0.013], metal: 0.2, roughness: 0.22, style: 7 },
	optic: { color: [0.006, 0.012, 0.019], metal: 0.6, roughness: 0.065, style: 6 }
} satisfies Record<string, Finish>;
export type ProductState = {
	x: number;
	y: number;
	pressure: number;
	mode: number;
	reveal: number;
	time: number;
};
export type ProductModel = {
	vertices: Float32Array;
	indices: Uint32Array;
	labels: string[];
	labelStart: number;
	animated: boolean;
	yaw?: number;
	shadowExtent?: number;
	scale: number;
	pose?: (state: ProductState) => Map<number, Mat4>;
};
/** One immutable indexed stream; material and rigid-part IDs live on its vertices. */
export class ModelBuilder {
	private vertices: number[] = [];
	private indices: number[] = [];
	private labels: string[] = [];
	private decals: {
		mesh: Mesh;
		finish: Finish;
		matrix: Mat4;
		part: number;
	}[] = [];
	add(shape: Mesh, finish: Finish, matrix = identity(), part = 0): this {
		const offset = this.vertices.length / 19;
		for (let i = 0; i < shape.positions.length / 3; i++) {
			const p = point(matrix, shape.positions.slice(i * 3, i * 3 + 3) as Vec3);
			const n = normalize(point(matrix, shape.normals.slice(i * 3, i * 3 + 3) as Vec3, true));
			this.vertices.push(
				...p,
				...n,
				readIndex(shape.uvs, i * 2),
				readIndex(shape.uvs, i * 2 + 1),
				...finish.color,
				finish.metal,
				finish.roughness,
				finish.style ?? 0,
				finish.emission ?? 0,
				part,
				...shape.positions.slice(i * 3, i * 3 + 3)
			);
		}
		for (const index of shape.indices) this.indices.push(offset + index);
		return this;
	}
	/** Transparent optical boundaries follow opaque geometry and do not cast opaque shadows. */
	overlay(shape: Mesh, finish: Finish, matrix: Mat4, part = 0): this {
		this.decals.push({ mesh: shape, finish, matrix, part });
		return this;
	}
	/** Front-facing XY decal; actual type is rasterized once into a small shared atlas. */
	label(
		text: string,
		width: number,
		height: number,
		matrix: Mat4,
		finish: Finish = finishes.white,
		part = 0
	): this {
		let row = this.labels.indexOf(text);
		if (row < 0) {
			row = this.labels.length;
			this.labels.push(text);
		}
		if (row >= 64) throw new Error('Product label atlas supports 64 distinct labels.');
		const shape = mesh();
		quad(shape, [
			[-width / 2, -height / 2, 0],
			[width / 2, -height / 2, 0],
			[width / 2, height / 2, 0],
			[-width / 2, height / 2, 0]
		]);
		const top = row / 64,
			bottom = (row + 1) / 64;
		shape.uvs = [0, bottom, 1, bottom, 1, top, 0, top];
		this.decals.push({ mesh: shape, finish: { ...finish, style: 14 }, matrix, part });
		return this;
	}
	build(options: Pick<ProductModel, 'animated' | 'pose' | 'yaw' | 'shadowExtent'>): ProductModel {
		const labelStart = this.indices.length;
		const rows = 2 ** Math.ceil(Math.log2(Math.max(1, this.labels.length)));
		for (const decal of this.decals) {
			for (let i = 1; decal.finish.style === 14 && i < decal.mesh.uvs.length; i += 2)
				decal.mesh.uvs[i] = readIndex(decal.mesh.uvs, i) * (64 / rows);
			this.add(decal.mesh, decal.finish, decal.matrix, decal.part);
		}
		let top = 0;
		for (let i = 1; i < this.vertices.length; i += 19)
			top = Math.max(top, readIndex(this.vertices, i));
		return {
			vertices: new Float32Array(this.vertices),
			indices: new Uint32Array(this.indices),
			labels: this.labels,
			labelStart,
			scale: Math.min(1, 1.42 / Math.max(top, 0.01)),
			...options
		};
	}
}
