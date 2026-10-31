import {
	createCurrentWritable,
	createFrameRegistry,
	createSpektralRuntimeLoop,
	type RenderPass,
	type SpektralRuntimeLoop
} from 'spektral';
import { studioColor } from '../../src/lib/site/demo-shared/presentation';
import { cases, prepare, type Case, type Scene } from './cases';
import { baselineFactories } from 'virtual:benchmark-baseline';

function required<T>(value: T | null | undefined): T {
	if (value == null) throw new Error('Required benchmark value is missing');
	return value;
}
const baselineButton = required(document.querySelector<HTMLButtonElement>('#baseline'));
const compareButton = required(document.querySelector<HTMLButtonElement>('#compare'));
const controlInput = required(document.querySelector<HTMLInputElement>('#control'));
const selection = required(document.querySelector<HTMLSelectElement>('#case'));
const status = required(document.querySelector<HTMLParagraphElement>('#status'));
const output = required(document.querySelector<HTMLPreElement>('#results'));
const stage = required(document.querySelector<HTMLDivElement>('#stage'));
const rows = required(document.querySelector<HTMLTableSectionElement>('#rows'));
const images = required(document.querySelector<HTMLDivElement>('#images'));
for (const test of cases) {
	const option = document.createElement('option');
	option.value = test.id;
	option.textContent = test.id;
	selection.append(option);
}

type Capture = {
	id: string;
	width: number;
	height: number;
	pixels: Uint8ClampedArray;
	median: number;
	p95: number;
	samples: number;
	adapter: Record<string, string>;
};
type Difference = { mae: number; changedPercent: number; max: number };
const db = await new Promise<IDBDatabase>((resolve, reject) => {
	const request = indexedDB.open('spektral-playground-comparison-v1', 1);
	request.onupgradeneeded = () => request.result.createObjectStore('captures', { keyPath: 'id' });
	request.onsuccess = () => {
		resolve(request.result);
	};
	request.onerror = () => {
		reject(request.error ?? new Error('IndexedDB request failed'));
	};
});
async function save(capture: Capture) {
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction('captures', 'readwrite');
		tx.objectStore('captures').put(capture);
		tx.oncomplete = () => {
			resolve();
		};
		tx.onerror = () => {
			reject(tx.error ?? new Error('IndexedDB transaction failed'));
		};
	});
}
async function load(id: string) {
	return new Promise<Capture | undefined>((resolve, reject) => {
		const request = db.transaction('captures').objectStore('captures').get(id);
		request.onsuccess = () => {
			resolve(request.result as Capture | undefined);
		};
		request.onerror = () => {
			reject(request.error ?? new Error('IndexedDB request failed'));
		};
	});
}
function difference(a: Capture, b: Capture): Difference {
	if (a.width !== b.width || a.height !== b.height)
		throw new Error('Mismatched capture dimensions');
	let total = 0,
		max = 0,
		changed = 0;
	for (let i = 0; i < a.pixels.length; i += 4) {
		let peak = 0;
		for (let c = 0; c < 3; c++) {
			const d = Math.abs((a.pixels[i + c] ?? 0) - (b.pixels[i + c] ?? 0));
			total += d;
			peak = Math.max(peak, d);
		}
		max = Math.max(max, peak);
		if (peak > 2) changed++;
	}
	return {
		mae: total / (a.width * a.height * 3),
		changedPercent: (changed / (a.width * a.height)) * 100,
		max
	};
}
function show(capture: Capture, title: string) {
	const figure = document.createElement('figure');
	const label = document.createElement('figcaption');
	label.textContent = title;
	const canvas = document.createElement('canvas');
	canvas.width = capture.width;
	canvas.height = capture.height;
	required(canvas.getContext('2d')).putImageData(
		new ImageData(new Uint8ClampedArray(capture.pixels), capture.width, capture.height),
		0,
		0
	);
	figure.append(label, canvas);
	images.append(figure);
}
function summary({ pixels: _, ...capture }: Capture) {
	return capture;
}

