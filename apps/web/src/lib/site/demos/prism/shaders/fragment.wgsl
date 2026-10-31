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
fn external_light(ro: vec3f, rd: vec3f, limit: f32) -> vec3f {
 var color=vec3f(light_segment(ro,rd,beamPaths[0].xyz,beamPaths[1].xyz,limit,0.012))*3.0;
 for(var i=0u;i<16u;i++) {
  let offset=i*5u;
  color+=beamPaths[offset+4u].rgb*light_segment(ro,rd,beamPaths[offset+2u].xyz,beamPaths[offset+3u].xyz,limit,0.014)*0.65;
 }
 return color;
}
fn internal_light(ro: vec3f, rd: vec3f, limit: f32) -> vec3f {
 var color=vec3f(0.0);
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
fn through_scene(origin: vec3f, direction: vec3f) -> vec3f {
 if(direction.y < -0.001) {
  let distance=-origin.y/direction.y;
  return lit_floor(origin+direction*distance,-direction)+external_light(origin,direction,distance);
 }
 return studio_environment(origin,direction,0.025)+external_light(origin,direction,8.0);
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
 }
 return hit;
}
fn frag(uv: vec2f) -> vec4f {
 let ray=studio_camera(uv,spektralFrame.resolution);
 let ro=crystal_local(ray.origin);let rd=crystal_local(ray.direction);
 let hit=crystal_intersect(ro,rd);
 let floorT=-ray.origin.y/ray.direction.y;
 var limit=floorT;
 var color=lit_floor(ray.origin+ray.direction*floorT,-ray.direction);
 if(hit.far>max(hit.near,0.0)) {
  limit=hit.near;
  let p=ro+rd*hit.near;let n=crystal_world(hit.entry);
  var transmitted=vec3f(0.0);
  let wavelengths=vec3f(650.0,550.0,450.0);
  for(var channel=0u;channel<3u;channel++) {
   let index=crystal_index(wavelengths[channel]);
   var inside=refract(rd,hit.entry,1.0/index);var origin=p;
   var attenuation=1.0;
   // Handle total internal reflection instead of treating the interior as sky.
   for(var bounce=0u;bounce<6u;bounce++) {
    let next=crystal_intersect(origin+inside*0.0001,inside);
    let distance=next.far+0.0001;let exit=origin+inside*distance;
    transmitted[channel]+=internal_light(crystal_world(origin),crystal_world(inside),distance)[channel]*attenuation;
    attenuation*=exp(-distance*0.045);
    let outgoing=refract(inside,-next.exit,index);
    if(dot(outgoing,outgoing)>0.01) {
     transmitted[channel]+=through_scene(crystal_world(exit),crystal_world(outgoing))[channel]*attenuation;
     break;
    }
    inside=reflect(inside,next.exit);origin=exit;
   }
  }
  let fresnel=studio_fresnel(vec3f(0.043),dot(n,-ray.direction));
  let reflected=studio_environment(crystal_world(p),reflect(ray.direction,n),0.018);
  color=transmitted*(1.0-fresnel)+reflected*fresnel;
  var edge=100.0;
  for(var i=0u;i<PLANE_COUNT;i++){if(dot(PLANES[i].xyz,hit.entry)<0.99){edge=min(edge,abs(dot(p,PLANES[i].xyz)-PLANES[i].w));}}
  color+=vec3f(0.6,0.72,0.85)*exp(-edge*300.0)*0.42;
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
  color=studio_surface(p,projector.normal,-ray.direction,vec3f(0.035,0.04,0.048),0.85,0.23,vec3f(1.0),1.0);
  if(projector.kind==4.0) {
   let radius=distance(p,beamPaths[0].xyz);
   if(radius<0.035){color=vec3f(5.0);}
   else if(radius<0.052){color=studio_surface(p,projector.normal,-ray.direction,vec3f(0.45),1.0,0.16,vec3f(1.0),1.0);}
  }
 }
 color+=external_light(ray.origin,ray.direction,limit);
 return vec4f(max(color,vec3f(0.0)),1.0);
}
