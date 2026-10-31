// Shared studio, in metres relative to the display object.
// Keep the floor, camera, emitters and linear-light response consistent across
// demos. A scene supplies visibility and contact occlusion for its own geometry.
const STUDIO_PI: f32 = 3.14159265359;
// Compact overhead spots: a neutral key, cool rear rim and restrained front fill.
const STUDIO_LIGHT_TARGET = vec3f(0.0, 0.35, 0.0);
const STUDIO_REFLECTION_FILL: f32 = 0.70;
const STUDIO_LIGHTS = array<vec3f, 3>(
	vec3f(-2.6, 5.4, 2.0), vec3f(-4.0, 4.6, -3.0), vec3f(3.2, 4.2, 3.6)
);
const STUDIO_LIGHT_SIZE = array<vec2f, 3>(
	vec2f(0.85, 0.55), vec2f(0.55, 0.8), vec2f(0.8, 0.7)
);
// Smaller emitters need higher radiance to keep the subjects illuminated.
const STUDIO_RADIANCE = array<vec3f, 3>(
	vec3f(60.0, 59.0, 56.0), vec3f(22.0, 26.0, 32.0), vec3f(16.0, 17.0, 20.0)
);
fn studio_spotlight(cosine: f32) -> f32 {
	return smoothstep(0.80, 0.96, cosine);
}
fn studio_light_area(index: u32) -> f32 {
	return STUDIO_PI * STUDIO_LIGHT_SIZE[index].x * STUDIO_LIGHT_SIZE[index].y;
}

// A demo supplies studio_occluder_distance(p): a conservative signed distance
// to its object, excluding the receiving floor. The shared light geometry sets
// shadow softness, so objects in different demos sit in the same studio.
// Also provide studio_occluder_lower_bound(p), never greater than the detailed
// field where positive. Return zero when no useful cheap bound is available.
fn studio_shadow(p: vec3f, normal: vec3f, index: u32) -> f32 {
	let offset = p + normal * 0.0015;
	let to_light = STUDIO_LIGHTS[index] - offset;
	let light_distance = length(to_light);
	let direction = to_light / light_distance;
	let light_normal = normalize(STUDIO_LIGHT_TARGET - STUDIO_LIGHTS[index]);
	let projected_area = studio_light_area(index)
		* abs(dot(light_normal, direction));
	// Preserve the projected area of the elliptical reflector rather than using
	// its longest side, which would cast an excessively wide shadow cone.
	let angular_radius = sqrt(projected_area / STUDIO_PI) / light_distance;
	var travel = 0.003;
	var visibility = 1.0;
	var previous_travel = travel;
	var closest_interval = vec2f(travel);
	for (var step_index = 0u; step_index < 112u; step_index++) {
		let sample_position = offset + direction * travel;
		// A lower bound can prove that both the capped step and the current
		// angular clearance are unchanged, without evaluating detailed geometry.
		let bound = studio_occluder_lower_bound(sample_position);
		if (bound >= .32 && bound >= visibility * max(travel * angular_radius, .0001)) {
			previous_travel = travel;
			travel += .32;
			if (travel >= light_distance) { break; }
			continue;
		}
		let distance = studio_occluder_distance(sample_position);
		if (distance < 0.00015) { return 0.0; }
		let step_size = min(distance, 0.32);
		let angular_clearance = distance / max(travel * angular_radius, 0.0001);
		if (angular_clearance < visibility) {
			visibility = angular_clearance;
			closest_interval = vec2f(previous_travel, min(travel + step_size, light_distance));
		}
		previous_travel = travel;
		travel += step_size;
		if (travel >= light_distance || visibility < 0.001) { break; }
	}
	// Refine the angular clearance between the closest march samples. This
	// remains valid for conservative, piecewise planar fields: fitting a tangent
	// between their empty spheres can invent dark contours at plane boundaries.
	if (visibility < 1.0 && visibility > 0.001) {
		for (var refinement = 0u; refinement < 14u; refinement++) {
			let first = mix(closest_interval.x, closest_interval.y, 1.0 / 3.0);
			let second = mix(closest_interval.x, closest_interval.y, 2.0 / 3.0);
			let a = studio_occluder_distance(offset + direction * first) / max(first * angular_radius, 0.0001);
			let b = studio_occluder_distance(offset + direction * second) / max(second * angular_radius, 0.0001);
			visibility = min(visibility, min(a, b));
			if (a < b) { closest_interval.y = second; } else { closest_interval.x = first; }
		}
	}
	return smoothstep(0.0, 1.0, visibility);
}

fn studio_visibility(p: vec3f, normal: vec3f) -> vec3f {
	return vec3f(studio_shadow(p, normal, 0u), studio_shadow(p, normal, 1u), studio_shadow(p, normal, 2u));
}

struct StudioRay {
	origin: vec3f,
	direction: vec3f,
}

fn studio_camera(uv: vec2f, resolution: vec2f) -> StudioRay {
	let screen = (uv * 2.0 - 1.0) * resolution / min(resolution.x, resolution.y);
	let forward = normalize(STUDIO_CAMERA_TARGET - STUDIO_CAMERA_POSITION);
	let right = normalize(cross(forward, vec3f(0.0, 1.0, 0.0)));
	let up = cross(right, forward);
	return StudioRay(STUDIO_CAMERA_POSITION, normalize(forward * STUDIO_FOCAL_LENGTH + screen.x * right + screen.y * up));
}