async function capture(test: Case, factory?: () => Scene): Promise<Capture> {
	const scene = await prepare(test, factory);
	const canvas = document.createElement('canvas');
	canvas.style.width = `${String(test.width)}px`;
	canvas.style.height = `${String(test.height)}px`;
	stage.replaceChildren(canvas);
	const context = canvas.getContext('webgpu');
	if (!context) throw new Error('WebGPU unavailable');
	let presented: GPUTexture | undefined;
	const configure = context.configure.bind(context);
	context.configure = (config) => {
		configure({ ...config, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
	};
	const acquire = context.getCurrentTexture.bind(context);
	context.getCurrentTexture = () => {
		presented = acquire();
		return presented;
	};
	let device: GPUDevice | undefined;
	let loop: SpektralRuntimeLoop | undefined;
	let resolveFrame: ((ms: number) => void) | undefined;
	let rejectFrame: ((error: Error) => void) | undefined;
	let start = 0;
	let frozen = false;
	let copying = false;
	let readback: GPUBuffer | undefined;
	const stride = Math.ceil((test.width * 4) / 256) * 256;
	let frameCount = 0;
	const registry = createFrameRegistry({ renderMode: 'manual' });
	registry.register(
		(frame) => {
			start = performance.now();
			if (test.demo === 'ferrofluid') frame.setUniform('uStep', frozen ? 0 : 1 / 120);
			if (!frozen && scene.interaction)
				scene.interaction.update(
					{ ...frame, delta: 1 / 30 },
					{
						uv: test.alternate ? [0.9, 0.2] : [0.5, 0.5],
						inside: test.alternate,
						pressed: test.alternate
					}
				);
		},
		{ autoInvalidate: false }
	);
	const tap: RenderPass = {
		label: 'Benchmark completion observer',
		input: 'source',
		output: 'target',
		needsSwap: false,
		render(ctx) {
			device = ctx.device;
			frameCount++;
			const done = resolveFrame;
			const fail = rejectFrame;
			const began = start;
			resolveFrame = undefined;
			rejectFrame = undefined;
			queueMicrotask(() => {
				if (copying && presented) {
					readback = ctx.device.createBuffer({
						size: stride * test.height,
						usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
					});
					const encoder = ctx.device.createCommandEncoder();
					encoder.copyTextureToBuffer(
						{ texture: presented },
						{ buffer: readback, bytesPerRow: stride },
						{ width: test.width, height: test.height }
					);
					ctx.device.queue.submit([encoder.finish()]);
				}
				void ctx.device.queue
					.onSubmittedWorkDone()
					.then(() => done?.(performance.now() - began))
					.catch((error: unknown) =>
						fail?.(error instanceof Error ? error : new Error(String(error)))
					);
			});
		}
	};
	const passes = [...scene.passes, tap];
	const report = (error: { message: string } | null) => {
		if (error) {
			rejectFrame?.(new Error(error.message));
			rejectFrame = undefined;
			resolveFrame = undefined;
		}
	};
	const nextFrame = () =>
		new Promise<number>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Frame timeout in ${test.id}`));
			}, 20000);
			resolveFrame = (ms) => {
				clearTimeout(timeout);
				resolve(ms);
			};
			rejectFrame = (error) => {
				clearTimeout(timeout);
				reject(error);
			};
			required(loop).advance();
		});
	try {
		loop = createSpektralRuntimeLoop({
			canvas,
			registry,
			size: createCurrentWritable({ width: test.width, height: test.height }),
			dpr: createCurrentWritable(1),
			maxDelta: createCurrentWritable(1 / 60),
			getMaterial: () => scene.material,
			getPasses: () => passes,
			getRenderTargets: () => scene.renderTargets ?? {},
			getClearColor: () => [0, 0, 0, 1],
			getColor: () => studioColor,
			getAdapterOptions: () => ({ powerPreference: 'high-performance' }),
			getDeviceDescriptor: () => undefined,
			getOnError: () => report,
			reportError: report
		});
		for (let i = 0; i < scene.warmup; i++) await nextFrame();
		frozen = true;
		const times: number[] = [];
		for (let i = 0; i < 40; i++) times.push(await nextFrame());
		if (!device || !presented) throw new Error('No rendered frame');
		// Copy the swapchain texture before the browser presents/discards this frame.
		// This extra capture frame and its readback are outside the measured samples.
		copying = true;
		await nextFrame();
		const buffer = required(readback);
		await buffer.mapAsync(GPUMapMode.READ);
		const bytes = new Uint8Array(buffer.getMappedRange());
		const pixels = new Uint8ClampedArray(test.width * test.height * 4);
		const bgra = navigator.gpu.getPreferredCanvasFormat().startsWith('bgra');
		let low = 255,
			high = 0;
		for (let y = 0; y < test.height; y++)
			for (let x = 0; x < test.width; x++) {
				const src = y * stride + x * 4,
					dst = (y * test.width + x) * 4;
				const r = bytes[src + (bgra ? 2 : 0)] ?? 0,
					g = bytes[src + 1] ?? 0,
					b = bytes[src + (bgra ? 0 : 2)] ?? 0;
				pixels.set([r, g, b, 255], dst);
				low = Math.min(low, r, g, b);
				high = Math.max(high, r, g, b);
			}
		buffer.unmap();
		buffer.destroy();
		if (high - low < 30) throw new Error(`Blank capture (${String(low)}..${String(high)})`);
		if (frameCount !== scene.warmup + 41)
			throw new Error(`Unexpected render count: ${String(frameCount)}`);
		times.sort((a, b) => a - b);
		const info = device.adapterInfo;
		return {
			id: test.id,
			width: test.width,
			height: test.height,
			pixels,
			median: required(times[20]),
			p95: required(times[38]),
			samples: 40,
			adapter: {
				vendor: info.vendor,
				architecture: info.architecture,
				device: info.device,
				description: info.description
			}
		};
	} finally {
		loop?.destroy();
		for (const pass of scene.passes) if ('dispose' in pass) pass.dispose?.();
		scene.dispose();
		canvas.remove();
	}
}

async function run(baseline: boolean) {
	const control = !baseline && controlInput.checked;
	controlInput.disabled = true;
	baselineButton.disabled = true;
	compareButton.disabled = true;
	selection.disabled = true;
	rows.replaceChildren();
	images.replaceChildren();
	const results: unknown[] = [];
	try {
		const selected = cases.filter(
			(test) =>
				selection.value === 'all' ||
				selection.value === test.id ||
				((selection.value === 'products' || selection.value === 'products-default') &&
					!['amber', 'ferrofluid', 'kinetic-array', 'nixie', 'prism', 'signal'].includes(
						test.demo
					) &&
					(selection.value === 'products' || test.id.endsWith('/default')))
		);
		for (const test of selected) {
			status.textContent = `${baseline ? 'Baseline' : 'Comparison'}: ${test.id} (${String(results.length + 1)}/${String(selected.length)})`;
			const reference = baseline ? undefined : baselineFactories[test.demo];
			if (control && !reference) throw new Error('Timing control requires SPEKTRAL_BASELINE_DIR');
			let before: Capture | undefined;
			let current: Capture;
			if (reference) {
				// Alternate order to limit bias from GPU clocks and thermal drift.
				if (results.length % 2 === 0) {
					before = await capture(test, reference);
					current = await capture(test, control ? reference : undefined);
				} else {
					current = await capture(test, control ? reference : undefined);
					before = await capture(test, reference);
				}
			} else {
				before = baseline ? undefined : await load(test.id);
				if (!baseline && !before) throw new Error(`Capture baseline first: ${test.id}`);
				current = await capture(test, control ? reference : undefined);
			}
			const diff = before ? difference(before, current) : undefined;
			if (baseline) await save(current);
			const change = before ? (current.median / before.median - 1) * 100 : undefined;
			const row = document.createElement('tr');
			for (const value of [
				test.id,
				(before ?? current).median.toFixed(2),
				baseline ? '—' : current.median.toFixed(2),
				change === undefined ? '—' : `${change.toFixed(1)}%`,
				diff?.mae.toFixed(5) ?? '—',
				diff ? `${diff.changedPercent.toFixed(4)}%` : '—',
				diff?.max ?? '—'
			]) {
				const cell = document.createElement('td');
				cell.textContent = String(value);
				row.append(cell);
			}
			row.addEventListener('click', () => {
				images.replaceChildren();
				if (before) show(before, `${test.id} — baseline`);
				show(current, `${test.id} — current`);
			});
			rows.append(row);
			images.replaceChildren();
			if (before) show(before, `${test.id} — baseline`);
			show(current, `${test.id} — current`);
			results.push({
				case: test.id,
				paired: Boolean(reference),
				control,
				before: before ? summary(before) : null,
				current: summary(current),
				changePercent: change,
				difference: diff
			});
			output.textContent = JSON.stringify({ status: 'running', results }, null, 2);
		}
		status.textContent = 'Complete';
		output.textContent = JSON.stringify({ status: 'complete', results }, null, 2);
	} catch (error) {
		status.textContent = String(error);
		status.className = 'error';
		output.textContent = JSON.stringify(
			{ status: 'error', error: String(error), results },
			null,
			2
		);
	} finally {
		baselineButton.disabled = false;
		compareButton.disabled = false;
		selection.disabled = false;
		controlInput.disabled = false;
	}
}
baselineButton.addEventListener('click', () => {
	void run(true);
});
compareButton.addEventListener('click', () => {
	void run(false);
});
