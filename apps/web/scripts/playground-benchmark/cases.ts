import {
	defineMaterial,
	loadTexturesFromUrls,
	type FragMaterial,
	type AnyPass,
	type RenderTargetDefinitionMap,
	type UniformMap,
	type LoadedTexture
} from 'spektral';
import { createAmberScene } from '../../src/lib/site/demos/amber/material';
import { createFerrofluidScene } from '../../src/lib/site/demos/ferrofluid/material';
import { createKineticScene } from '../../src/lib/site/demos/kinetic-array/material';
import { createNixieScene } from '../../src/lib/site/demos/nixie/material';
import { createPrismScene } from '../../src/lib/site/demos/prism/material';
import { createSignalScene } from '../../src/lib/site/demos/signal/material';
import * as amber from '../../src/lib/site/demos/amber/assets';
import * as nixie from '../../src/lib/site/demos/nixie/assets';
import * as signal from '../../src/lib/site/demos/signal/assets';
import type { ProductInteraction } from '../../src/lib/site/demo-shared/product-interaction';
import { createApertureScene } from '../../src/lib/site/demos/aperture/material';
import { createMintScene } from '../../src/lib/site/demos/mint/material';

export type Scene = {
	material: FragMaterial;
	passes: AnyPass[];
	renderTargets?: RenderTargetDefinitionMap;
	interaction?: ProductInteraction;
};
export const factories = {
	amber: createAmberScene,
	ferrofluid: createFerrofluidScene,
	'kinetic-array': createKineticScene,
	nixie: createNixieScene,
	prism: createPrismScene,
	signal: createSignalScene,
	aperture: createApertureScene,
	mint: createMintScene
} satisfies Record<string, () => Scene>;
export type Demo = keyof typeof factories;
export type Case = { id: string; demo: Demo; width: number; height: number; alternate: boolean };
export const cases: Case[] = (Object.keys(factories) as Demo[]).flatMap((demo) => [
	{ id: `${demo}/default`, demo, width: 1200, height: 800, alternate: false },
	{ id: `${demo}/interaction`, demo, width: 1200, height: 800, alternate: true },
	{ id: `${demo}/portrait`, demo, width: 600, height: 800, alternate: false }
]);

export async function prepare(test: Case, factory: () => Scene = factories[test.demo]) {
	const scene = factory();
	const loaded: LoadedTexture[] = [];
	const textures = { ...scene.material.textures };
	let video: HTMLVideoElement | undefined;
	const attach = (names: string[], images: LoadedTexture[]) => {
		loaded.push(...images);
		names.forEach((name, index) => {
			const image = images[index];
			if (!image) throw new Error(`Missing ${name}`);
			textures[name] = {
				...textures[name],
				source: image.source,
				width: image.width,
				height: image.height,
				colorSpace: image.colorSpace,
				flipY: image.flipY
			};
		});
	};
	const uniforms: UniformMap = { ...scene.material.uniforms };
	if (test.demo === 'amber') {
		attach(['uAlbedo'], await loadTexturesFromUrls(amber.albedoUrls(), amber.albedoOptions));
		attach(
			['uNormal', 'uRoughness', 'uHeight', 'uAO'],
			await loadTexturesFromUrls(amber.surfaceUrls(), amber.surfaceOptions)
		);
		Object.assign(uniforms, {
			uReady: 1,
			uRotation: test.alternate ? 1.1 : 0,
			uReveal: test.alternate ? 1 : 0
		});
	}
	if (test.demo === 'nixie') {
		attach(
			['uCathodes', 'uStamp'],
			await loadTexturesFromUrls(nixie.nixieCathodeUrls(), nixie.nixieCathodeOptions)
		);
		attach(
			['uWoodAlbedo'],
			await loadTexturesFromUrls(nixie.nixieWoodColorUrls(), nixie.nixieWoodColorOptions)
		);
		attach(
			['uWoodNormal', 'uWoodRoughness'],
			await loadTexturesFromUrls(nixie.nixieWoodSurfaceUrls(), nixie.nixieWoodSurfaceOptions)
		);
		Object.assign(uniforms, {
			uReady: 1,
			uWoodReady: 1,
			uDigitsA: [1, 2, 3, 4],
			uDigitsB: [5, 6, 0, 0],
			uPreviousA: [0, 9, 8, 7],
			uPreviousB: [2, 1, 0, 0],
			uDigitMixA: test.alternate ? [0.4, 0.6, 0.5, 0.3] : [1, 1, 1, 1],
			uDigitMixB: test.alternate ? [0.5, 0.7, 1, 1] : [1, 1, 1, 1],
			uInspect: test.alternate ? [0.85, 0] : [0, 0],
			uBrightness: test.alternate ? 0.3 : 1
		});
	}
	if (test.demo === 'signal') {
		attach(
			['uLabels'],
			await loadTexturesFromUrls(signal.signalLabelUrls(), signal.signalLabelOptions)
		);
		video = document.createElement('video');
		const decoder = video;
		video.muted = true;
		video.preload = 'auto';
		video.crossOrigin = 'anonymous';
		const ready = new Promise<void>((resolve, reject) => {
			decoder.addEventListener(
				'loadeddata',
				() => {
					resolve();
				},
				{ once: true }
			);
			decoder.addEventListener(
				'error',
				() => {
					reject(new Error('Video decode failed'));
				},
				{
					once: true
				}
			);
		});
		video.src = signal.signalVideoUrl();
		video.load();
		await ready;
		const sought = new Promise<void>((resolve) => {
			decoder.addEventListener(
				'seeked',
				() => {
					resolve();
				},
				{ once: true }
			);
		});
		video.currentTime = 2;
		await sought;
		textures.uVideo = {
			...textures.uVideo,
			source: video,
			width: video.videoWidth,
			height: video.videoHeight,
			flipY: false
		};
		Object.assign(uniforms, {
			uReady: 1,
			uPlaying: 1,
			uPower: 1,
			uRaster: test.alternate ? [1, 0.008, 0, 1.12] : [1, 1, 1, 0],
			uBoot: 0,
			uInspect: test.alternate ? [-0.85, 0] : [0, 0]
		});
	}
	if (test.demo === 'ferrofluid')
		Object.assign(uniforms, { uMagnet: test.alternate ? [0.38, -0.24, 1.22, 1] : [0, 0, 0.8, 0] });
	if (test.demo === 'prism')
		Object.assign(uniforms, {
			uPointer: test.alternate ? [0.8, -0.6, 1, 2] : [0, 0, 0, 0]
		});
	let storageBuffers = scene.material.storageBuffers;
	if (test.demo === 'kinetic-array') {
		uniforms.uStep = 0;
		if (test.alternate) {
			const pin = storageBuffers.pinState;
			if (!pin || !(pin.initialData instanceof Float32Array))
				throw new Error('Missing initial pin state');
			const initial = pin.initialData;
			const state = initial.slice();
			for (let i = 0; i < state.length; i += 4) state[i] = -(state[i] ?? 0) * 1.2;
			storageBuffers = {
				...storageBuffers,
				pinState: { ...pin, initialData: state }
			};
		}
	}
	return {
		...scene,
		material: defineMaterial({ ...scene.material, uniforms, textures, storageBuffers }),
		warmup: test.demo === 'ferrofluid' ? 120 : 24,
		dispose() {
			for (const texture of loaded) texture.dispose();
			if (video) {
				video.pause();
				video.removeAttribute('src');
				video.load();
			}
		}
	};
}
