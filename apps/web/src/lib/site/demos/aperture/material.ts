import type { SpektralErrorReport } from 'spektral';
import { createProductScene } from '../../demo-shared/product/scene';
import { createModel } from './model';
import fragment from './shaders/fragment.wgsl?raw';

export function createApertureScene() {
	return createProductScene(createModel(), fragment);
}
export function reportSceneError(report: SpektralErrorReport) {
	console.error('Aperture', report);
}
