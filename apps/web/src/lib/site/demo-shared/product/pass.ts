import type { RenderPass, RenderPassContext } from 'spektral';
import { studioCamera } from '../camera';
import studio from '../studio.wgsl?raw';
import shader from './surface.wgsl?raw';
import { compose, multiply, rotation, scaling } from './math';
import type { ProductModel, ProductState } from './model';

function required<T>(value: T | undefined): T {
	if (value === undefined) throw new Error('Product GPU resources were not prepared.');
	return value;
}

const vertexLayout: GPUVertexBufferLayout = {
	arrayStride: 76,
	attributes: [
		{ shaderLocation: 0, offset: 0, format: 'float32x3' },
		{ shaderLocation: 1, offset: 12, format: 'float32x3' },
		{ shaderLocation: 2, offset: 24, format: 'float32x2' },
		{ shaderLocation: 3, offset: 32, format: 'float32x3' },
		{ shaderLocation: 4, offset: 44, format: 'float32x4' },
		{ shaderLocation: 5, offset: 60, format: 'float32' },
		{ shaderLocation: 6, offset: 64, format: 'float32x3' }
	]
};

/** Public RenderPass extension: immutable mesh buffers, one shadow map, 4× MSAA. */
export class ProductPass implements RenderPass {
	readonly label = 'Studio product geometry';
	readonly input = 'source';
	readonly output = 'target';
	readonly needsSwap = true;
	private device?: GPUDevice;
	private buffers: GPUBuffer[] = [];
	private vertices?: GPUBuffer;
	private indices?: GPUBuffer;
	private uniforms?: GPUBuffer;
	private atlas?: GPUTexture;
	private shadow?: GPUTexture;
	private color?: GPUTexture;
	private depth?: GPUTexture;
	private layout?: GPUBindGroupLayout;
	private group?: GPUBindGroup;
	private shadowGroup?: GPUBindGroup;
	private shadowLayout?: GPUBindGroupLayout;
	private pipeline?: GPURenderPipeline;
	private background?: GPURenderPipeline;
	private shadowPipeline?: GPURenderPipeline;
	private source?: GPUTexture;
	private width = 0;
	private height = 0;
	private format?: GPUTextureFormat;
	private readonly data = new Float32Array(8 + 32 * 16);
	private readonly model: ProductModel;
	private readonly state: ProductState;
	constructor(model: ProductModel, state: ProductState) {
		this.model = model;
		this.state = state;
	}
	private buffer(device: GPUDevice, data: Float32Array | Uint32Array, usage: GPUBufferUsageFlags) {
		const result = device.createBuffer({
			size: data.byteLength,
			usage: usage | GPUBufferUsage.COPY_DST
		});
		device.queue.writeBuffer(result, 0, data as Float32Array<ArrayBuffer>);
		this.buffers.push(result);
		return result;
	}
	private prepare(context: RenderPassContext) {
		const device = context.device;
		if (this.device !== device || this.format !== context.output.format) {
			this.dispose();
			this.device = device;
			this.format = context.output.format;
			this.vertices = this.buffer(device, this.model.vertices, GPUBufferUsage.VERTEX);
			this.indices = this.buffer(device, this.model.indices, GPUBufferUsage.INDEX);
			this.uniforms = this.buffer(device, this.data, GPUBufferUsage.UNIFORM);
			const canvas = document.createElement('canvas');
			canvas.width = 1024;
			canvas.height = 64 * 2 ** Math.ceil(Math.log2(Math.max(1, this.model.labels.length)));
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('Unable to prepare product label atlas.');
			ctx.fillStyle = '#ffffff';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.font = '500 46px Arial, sans-serif';
			this.model.labels.forEach((text, row) => {
				ctx.save();
				ctx.translate(512, row * 64 + 32);
				ctx.scale(940 / Math.max(ctx.measureText(text).width, 1), 1);
				ctx.fillText(text, 0, 0);
				ctx.restore();
			});
			const mipLevelCount = Math.floor(Math.log2(Math.max(canvas.width, canvas.height))) + 1;
			this.atlas = device.createTexture({
				label: 'Product labels',
				size: [canvas.width, canvas.height],
				mipLevelCount,
				format: 'rgba8unorm',
				usage:
					GPUTextureUsage.TEXTURE_BINDING |
					GPUTextureUsage.COPY_DST |
					GPUTextureUsage.RENDER_ATTACHMENT
			});
			device.queue.copyExternalImageToTexture({ source: canvas }, { texture: this.atlas }, [
				canvas.width,
				canvas.height
			]);
			for (let level = 1; level < mipLevelCount; level++) {
				const mip = document.createElement('canvas');
				mip.width = Math.max(1, canvas.width >> level);
				mip.height = Math.max(1, canvas.height >> level);
				const mipContext = mip.getContext('2d');
				if (!mipContext) throw new Error('Unable to filter product labels.');
				mipContext.drawImage(canvas, 0, 0, mip.width, mip.height);
				device.queue.copyExternalImageToTexture(
					{ source: mip },
					{ texture: this.atlas, mipLevel: level },
					[mip.width, mip.height]
				);
			}
			this.shadow = device.createTexture({
				label: 'Product key-light shadow',
				size: [1024, 1024],
				format: 'depth32float',
				usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
			});
			const module = device.createShaderModule({
				label: 'Studio mesh',
				code:
					`diagnostic(off, derivative_uniformity);\nconst STUDIO_CAMERA_POSITION = vec3f(${studioCamera.position.join(',')});\nconst STUDIO_CAMERA_TARGET = vec3f(${studioCamera.target.join(',')});\nconst STUDIO_FOCAL_LENGTH = ${String(studioCamera.focalLength)};\nfn studio_occluder_distance(p: vec3f)->f32{return 100.;}\nfn studio_occluder_lower_bound(p:vec3f)->f32{return 100.;}\n` +
					studio +
					'\n' +
					shader
			});
			this.layout = device.createBindGroupLayout({
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
						buffer: { type: 'uniform' }
					},
					{ binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
					{ binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
					{ binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
					{ binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
					{
						binding: 5,
						visibility: GPUShaderStage.FRAGMENT,
						texture: { sampleType: 'unfilterable-float' }
					}
				]
			});
			const layout = device.createPipelineLayout({ bindGroupLayouts: [this.layout] });
			this.pipeline = device.createRenderPipeline({
				label: 'Product surfaces',
				layout,
				vertex: { module, entryPoint: 'product_vertex', buffers: [vertexLayout] },
				fragment: {
					module,
					entryPoint: 'product_fragment',
					targets: [
						{
							format: context.output.format,
							blend: {
								color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
								alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }
							}
						}
					]
				},
				primitive: { topology: 'triangle-list', cullMode: 'none' },
				depthStencil: {
					format: 'depth24plus',
					depthWriteEnabled: true,
					depthCompare: 'less-equal'
				},
				multisample: { count: 4 }
			});
			this.background = device.createRenderPipeline({
				label: 'Product studio backdrop',
				layout,
				vertex: { module, entryPoint: 'background_vertex' },
				fragment: {
					module,
					entryPoint: 'background_fragment',
					targets: [{ format: context.output.format }]
				},
				depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' },
				multisample: { count: 4 }
			});
			this.shadowLayout = device.createBindGroupLayout({
				entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }]
			});
			this.shadowPipeline = device.createRenderPipeline({
				label: 'Product shadow',
				layout: device.createPipelineLayout({ bindGroupLayouts: [this.shadowLayout] }),
				vertex: { module, entryPoint: 'shadow_vertex', buffers: [vertexLayout] },
				primitive: { topology: 'triangle-list', cullMode: 'none' },
				depthStencil: {
					format: 'depth32float',
					depthWriteEnabled: true,
					depthCompare: 'less',
					depthBias: 1,
					depthBiasSlopeScale: 1
				}
			});
			this.shadowGroup = device.createBindGroup({
				layout: this.shadowLayout,
				entries: [{ binding: 0, resource: { buffer: this.uniforms } }]
			});
		}
		if (this.width !== context.width || this.height !== context.height) {
			this.color?.destroy();
			this.depth?.destroy();
			this.width = context.width;
			this.height = context.height;
			this.color = device.createTexture({
				label: 'Product MSAA color',
				size: [this.width, this.height],
				format: context.output.format,
				sampleCount: 4,
				usage: GPUTextureUsage.RENDER_ATTACHMENT
			});
			this.depth = device.createTexture({
				label: 'Product MSAA depth',
				size: [this.width, this.height],
				format: 'depth24plus',
				sampleCount: 4,
				usage: GPUTextureUsage.RENDER_ATTACHMENT
			});
		}
		if (this.source !== context.input.texture) {
			this.source = context.input.texture;
			this.group = device.createBindGroup({
				layout: required(this.layout),
				entries: [
					{ binding: 0, resource: { buffer: required(this.uniforms) } },
					{ binding: 1, resource: required(this.shadow).createView() },
					{
						binding: 2,
						resource: device.createSampler({
							compare: 'less-equal',
							minFilter: 'linear',
							magFilter: 'linear'
						})
					},
					{ binding: 3, resource: required(this.atlas).createView() },
					{
						binding: 4,
						resource: device.createSampler({
							minFilter: 'linear',
							magFilter: 'linear',
							mipmapFilter: 'linear'
						})
					},
					{ binding: 5, resource: context.input.view }
				]
			});
		}
	}
	render(context: RenderPassContext) {
		this.prepare(context);
		const root = compose(
			scaling(this.model.scale),
			rotation('y', (this.model.yaw ?? 0) + this.state.x * 0.48)
		);
		const pose = this.model.pose?.(this.state);
		this.data.set([
			context.width,
			context.height,
			this.model.shadowExtent ?? 3.2,
			this.state.time,
			this.state.x,
			this.state.y,
			this.state.reveal,
			this.state.pressure
		]);
		for (let i = 0; i < 32; i++) {
			const part = pose?.get(i);
			this.data.set(part ? multiply(root, part) : root, 8 + i * 16);
		}
		context.device.queue.writeBuffer(required(this.uniforms), 0, this.data);
		const shadow = context.commandEncoder.beginRenderPass({
			label: 'Product shadow',
			colorAttachments: [],
			depthStencilAttachment: {
				view: required(this.shadow).createView(),
				depthClearValue: 1,
				depthLoadOp: 'clear',
				depthStoreOp: 'store'
			}
		});
		shadow.setPipeline(required(this.shadowPipeline));
		shadow.setBindGroup(0, this.shadowGroup);
		shadow.setVertexBuffer(0, this.vertices);
		shadow.setIndexBuffer(required(this.indices), 'uint32');
		shadow.drawIndexed(this.model.labelStart);
		shadow.end();
		const pass = context.commandEncoder.beginRenderPass({
			label: 'Product beauty',
			colorAttachments: [
				{
					view: required(this.color).createView(),
					resolveTarget: context.output.view,
					clearValue: [0, 0, 0, 1],
					loadOp: 'clear',
					storeOp: 'discard'
				}
			],
			depthStencilAttachment: {
				view: required(this.depth).createView(),
				depthClearValue: 1,
				depthLoadOp: 'clear',
				depthStoreOp: 'discard'
			}
		});
		pass.setBindGroup(0, this.group);
		pass.setPipeline(required(this.background));
		pass.draw(3);
		pass.setPipeline(required(this.pipeline));
		pass.setVertexBuffer(0, this.vertices);
		pass.setIndexBuffer(required(this.indices), 'uint32');
		pass.drawIndexed(this.model.indices.length);
		pass.end();
	}
	dispose() {
		for (const buffer of this.buffers) buffer.destroy();
		this.buffers = [];
		this.atlas?.destroy();
		this.shadow?.destroy();
		this.color?.destroy();
		this.depth?.destroy();
		this.device = undefined;
		this.source = undefined;
		this.width = 0;
		this.height = 0;
	}
}
