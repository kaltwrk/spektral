#include <studio>
// The product pass adds the depth-tested mesh and its key-light shadow.
fn studio_occluder_distance(p: vec3f) -> f32 { return 100.; }
fn studio_occluder_lower_bound(p: vec3f) -> f32 { return 100.; }
fn frag(uv: vec2f) -> vec4f {
    let ray = studio_camera(uv, spektralFrame.resolution);
    if (ray.direction.y >= -.001) { return vec4f(studio_background(ray.direction), 1.); }
    let p = ray.origin - ray.direction * ray.origin.y / ray.direction.y;
    return vec4f(studio_floor(p, -ray.direction, vec3f(1.), 1.), 1.);
}
