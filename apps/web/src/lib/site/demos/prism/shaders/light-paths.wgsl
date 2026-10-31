// A single workgroup writes five records per wavelength and four beam bounds.
@compute @workgroup_size(16)
fn compute(@builtin(global_invocation_id) id: vec3u) {
 let wavelength=400.0+f32(id.x)*20.0;
 let index=crystal_index(wavelength);
 let entry=crystal_entry();let incident=crystal_incident();
 let normal=vec3f(0.0,0.5,0.8660254);
 let inside=refract(incident,normal,1.0/index);
 let hit=crystal_intersect(entry+inside*0.0001,inside);
 let exit=entry+inside*(hit.far+0.0001);
 let outgoing=refract(inside,-hit.exit,index);
 let end=exit+outgoing*(-exit.y/min(outgoing.y,-0.001));
 let offset=id.x*5u;
 // Keep the emitter close enough for the shared studio framing.
 beamPaths[offset]=vec4f(crystal_world(entry-incident*0.85),1.0);
 beamPaths[offset+1u]=vec4f(crystal_world(entry),1.0);
 beamPaths[offset+2u]=vec4f(crystal_world(exit),1.0);
 beamPaths[offset+3u]=vec4f(crystal_world(end),1.0);
 beamPaths[offset+4u]=vec4f(crystal_spectrum(wavelength),index);
 storageBarrier();
 if(id.x==0u) {
  var innerMin=vec3f(10000.0);var innerMax=vec3f(-10000.0);
  var outerMin=vec3f(10000.0);var outerMax=vec3f(-10000.0);
  for(var i=0u;i<16u;i++) {
   let start=beamPaths[i*5u+1u].xyz;
   let finish=beamPaths[i*5u+2u].xyz;
   let floor=beamPaths[i*5u+3u].xyz;
   innerMin=min(innerMin,min(start,finish));innerMax=max(innerMax,max(start,finish));
   outerMin=min(outerMin,min(finish,floor));outerMax=max(outerMax,max(finish,floor));
  }
  // More than six core radii retain the visible Gaussian halo.
  beamPaths[80]=vec4f(innerMin-vec3f(0.12),0.0);
  beamPaths[81]=vec4f(innerMax+vec3f(0.12),0.0);
  beamPaths[82]=vec4f(outerMin-vec3f(0.14),0.0);
  beamPaths[83]=vec4f(outerMax+vec3f(0.14),0.0);
 }
}
