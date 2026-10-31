// Shared five-face optical body and dispersion; a rounded primary surface is
// resolved separately so secondary transport stays stable at small edge scales.
fn crystal_rotate(p: vec2f, angle: f32) -> vec2f {
 let c=cos(angle); let s=sin(angle); return vec2f(c*p.x-s*p.y,s*p.x+c*p.y);
}
struct CrystalIntersection { near: f32, far: f32, entry: vec3f, exit: vec3f, }
const PLANE_COUNT=5u;
const PLANES = array<vec4f, 5>(
 vec4f(1.0,0.0,0.0,0.68), vec4f(-1.0,0.0,0.0,0.68),
 vec4f(0.0,-1.0,0.0,-0.035),
 vec4f(0.0,0.5,0.8660254,0.60), vec4f(0.0,0.5,-0.8660254,0.60)
);
const CRYSTAL_EDGE_RADIUS=0.006;
// Exact distance to a rounded extrusion of the inset equilateral triangle.
// Continuous edge normals avoid the extra optical faces of planar chamfers.
fn crystal_distance(point: vec3f) -> f32 {
 let k=1.7320508;
 let radius=(1.165-3.0*CRYSTAL_EDGE_RADIUS)/k;
 var p=vec2f(abs(point.z)-radius,point.y-0.42333333+radius/k);
 if(p.x+k*p.y>0.0){p=vec2f(p.x-k*p.y,-k*p.x-p.y)*0.5;}
 p.x-=clamp(p.x,-2.0*radius,0.0);
 let triangle=-length(p)*sign(p.y);
 let d=vec2f(triangle,abs(point.x)-(0.68-CRYSTAL_EDGE_RADIUS));
 return min(max(d.x,d.y),0.0)+length(max(d,vec2f(0.0)))-CRYSTAL_EDGE_RADIUS;
}
fn crystal_edge_normal(p: vec3f) -> vec3f {
 let e=0.00002;
 return normalize(vec3f(
  crystal_distance(p+vec3f(e,0.0,0.0))-crystal_distance(p-vec3f(e,0.0,0.0)),
  crystal_distance(p+vec3f(0.0,e,0.0))-crystal_distance(p-vec3f(0.0,e,0.0)),
  crystal_distance(p+vec3f(0.0,0.0,e))-crystal_distance(p-vec3f(0.0,0.0,e))
 ));
}
fn crystal_at_edge(p: vec3f, normal: vec3f) -> bool {
 for(var i=0u;i<PLANE_COUNT;i++) {
  if(dot(PLANES[i].xyz,normal)<0.99 && PLANES[i].w-dot(p,PLANES[i].xyz)<CRYSTAL_EDGE_RADIUS*3.0){return true;}
 }
 return false;
}
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
fn crystal_surface_intersect(ro: vec3f, rd: vec3f) -> CrystalIntersection {
 var hit=crystal_intersect(ro,rd);
 if(hit.far<=max(hit.near,0.0)){return hit;}
 // Keep the five-plane analytic fast path everywhere except the tiny rounded
 // perimeter. Only the directly visible entry needs a rounded surface normal.
 if(hit.near>0.0 && crystal_at_edge(ro+rd*hit.near,hit.entry)) {
  for(var step=0u;step<24u;step++) {
   let d=crystal_distance(ro+rd*hit.near);
   if(d<0.00001){break;}
   hit.near+=d;
   if(hit.near>=hit.far){return hit;}
  }
  let p=ro+rd*hit.near;
  if(crystal_distance(p)>0.00004){hit.far=-10000.0;return hit;}
  hit.entry=crystal_edge_normal(p);
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