fn studio_fresnel(f0: vec3f, cosine: f32) -> vec3f {
	return f0 + (vec3f(1.0) - f0) * pow(1.0 - clamp(cosine, 0.0, 1.0), 5.0);
}

// A roughness-filtered reflection of finite elliptical reflectors. Unlike a
// highlight painted in screen space, this responds to position and normal.
fn studio_emitter(p: vec3f, direction: vec3f, roughness: f32, index: u32) -> f32 {
	let center = STUDIO_LIGHTS[index];
	let normal = normalize(STUDIO_LIGHT_TARGET - center);
	let axis_x = normalize(cross(vec3f(0.0, 1.0, 0.0), normal));
	let axis_y = cross(normal, axis_x);
	let denominator = dot(direction, normal);
	if (denominator >= -0.0001) { return 0.0; }
	let travel = dot(center - p, normal) / denominator;
	if (travel <= 0.0) { return 0.0; }
	let local = p + direction * travel - center;
	let uv = vec2f(dot(local, axis_x), dot(local, axis_y));
	let size = STUDIO_LIGHT_SIZE[index];
	let blur = 0.025 + roughness * roughness * travel * 2.5;
	let edge = length(uv / size);
	let softness = blur / min(size.x, size.y);
	let coverage = 1.0 - smoothstep(1.0 - softness, 1.0 + softness, edge);
	// Preserve the approximate integrated power as the lobe broadens.
	return coverage * studio_spotlight(-denominator) * (size.x * size.y) / ((size.x + blur * 0.35) * (size.y + blur * 0.35));
}

fn studio_room(direction: vec3f) -> vec3f {
	let hemisphere = smoothstep(-0.1, 0.65, direction.y);
	return mix(vec3f(0.18, 0.20, 0.24), vec3f(0.34, 0.38, 0.45), hemisphere);
}

fn studio_environment(p: vec3f, direction: vec3f, roughness: f32) -> vec3f {
	var radiance = studio_room(direction);
	for (var i = 0u; i < 3u; i++) {
		radiance += STUDIO_RADIANCE[i] * studio_emitter(p, direction, roughness, i);
	}
	return radiance;
}

fn studio_irradiance(p: vec3f, n: vec3f, visibility: vec3f) -> vec3f {
	var irradiance = vec3f(0.28, 0.30, 0.35) * (0.65 + 0.35 * n.y);
	for (var i = 0u; i < 3u; i++) {
		let delta = STUDIO_LIGHTS[i] - p;
		let distance_squared = dot(delta, delta);
		let direction = delta * inverseSqrt(distance_squared);
		let area = studio_light_area(i);
		let emitter_cosine = max(dot(-direction, normalize(STUDIO_LIGHT_TARGET - STUDIO_LIGHTS[i])), 0.0);
		irradiance += STUDIO_RADIANCE[i] * max(dot(n, direction), 0.0) * emitter_cosine * studio_spotlight(emitter_cosine) * area / distance_squared * visibility[i];
	}
	return irradiance;
}

fn studio_surface(p: vec3f, n: vec3f, view: vec3f, base_color: vec3f, metalness: f32, roughness: f32, visibility: vec3f, occlusion: f32) -> vec3f {
	let f0 = mix(vec3f(0.045), base_color, metalness);
	let fresnel = studio_fresnel(f0, dot(n, view));
	let diffuse = base_color * (1.0 - metalness) * (1.0 - fresnel) / STUDIO_PI;
	let reflection = reflect(-view, n);
	// The same finite emitters are occluded for diffuse and specular light.
	// Previously a hidden lamp could still appear as a full-strength reflection.
	var reflected = studio_room(reflection);
	for (var i = 0u; i < 3u; i++) {
		reflected += STUDIO_RADIANCE[i] * studio_emitter(p, reflection, roughness, i) * visibility[i];
	}
	return (diffuse * studio_irradiance(p, n, visibility) + reflected * fresnel * (1.0 - 0.35 * roughness)) * occlusion;
}

fn studio_floor(p: vec3f, view: vec3f, visibility: vec3f, contact: f32) -> vec3f {
	// Near-black satin floor. Light pools come from the world-space spots, not a screen vignette.
	let normal = vec3f(0.0, 1.0, 0.0);
	let color = vec3f(0.018, 0.020, 0.024);
	let diffuse = color * studio_irradiance(p, normal, visibility) / STUDIO_PI;
	// The rough charcoal floor reflects a broad, weak lobe. A polished grazing
	// reflection here would lift the whole backdrop to grey as the fill rises.
	let reflection = studio_environment(p, reflect(-view, normal), 0.72);
	let specular = reflection * studio_fresnel(vec3f(0.025), dot(normal, view)) * 0.10;
	return (diffuse + specular) * contact;
}

fn studio_background(direction: vec3f) -> vec3f {
	return mix(vec3f(0.010, 0.012, 0.016), vec3f(0.015, 0.018, 0.024), smoothstep(-0.1, 0.5, direction.y));
}
