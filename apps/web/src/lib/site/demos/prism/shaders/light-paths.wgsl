// Five vec4 records per wavelength: source, entry, exit, floor hit, spectrum.
@compute @workgroup_size(16)
fn compute(@builtin(global_invocation_id) id: vec3u) {
 if(id.x>=16u){return;}
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
}
