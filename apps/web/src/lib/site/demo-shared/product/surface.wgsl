struct ProductFrame {
	viewport: vec4f,
	state: vec4f,
	transforms: array<mat4x4f, 32>,
}
@group(0) @binding(0) var<uniform> product: ProductFrame;
@group(0) @binding(1) var shadow_map: texture_depth_2d;
@group(0) @binding(2) var shadow_sampler: sampler_comparison;
@group(0) @binding(3) var label_atlas: texture_2d<f32>;
@group(0) @binding(4) var label_sampler: sampler;
@group(0) @binding(5) var backdrop: texture_2d<f32>;

struct VertexIn {
	@location(0) position: vec3f,
	@location(1) normal: vec3f,
	@location(2) uv: vec2f,
	@location(3) color: vec3f,
	@location(4) finish: vec4f,
	@location(5) part: f32,
 @location(6) local: vec3f,
}
struct Surface {
	@builtin(position) clip: vec4f,
	@location(0) position: vec3f,
	@location(1) normal: vec3f,
	@location(2) uv: vec2f,
	@location(3) color: vec3f,
	@location(4) finish: vec4f,
	@location(5) local: vec3f,
}

fn camera_project(p: vec3f) -> vec4f {
	let forward = normalize(STUDIO_CAMERA_TARGET - STUDIO_CAMERA_POSITION);
	let right = normalize(cross(forward, vec3f(0., 1., 0.)));
	let up = cross(right, forward);
	let delta = p - STUDIO_CAMERA_POSITION;
	let z = dot(delta, forward);
	let screen = vec2f(dot(delta, right), dot(delta, up)) * STUDIO_FOCAL_LENGTH * min(product.viewport.x, product.viewport.y) / product.viewport.xy;
	return vec4f(screen, 30. / 29.9 * z - 3. / 29.9, z);
}
fn shadow_project(p: vec3f) -> vec3f {
	let eye = STUDIO_LIGHTS[0];
	let forward = normalize(STUDIO_LIGHT_TARGET - eye);
	let right = normalize(cross(forward, vec3f(0., 1., 0.)));
	let up = cross(right, forward);
	let delta = p - eye;
	return vec3f(dot(delta, right) / product.viewport.z, dot(delta, up) / product.viewport.z, dot(delta, forward) / 12.);
}
@vertex fn product_vertex(input: VertexIn) -> Surface {
	let model = product.transforms[u32(input.part)];
	let p = (model * vec4f(input.position, 1.)).xyz;
	var out: Surface;
	out.clip = camera_project(p); out.position = p;
	out.normal = normalize((model * vec4f(input.normal, 0.)).xyz);
	out.uv = input.uv; out.color = input.color; out.finish = input.finish; out.local = input.local;
	return out;
}
@vertex fn shadow_vertex(input: VertexIn) -> @builtin(position) vec4f {
	let world = (product.transforms[u32(input.part)] * vec4f(input.position, 1.)).xyz;
	return vec4f(shadow_project(world), 1.);
}
fn product_shadow(p: vec3f, normal: vec3f) -> f32 {
	let coordinate = shadow_project(p + normal * .0025);
	let uv = coordinate.xy * vec2f(.5, -.5) + .5;
	if (any(uv < vec2f(0.)) || any(uv > vec2f(1.)) || coordinate.z < 0. || coordinate.z > 1.) { return 1.; }
	let taps = array<vec2f, 12>(vec2f(-.326, -.406), vec2f(-.84, -.074), vec2f(-.696, .457), vec2f(-.203, .621), vec2f(.962, -.195), vec2f(.473, -.48), vec2f(.519, .767), vec2f(.185, -.893), vec2f(.507, .064), vec2f(.896, .412), vec2f(-.322, -.933), vec2f(-.792, -.598));
	// The penumbra follows the shared emitter size, including the compact overhead key.
	// Cost is bounded: twelve depth reads, followed by twelve comparison taps.
	var blockers = 0.; var blocker_depth = 0.;
	for (var i = 0u; i < 12u; i++) {
		let texel = clamp(vec2i((uv + taps[i] * .018) * 1024.), vec2i(0), vec2i(1023));
		let depth = textureLoad(shadow_map, texel, 0);
		if (depth < coordinate.z - .001) { blocker_depth += depth; blockers += 1.; }
	}
	if (blockers == 0.) { return 1.; }
	let average = blocker_depth / blockers;
	let emitter_radius = sqrt(STUDIO_LIGHT_SIZE[0].x * STUDIO_LIGHT_SIZE[0].y) / (2. * product.viewport.z);
	let radius = clamp((coordinate.z - average) / max(average, .01) * emitter_radius, 1. / 1024., .035);
	var sum = 0.;
	for (var i = 0u; i < 12u; i++) { sum += textureSampleCompareLevel(shadow_map, shadow_sampler, uv + taps[i] * radius, coordinate.z - .0007); }
	return sum / 12.;
}
fn hash3(p: vec3f) -> f32 {
	var q = fract(p * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z);
}
fn noise3(p: vec3f) -> f32 {
	let cell = floor(p); let f = fract(p); let u = f * f * (3. - 2. * f);
	return mix(mix(mix(hash3(cell), hash3(cell + vec3f(1., 0., 0.)), u.x), mix(hash3(cell + vec3f(0., 1., 0.)), hash3(cell + vec3f(1., 1., 0.)), u.x), u.y), mix(mix(hash3(cell + vec3f(0., 0., 1.)), hash3(cell + vec3f(1., 0., 1.)), u.x), mix(hash3(cell + vec3f(0., 1., 1.)), hash3(cell + vec3f(1., 1., 1.)), u.x), u.y), u.z);
}
fn filtered_wave(phase: f32) -> f32 {
	return sin(phase) * (1. - smoothstep(.5, 2.5, fwidth(phase)));
}
// Local photographic reflection cards, shared by this product collection.
// Their finite positions give even a planar polished face a moving reflection.
fn product_card(p: vec3f, direction: vec3f, center: vec3f, size: vec2f, roughness: f32) -> f32 {
	let normal = normalize(vec3f(0., .7, 0.) - center);
	let axis_x = normalize(cross(vec3f(0., 1., 0.), normal));
	let axis_y = cross(normal, axis_x);
	let denominator = dot(direction, normal);
	if (denominator > -.0001) { return 0.; }
	let distance = dot(center - p, normal) / denominator;
	if (distance < 0.) { return 0.; }
	let hit = p + direction * distance - center;
	let blur = roughness * roughness * distance * 1.7;
	let width = size + blur;
	let q = vec2f(dot(hit, axis_x), dot(hit, axis_y)) / width;
	return exp(-dot(q * q, q * q) * 1.2) * size.x * size.y / (width.x * width.y);
}
@fragment fn product_fragment(input: Surface, @builtin(front_facing) front: bool) -> @location(0) vec4f {
	let style = u32(input.finish.z + .5);
 if (style == 15u) {
  let normal = normalize(input.normal);
  let view = normalize(STUDIO_CAMERA_POSITION-input.position);
  let cosine = clamp(dot(normal,view),0.,1.);
  let direction = reflect(-view,normal);
  // Coated optical glass: a weak blue/violet normal reflection, neutral grazing.
  let coating = mix(vec3f(.024,.011,.033),vec3f(1.),pow(1.-cosine,5.));
  let environment = studio_environment(input.position,direction,.055)
    + STUDIO_REFLECTION_FILL * vec3f(1.7,1.85,2.) * product_card(input.position,direction,vec3f(-2.4,3.2,4.8),vec2f(1.1,1.8),.055);
  let opacity = max(coating.r,max(coating.g,coating.b));
  return vec4f(environment*coating/max(opacity,.001),opacity);
 }
	var n = normalize(input.normal) * select(-1., 1., front);
	let view = normalize(STUDIO_CAMERA_POSITION - input.position);
	var base = input.color; var roughness = input.finish.y; var metal = input.finish.x;
	var alpha = 1.;
	let p = input.local;
	if (style == 14u) {
		alpha = textureSample(label_atlas, label_sampler, input.uv).a;
		if (alpha < .08) { discard; }
	}
	if (style == 1u) {
		let grain = filtered_wave((p.x + p.z * .27) * 1800.);
		roughness += grain * .012;
		base *= .99 + .01 * grain;
	}
	if (style == 9u) {
		let detail = noise3(p * 165.);
		let fade = 1. - smoothstep(.3, 1.2, length(fwidth(p * 165.)));
		base *= 1. + (detail - .5) * fade * .22;
		roughness += (detail - .5) * fade * .1;
	}
	if (style == 4u) {
		let radial = length(p.xz);
		let grooves = filtered_wave(radial * 1900.);
		roughness += grooves * .012;
		base *= .985 + .015 * grooves;
	}
	if (style == 6u) {
		let facing = max(dot(n, view), 0.);
		let coating = .5 + .5 * cos(vec3f(0., 2.1, 4.2) + facing * 5.5 + length(p) * .6);
		base = mix(base, coating * vec3f(.025, .065, .12), .65);
	}
	let normal_variance = max(dot(dpdx(n),dpdx(n)), dot(dpdy(n),dpdy(n)));
 roughness = sqrt(clamp(roughness*roughness + min(normal_variance*.35,.035), .002, .81));
 let visibility = product_shadow(input.position, n);
	var radiance = studio_surface(input.position, n, view, base, metal, clamp(roughness, .045, .9), vec3f(visibility, .8 + .2 * visibility, 1.), .94);
	let reflected = reflect(-view, n);
	let cards = vec3f(3.2, 3.35, 3.5) * product_card(input.position, reflected, vec3f(-2.4, 3.2, 4.8), vec2f(1.1, 1.8), roughness)
		+ vec3f(1.3, 1.23, 1.1) * product_card(input.position, reflected, vec3f(4., 2.2, .6), vec2f(.6, 1.8), roughness)
		+ vec3f(1.9, 2., 2.12) * product_card(input.position, reflected, vec3f(.2, .4, 4.8), vec2f(1.3, 2.2), roughness);
	radiance += studio_fresnel(mix(vec3f(.04), base, metal), dot(n, view)) * (cards * STUDIO_REFLECTION_FILL - studio_room(reflected) * .3 * metal) * (1. - .35 * roughness);
	if (style == 7u) {
		radiance += studio_environment(input.position, reflect(-view, n), .11) * studio_fresnel(vec3f(.035), dot(n, view)) * .35;
	}
	radiance += base * input.finish.w;
	return vec4f(radiance, alpha);
}
@vertex fn background_vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
	let p = array<vec2f, 3>(vec2f(-1., -1.), vec2f(3., -1.), vec2f(-1., 3.));
	return vec4f(p[index], .999, 1.);
}
@fragment fn background_fragment(@builtin(position) position: vec4f) -> @location(0) vec4f {
	let uv = vec2f(position.x / product.viewport.x, 1. - position.y / product.viewport.y);
	let ray = studio_camera(uv, product.viewport.xy);
	var color = textureLoad(backdrop, vec2i(position.xy), 0).rgb;
	if (ray.direction.y < -.001) {
		let p = ray.origin - ray.direction * ray.origin.y / ray.direction.y;
		let shadow = product_shadow(p, vec3f(0., 1., 0.));
		color *= .32 + .68 * shadow;
	}
	return vec4f(color, 1.);
}
