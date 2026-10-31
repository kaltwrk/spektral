#include <studio>
#include <optics>
#include <crystal>

// Analytic Gaussian beam/ray proximity: no volume raymarch and no blur pass.
fn light_segment(ro: vec3f, rd: vec3f, a: vec3f, b: vec3f, limit: f32, width: f32) -> f32 {
 let length=max(distance(a,b),0.0001);let axis=(b-a)/length;
 let cosine=dot(rd,axis);let relative=ro-a;
 let along=clamp((dot(relative,axis)-dot(relative,rd)*cosine)/max(1.0-cosine*cosine,0.0001),0.0,length);
 let centre=a+axis*along;let travel=dot(centre-ro,rd);
 if(travel<0.0 || travel>limit){return 0.0;}
 let q=ro+rd*travel-centre;let distanceSquared=dot(q,q);
 let footprint=travel/(STUDIO_FOCAL_LENGTH*min(spektralFrame.resolution.x,spektralFrame.resolution.y));
 let radius=max(width,footprint*0.8);
 return exp(-distanceSquared/(radius*radius))*width/radius+exp(-distanceSquared/(radius*radius*12.0))*0.055;
}
fn beam_bounds_hit(ro: vec3f, rd: vec3f, limit: f32, offset: u32) -> bool {
 let lo=beamPaths[offset].xyz;let hi=beamPaths[offset+1u].xyz;
 let hit=optical_box(ro,rd,(lo+hi)*0.5,(hi-lo)*0.5);
 return hit.y>max(hit.x,0.0) && hit.x<limit;
}
fn external_light(ro: vec3f, rd: vec3f, limit: f32) -> vec3f {
 var color=vec3f(light_segment(ro,rd,beamPaths[0].xyz,beamPaths[1].xyz,limit,0.012))*3.0;
 if(!beam_bounds_hit(ro,rd,limit,82u)){return color;}
 for(var i=0u;i<16u;i++) {
  let offset=i*5u;
  color+=beamPaths[offset+4u].rgb*light_segment(ro,rd,beamPaths[offset+2u].xyz,beamPaths[offset+3u].xyz,limit,0.014)*0.65;
 }
 return color;
}
fn internal_light(ro: vec3f, rd: vec3f, limit: f32) -> vec3f {
 var color=vec3f(0.0);
 if(!beam_bounds_hit(ro,rd,limit,80u)){return color;}
 for(var i=0u;i<16u;i++) {
  let offset=i*5u;
  color+=beamPaths[offset+4u].rgb*light_segment(ro,rd,beamPaths[offset+1u].xyz,beamPaths[offset+2u].xyz,limit,0.012)*0.35;
 }
 return color;
}
fn lit_floor(p: vec3f, view: vec3f) -> vec3f {
 var light=vec3f(0.0);
 if(all(abs(p.xz)<vec2f(3.4))){light=textureSampleLevel(uCaustic,uCausticSampler,p.xz/6.8+vec2f(0.5),0.0).rgb;}
 let support=beamPaths[0].xyz-normalize(beamPaths[1].xyz-beamPaths[0].xyz)*0.18;
 let footprint=(p.xz-support.xz)/vec2f(0.24);
 let shadow=1.0-0.7*exp(-dot(footprint,footprint)*2.0);
 return optical_floor(p,view,vec2f(0.8,0.65))*shadow+light;
}
fn glass_environment(origin: vec3f, direction: vec3f) -> vec3f {
 // Dark studio walls with a restrained fill, rather than the bright diffuse
 // lighting proxy used by opaque materials. This keeps glass from looking silver.
 var color=mix(studio_background(direction),studio_room(direction),0.12);
 for(var i=0u;i<3u;i++) {
  color+=STUDIO_RADIANCE[i]*studio_emitter(origin,direction,0.025,i);
 }
 return color;
}
fn through_scene(origin: vec3f, direction: vec3f) -> vec3f {
 if(direction.y < -0.001) {
  let distance=-origin.y/direction.y;
  return lit_floor(origin+direction*distance,-direction)+external_light(origin,direction,distance);
 }
 return glass_environment(origin,direction)+external_light(origin,direction,8.0);
}
// Unpolarized dielectric Fresnel. eta is the incident/transmitted IOR ratio.
// Unlike Schlick at the outer surface alone, this tends to one at the critical
// angle inside the glass, so transmission never snaps straight to reflection.
fn glass_fresnel(cosine: f32, eta: f32) -> f32 {
 let c=clamp(cosine,0.0,1.0);
 let sinSquared=eta*eta*(1.0-c*c);
 if(sinSquared>=1.0){return 1.0;}
 let t=sqrt(1.0-sinSquared);
 let s=(eta*c-t)/max(eta*c+t,0.00001);
 let p=(c-eta*t)/max(c+eta*t,0.00001);
 return (s*s+p*p)*0.5;
}
fn glass_radiance(ro: vec3f, rd: vec3f, hit: CrystalIntersection) -> vec3f {
 let p=ro+rd*hit.near;
 // One reference wavelength for the image of the room avoids three unrelated
 // RGB silhouettes at every reflected edge. The actual illuminating beam and
 // its caustic retain all sixteen dispersive paths from the compute pass.
 let index=crystal_index(550.0);
 let entryReflection=glass_fresnel(dot(-rd,hit.entry),1.0/index);
 var color=glass_environment(crystal_world(p),crystal_world(reflect(rd,hit.entry)))*entryReflection;
 var weight=1.0-entryReflection;
 var inside=refract(rd,hit.entry,1.0/index);
 var origin=p;
 // Follow the reflected continuation and collect each transmitted exit. The
 // energy cutoff normally ends the path after two or three interfaces.
 for(var bounce=0u;bounce<6u;bounce++) {
  // Resolve internal transport on the five optical faces. Re-projecting the
  // subpixel edge roll at every bounce creates an unstable lattice of glints;
  // the rounded surface is resolved only for the directly visible boundary.
  let next=crystal_intersect(origin+inside*0.0001,inside);
  let distance=next.far+0.0001;
  let exit=origin+inside*distance;
  color+=internal_light(crystal_world(origin),crystal_world(inside),distance)*weight;
  weight*=exp(-distance*0.045);
  let reflection=glass_fresnel(dot(inside,next.exit),index);
  if(reflection<1.0) {
   let outgoing=refract(inside,-next.exit,index);
   color+=through_scene(crystal_world(exit),crystal_world(outgoing))*(weight*(1.0-reflection));
  }
  weight*=reflection;
  if(weight<0.008){break;}
  inside=reflect(inside,next.exit);
  origin=exit;
 }
 // Approximate the unresolved reflection tail with low-frequency room light.
 // A finite bounce budget must not turn remaining energy into black facets.
 let direction=crystal_world(inside);
 color+=weight*mix(studio_background(direction),studio_room(direction),0.12);
 return color;
}
fn glass_sample(uv: vec2f) -> vec3f {
 let ray=studio_camera(uv,spektralFrame.resolution);
 let ro=crystal_local(ray.origin);let rd=crystal_local(ray.direction);
 let hit=crystal_surface_intersect(ro,rd);
 if(hit.far>max(hit.near,0.0)){return glass_radiance(ro,rd,hit);}
 let floorT=-ray.origin.y/ray.direction.y;
 return lit_floor(ray.origin+ray.direction*floorT,-ray.direction);
}
fn projector_hit(ro: vec3f, rd: vec3f) -> OpticalHit {
 let source=beamPaths[0].xyz;let axis=normalize(beamPaths[1].xyz-source);
 let q=ro-source;let axial=dot(q,axis);let velocity=dot(rd,axis);
 let radial=q-axis*axial;let radialDirection=rd-axis*velocity;
 let a=dot(radialDirection,radialDirection);let b=dot(radial,radialDirection);
 let discriminant=b*b-a*(dot(radial,radial)-0.0081);
 var hit=optical_miss();
 if(discriminant>=0.0 && a>0.00001) {
  let t=(-b-sqrt(discriminant))/a;let h=axial+velocity*t;
  if(t>0.0 && h> -0.32 && h<0.0){hit=OpticalHit(t,normalize(radial+radialDirection*t),3.0);}
 }
 if(abs(velocity)>0.00001){
  let t=-axial/velocity;let p=radial+radialDirection*t;
  if(t>0.0 && dot(p,p)<0.0081){hit=optical_nearest(hit,OpticalHit(t,axis,4.0));}
  // The projector is a closed machined housing, including its rear cap.
  let rear=(-.32-axial)/velocity;let back=radial+radialDirection*rear;
  if(rear>0.0 && dot(back,back)<.0081){hit=optical_nearest(hit,OpticalHit(rear,-axis,3.0));}
 }
 return hit;
}
fn frag(uv: vec2f) -> vec4f {
 let ray=studio_camera(uv,spektralFrame.resolution);
 let ro=crystal_local(ray.origin);let rd=crystal_local(ray.direction);
 let hit=crystal_surface_intersect(ro,rd);
 let floorT=-ray.origin.y/ray.direction.y;
 var limit=floorT;
 var color=lit_floor(ray.origin+ray.direction*floorT,-ray.direction);
 if(hit.far>max(hit.near,0.0)) {
  limit=hit.near;
  color=glass_radiance(ro,rd,hit);
 }
 // Filter only high-contrast glass boundaries, within one physical pixel.
 // Derivatives stay outside divergent control flow. Flat clear faces keep one
 // ray; no full-frame blur, temporal accumulation, or lower DPR is involved.
 let coverage=select(0.0,1.0,hit.far>max(hit.near,0.0));
 let boundary=fwidth(coverage);
 let change=fwidth(color);
 if((coverage>0.0 || boundary>0.0) && (boundary>0.0 || max(change.r,max(change.g,change.b))>0.035)) {
  let pixel=vec2f(0.25)/spektralFrame.resolution;
  color=(glass_sample(uv+pixel)+glass_sample(uv-pixel)
   +glass_sample(uv+vec2f(pixel.x,-pixel.y))+glass_sample(uv+vec2f(-pixel.x,pixel.y)))*0.25;
 }
 let axis=normalize(beamPaths[1].xyz-beamPaths[0].xyz);
 let support=beamPaths[0].xyz-axis*0.18;
 let supportOrigin=ray.origin-vec3f(support.x,0.0,support.z);
 let column=optical_cylinder(supportOrigin,ray.direction,0.025,0.035,support.y);
 let foot=optical_cylinder(supportOrigin,ray.direction,0.13,0.01,0.045);
 let projector=optical_nearest(projector_hit(ray.origin,ray.direction),optical_nearest(column,foot));
 if(projector.t<limit) {
  limit=projector.t;
  let p=ray.origin+ray.direction*limit;
  let axial=dot(p-beamPaths[0].xyz,axis);
  let collar=1.-smoothstep(.003,.006,abs(axial+.025));
  let metal=mix(vec3f(.035,.04,.048),vec3f(.13,.15,.17),collar);
  let contact=.65+.35*smoothstep(.01,.065,p.y);
  color=studio_surface(p,projector.normal,-ray.direction,metal,.85,.23,vec3f(1.),contact);
  if(projector.kind==4.0) {
   let radius=distance(p,beamPaths[0].xyz);
   if(radius<0.035){color=vec3f(5.0);}
   else if(radius<0.052){color=studio_surface(p,projector.normal,-ray.direction,vec3f(0.45),1.0,0.16,vec3f(1.0),1.0);}
  }
 }
 color+=external_light(ray.origin,ray.direction,limit);
 return vec4f(max(color,vec3f(0.0)),1.0);
}
