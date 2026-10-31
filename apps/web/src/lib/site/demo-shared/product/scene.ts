import { defineMaterial } from 'spektral';
import { studioCameraDefines } from '../camera';
import { createStudioPresentation } from '../presentation';
import { createProductInteraction } from '../product-interaction';
import studio from '../studio.wgsl?raw';
import type { ProductModel, ProductState } from './model';
import { ProductPass } from './pass';

export function createProductScene(model: ProductModel, fragment: string) {
	const state: ProductState = { x: 0, y: 0, pressure: 0, mode: 0, reveal: 0, time: 1.6 };
	const material = defineMaterial({
		fragment,
		includes: { studio },
		defines: studioCameraDefines,
		uniforms: { uPointer: [0, 0, 0, 0], uTime: 1.6 }
	});
	return {
		material,
		passes: [new ProductPass(model, state), createStudioPresentation()],
		interaction: createProductInteraction(state, model.animated)
	};
}
