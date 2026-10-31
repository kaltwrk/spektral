@compute @workgroup_size(8, 8)
fn compute(@builtin(global_invocation_id) id: vec3u) {
 let size=textureDimensions(causticMap);
 if(any(id.xy>=size)){return;}
 let p=(vec2f(id.xy)+vec2f(0.5))/vec2f(size)*6.8-vec2f(3.4);
 var color=vec3f(0.0);
 for(var i=0u;i<16u;i++) {
  let offset=i*5u;
  let exit=beamPaths[offset+2u].xyz;let end=beamPaths[offset+3u].xyz;
  let direction=normalize(end-exit);let axis=normalize(direction.xz);
  let q=p-end.xz;
  let across=dot(q,vec2f(-axis.y,axis.x))/0.032;
  let along=dot(q,axis)*max(abs(direction.y),0.1)/0.032;
  let density=across*across+along*along;
  color+=beamPaths[offset+4u].rgb*(exp(-density)*2.5+exp(-density*0.07)*0.065);
 }
 textureStore(causticMap,vec2i(id.xy),vec4f(color,1.0));
}
