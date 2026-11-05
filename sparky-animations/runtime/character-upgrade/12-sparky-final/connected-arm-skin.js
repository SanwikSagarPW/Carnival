// Complete upper-arm and forearm surfaces. Rounded overlap is geometry,
// not an atlas crop, so changing draw order never exposes a rectangular cut.
export function makeConnectedSkin(S,atlas){
 function capsule(name,a,b,r0,r1,side){
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,u=[dx/len,dy/len],mirror=side==='L'?1:-1;
  const rings=[];
  for(let i=0;i<=12;i++){const t=-Math.PI/2+i*Math.PI/24;rings.push({s:r0*Math.sin(t),radius:Math.max(.001,r0*Math.cos(t))})}
  for(let i=1;i<=24;i++){const t=i/24;rings.push({s:len*t,radius:r0+(r1-r0)*t})}
  for(let i=1;i<=12;i++){const t=i*Math.PI/24;rings.push({s:len+r1*Math.sin(t),radius:Math.max(.001,r1*Math.cos(t))})}
  const verts=[],uv=[],tris=[],N=10;
  for(const {s,radius}of rings)for(let j=0;j<=N;j++){
   const t=j/N,n=(2*t-1)*radius,shade=Math.max(0,Math.min(1,s/8));
   verts.push(a[0]+u[0]*s-u[1]*n,a[1]+u[1]*s+u[0]*n);
   // Sample the straight middle of the approved forearm texture. Its cap
   // transparency never clips the mesh, and shade direction stays mirrored.
   uv.push((name.startsWith('ConnectedUpperArm')?610:628+(t-.5)*204*mirror*Math.min(1,radius/r0)*shade)/1254,600/1254);
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<N;j++){const k=i*(N+1)+j;tris.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2)}
  const m=new S.MeshAttachment(name);m.region=atlas.findRegion('Forearm');m.regionUVs=new Float32Array(uv);m.updateRegion();m.vertices=verts;m.worldVerticesLength=verts.length;m.triangles=tris;m.color.set(1,1,1,1);return m;
 }
 function sample(d,f,side){
  // The reference arm fills about 60% of the sleeve opening. Upper skin
  // continues from shoulder to elbow behind cloth rather than starting at E.
  const S0=d.shoulder,E=d.elbow,W=d.wrist;
  const lengthUpper=Math.hypot(E[0]-S0[0],E[1]-S0[1])||1,start=[S0[0]+(E[0]-S0[0])*26/lengthUpper,S0[1]+(E[1]-S0[1])*26/lengthUpper];
  const lowerFrame={dx:W[0]-E[0],dy:W[1]-E[1]},length=Math.hypot(lowerFrame.dx,lowerFrame.dy)||1;
  // Wrist continuation stays underneath the glove cuff; rounded caps avoid
  // the exposed flat wrist strips seen in the preceding candidate.
  const wrist=[W[0]+lowerFrame.dx/length*1.5,W[1]+lowerFrame.dy/length*1.5];
  return{upper:capsule('ConnectedUpperArm_'+side,start,E,10.3,9.8,side),lower:capsule('ConnectedForearm_'+side,E,wrist,9.8,9.4,side)};
 }
 return{sample};
}
