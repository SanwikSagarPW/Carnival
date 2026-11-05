import{limbFields}from'./motion-fit-field.js?v=1';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
// Fixed artwork registration: opaque silhouette width 94, height 45.5 rig units.
// Top extends underneath shirt; no animation-dependent resizing.
export function makeShorts(S,atlas){
 const points=[],uv=[],tri=[],NX=64,NY=36;
 for(let j=0;j<=NY;j++)for(let i=0;i<=NX;i++){
  const px=1915*i/NX,py=821*j/NY;
  const x=(px-958)*94/1472,fitX=x*(.55+.45*smooth(5,23,Math.abs(x)));
  points.push([fitX,124.5-(py-49)*45.5/716]);uv.push(i/NX,j/NY);
 }
 for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){const k=j*(NX+1)+i;tri.push(k,k+NX+1,k+1,k+1,k+NX+1,k+NX+2)}
 const probe=new S.MeshAttachment('ShortsRedraw');probe.region=atlas.findRegion('Shorts');probe.regionUVs=new Float32Array(uv);probe.updateRegion();
 return function sample(fitted,sk){
  const limbPoint=limbFields(fitted,sk),bindPoint=limbFields(fitted,fitted.bind),verts=[];
  for(const p of points){const waist=fitted.bodyPoint(p,sk),side=smooth(7,-7,p[0]);
   // Keep the waistband and fly on the pelvis. Let each thigh take over at
   // its own leg opening, with a lower transition through the centre gusset.
   // Previously the full upper centre was pulled by both thighs at y=111,
   // folding the waistband into a sharp V during a raised-leg pose.
   const outer=smooth(3,22,Math.abs(p[0])),w=smooth(118,100,p[1])*outer+smooth(98,81,p[1])*(1-outer);
   const leg=s=>{const now=limbPoint(p,'leg',s,'upper'),rest=bindPoint(p,'leg',s,'upper'),zero=fitted.bodyPoint(rest,sk);return now.map((v,i)=>v+waist[i]-zero[i])};
   const thigh=mix(leg('R'),leg('L'),side);verts.push(...mix(waist,thigh,w));}
  const m=new S.MeshAttachment('ShortsRedraw');m.region=probe.region;m.regionUVs=probe.regionUVs;m.uvs=probe.uvs;m.vertices=verts;m.worldVerticesLength=verts.length;m.triangles=tri;m.color.set(1,1,1,1);return m;
 }
}
