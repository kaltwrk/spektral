import { ComputePass, defineMaterial, type SpektralErrorReport } from 'spektral';
import { studioCameraDefines } from '../../demo-shared/camera';
import { createStudioPresentation } from '../../demo-shared/presentation';
import studioShader from '../../demo-shared/studio.wgsl?raw';
import opticsShader from '../../demo-shared/optics.wgsl?raw';
import fragmentShader from './shaders/fragment.wgsl?raw';
import causticShader from './shaders/caustic.wgsl?raw';
import geometryShader from './shaders/geometry.wgsl?raw';
import lightPathsShader from './shaders/light-paths.wgsl?raw';

export function createPrismScene() {
	const material = defineMaterial({
		fragment: fragmentShader,
		includes: { studio: studioShader, optics: opticsShader, crystal: geometryShader },
		defines: studioCameraDefines,
		uniforms: { uPointer: [0, 0, 0, 0] },
		storageBuffers: {
			beamPaths: {
				// Five records per wavelength, plus inner/outer beam bounds.
				size: (16 * 5 + 4) * 16,
				type: 'array<vec4f>',
				access: 'read-write',
				initialData: new Float32Array((16 * 5 + 4) * 4)
			}
		},
		textures: {
			uCaustic: { storage: true, format: 'rgba16float', width: 384, height: 384, filter: 'linear' }
		}
	});
	const paths = new ComputePass({
		label: 'Spectral ray paths',
		compute: geometryShader + '\n' + lightPathsShader,
		resources: { beamPaths: { buffer: 'beamPaths', access: 'storage-read-write' } },
		dispatch: [1]
	});
	const caustic = new ComputePass({
		label: 'Spectral caustic cache',
		compute: causticShader,
		resources: {
			beamPaths: { buffer: 'beamPaths', access: 'storage-read' },
			causticMap: { texture: 'uCaustic', access: 'storage-write' }
		},
		dispatch: [48, 48]
	});
	return {
		material,
		passes: [paths, caustic, createStudioPresentation()]
	};
}
export function reportSceneError(report: SpektralErrorReport) {
	console.error('Prism', report);
}
