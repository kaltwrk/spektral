// The camera shader and compute pass use the same convex glass and dispersion.
fn crystal_rotate(p: vec2f, angle: f32) -> vec2f {
 let c=cos(angle); let s=sin(angle); return vec2f(c*p.x-s*p.y,s*p.x+c*p.y);
}
struct CrystalIntersection { near: f32, far: f32, entry: vec3f, exit: vec3f, }
const PLANE_COUNT=14u;
// The extra planes cut real polished chamfers along the long edges and end faces.
const PLANES = array<vec4f, 14>(
 vec4f(1.0,0.0,0.0,0.68), vec4f(-1.0,0.0,0.0,0.68),
 vec4f(0.0,-1.0,0.0,-0.035),
 vec4f(0.0,0.5,0.8660254,0.60), vec4f(0.0,0.5,-0.8660254,0.60),
 vec4f(0.0,1.0,0.0,1.185),
 vec4f(0.0,-0.5,0.8660254,0.553), vec4f(0.0,-0.5,-0.8660254,0.553),
 vec4f(0.7071068,-0.7071068,0.0,0.4470839), vec4f(-0.7071068,-0.7071068,0.0,0.4470839),
 vec4f(0.7071068,0.3535534,0.6123724,0.8960967), vec4f(0.7071068,0.3535534,-0.6123724,0.8960967),
 vec4f(-0.7071068,0.3535534,0.6123724,0.8960967), vec4f(-0.7071068,0.3535534,-0.6123724,0.8960967)
);
// XZ's 2D rotation has the opposite sign to the studio's Y-axis rotation.
// Preserve the resting pose and match horizontal inspection across demos.
fn crystal_angle() -> f32 { return 0.38 - spektralUniforms.uPointer.x * 0.18; }
fn crystal_local(p: vec3f) -> vec3f { let q = crystal_rotate(p.xz, -crystal_angle()); return vec3f(q.x,p.y,q.y); }
fn crystal_world(p: vec3f) -> vec3f { let q = crystal_rotate(p.xz, crystal_angle()); return vec3f(q.x,p.y,q.y); }
fn crystal_intersect(ro: vec3f, rd: vec3f) -> CrystalIntersection {
 var hit = CrystalIntersection(-10000.0,10000.0,vec3f(0.0),vec3f(0.0));
 for (var i=0u;i<PLANE_COUNT;i++) {
  let plane=PLANES[i]; let denominator=dot(plane.xyz,rd); let numerator=plane.w-dot(plane.xyz,ro);
  if (abs(denominator)<0.00001) { if (numerator<0.0) { hit.far=-10000.0; } }
  else {
   let t=numerator/denominator;
   if (denominator<0.0 && t>hit.near) { hit.near=t; hit.entry=plane.xyz; }
   if (denominator>0.0 && t<hit.far) { hit.far=t; hit.exit=plane.xyz; }
  }
 }
 return hit;
}

fn crystal_index(wavelength: f32) -> f32 {
 let micrometres=wavelength*0.001;
 // Cauchy dispersion. Three glass grades; pressure gently increases dispersion.
 let dispersion=select(select(0.023,0.031,spektralUniforms.uPointer.w>0.5),0.015,spektralUniforms.uPointer.w>1.5);
 return 1.45+(dispersion+spektralUniforms.uPointer.z*0.004)/(micrometres*micrometres);
}
fn crystal_incident() -> vec3f {
 let angle=0.28+spektralUniforms.uPointer.y*0.035;
 return vec3f(0.0,sin(angle),-cos(angle));
}
fn crystal_entry() -> vec3f {
 // Leave room for the floor spectrum in the shared studio framing.
 let height=0.70+spektralUniforms.uPointer.y*0.04;
 return vec3f(0.0,height,(0.60-height*0.5)/0.8660254);
}
fn crystal_spectrum(wavelength: f32) -> vec3f {
 let red=exp(-pow((wavelength-610.0)/43.0,2.0))+0.25*exp(-pow((wavelength-410.0)/18.0,2.0));
 let green=exp(-pow((wavelength-540.0)/34.0,2.0));
 let blue=exp(-pow((wavelength-455.0)/29.0,2.0));
 return vec3f(red*1.1,green*1.35,blue*1.5);
}
