// Analytic intersections and bounded shading. No scene-wide SDF shadow marching.
struct OpticalHit { t: f32, normal: vec3f, kind: f32, }
fn optical_miss() -> OpticalHit { return OpticalHit(10000.0, vec3f(0.0, 1.0, 0.0), -1.0); }
fn optical_nearest(a: OpticalHit, b: OpticalHit) -> OpticalHit { if (b.t > 0.0 && b.t < a.t) { return b; } return a; }
fn optical_sphere(ro: vec3f, rd: vec3f, center: vec3f, radius: f32) -> vec2f {
 let q = ro - center; let b = dot(q, rd); let h = b * b - dot(q, q) + radius * radius;
 if (h < 0.0) { return vec2f(10000.0, -10000.0); }
 return vec2f(-b - sqrt(h), -b + sqrt(h));
}
fn optical_box(ro: vec3f, rd: vec3f, center: vec3f, extent: vec3f) -> vec2f {
 let inv = select(vec3f(-1.0), vec3f(1.0), rd >= vec3f(0.0)) / max(abs(rd), vec3f(0.00001));
 let a = (center - extent - ro) * inv; let b = (center + extent - ro) * inv;
 let lo = min(a, b); let hi = max(a, b);
 return vec2f(max(lo.x, max(lo.y, lo.z)), min(hi.x, min(hi.y, hi.z)));
}
fn optical_cylinder(ro: vec3f, rd: vec3f, radius: f32, bottom: f32, top: f32) -> OpticalHit {
 var hit = optical_miss();
 let a = dot(rd.xz, rd.xz); let b = dot(ro.xz, rd.xz);
 let h = b * b - a * (dot(ro.xz, ro.xz) - radius * radius);
 if (h > 0.0) {
  let t = (-b - sqrt(h)) / a; let p = ro + rd * t;
  if (t > 0.0 && p.y > bottom && p.y < top) { hit = OpticalHit(t, normalize(vec3f(p.x, 0.0, p.z)), 0.0); }
 }
 if (abs(rd.y) > 0.0001) {
  let t = (top - ro.y) / rd.y; let p = ro + rd * t;
  if (t > 0.0 && length(p.xz) < radius) { hit = optical_nearest(hit, OpticalHit(t, vec3f(0.0, 1.0, 0.0), 1.0)); }
 }
 return hit;
}
fn optical_rotate(p: vec2f, angle: f32) -> vec2f { let c = cos(angle); let s = sin(angle); return vec2f(c*p.x-s*p.y,s*p.x+c*p.y); }
fn studio_occluder_lower_bound(p: vec3f) -> f32 { return 10.0; }
fn studio_occluder_distance(p: vec3f) -> f32 { return 10.0; }
fn optical_floor(p: vec3f, view: vec3f, radius: vec2f) -> vec3f {
 // Integrated footprint shadow. Cost is independent of surface complexity.
 let q = (p.xz - vec2f(0.16, -0.10)) / radius;
 let occlusion = exp(-dot(q, q) * 1.8);
 return studio_floor(p, view, vec3f(1.0 - occlusion * 0.84), 1.0 - occlusion * 0.25);
}
fn optical_backdrop(ray: StudioRay, radius: vec2f) -> vec3f {
 let t = -ray.origin.y / ray.direction.y;
 if (t < 0.0) { return studio_background(ray.direction); }
 return optical_floor(ray.origin + ray.direction * t, -ray.direction, radius);
}
fn optical_plinth(p: vec3f, normal: vec3f, view: vec3f) -> vec3f {
 let edge = smoothstep(0.10, 0.125, p.y);
 let tint = mix(vec3f(0.021, 0.025, 0.032), vec3f(0.14, 0.16, 0.18), edge);
 return studio_surface(p, normal, view, tint, 0.85, 0.24, vec3f(1.0), 1.0);
}
fn optical_film(cosine: f32, thickness: f32) -> vec3f {
 let path = 18.3469 * thickness * sqrt(max(0.0, 1.0 - (1.0 - cosine*cosine) / 2.1316));
 return 0.38 + 0.32 * cos(path / vec3f(650.0, 510.0, 475.0));
}
