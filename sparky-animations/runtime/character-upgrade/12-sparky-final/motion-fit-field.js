import{limbFields as legacyFields,LEG_SHIFT}from'./limb-field.js?v=fit-1';
export{LEG_SHIFT};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const REST={L:[[-27,106],[-28,74],[-32,55]],R:[[26,106],[28,74],[32,55]]};
const dist=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
function mapSegment(p,a,b,c,d){
 const len=dist(a,b),u=[(b[0]-a[0])/len,(b[1]-a[1])/len],out=dist(c,d),v=[(d[0]-c[0])/out,(d[1]-c[1])/out];
 const x=p[0]-a[0],y=p[1]-a[1],s=x*u[0]+y*u[1],n=-x*u[1]+y*u[0];
 return[c[0]+s*out/len*v[0]-n*v[1],c[1]+s*out/len*v[1]+n*v[0]];
}
export function limbFields(fitted,sk){
 const old=legacyFields(fitted,sk),cache=new Map();
 return function deform(p,kind,side,section=null){
  if(kind!=='leg')return old(p,kind,side,section);
  if(!cache.has(side)){
   const rest=REST[side],names=side==='L'?['Leg_R','Leg_R2','Foots/Foot_R']:['Leg_R3','Leg_R4','Foots/Foot_R2'];
   const source=names.map(n=>sk.findBone(n)),bind=names.map(n=>fitted.bind.findBone(n));
   const hip=fitted.bodyPoint([rest[0][0]+LEG_SHIFT[side],rest[0][1]],sk);
   // Retarget the authored thigh and shin independently. The previous ankle-only
   // IK reconstruction discarded Lucas's upper-leg pose and guessed the knee.
   const direction=i=>{
    const angle=Math.atan2(source[i+1].worldY-source[i].worldY,source[i+1].worldX-source[i].worldX)-Math.atan2(bind[i+1].worldY-bind[i].worldY,bind[i+1].worldX-bind[i].worldX);
    // Lucas keys projected segment length when a leg comes toward the
    // camera (notably front running). Carry that depth cue through both the
    // shorts and skin, while keeping cross-section widths and shoes fixed.
    const projected=Math.max(.6,Math.min(1.08,Math.hypot(source[i+1].worldX-source[i].worldX,source[i+1].worldY-source[i].worldY)/Math.hypot(bind[i+1].worldX-bind[i].worldX,bind[i+1].worldY-bind[i].worldY)));
    const x=(rest[i+1][0]-rest[i][0])*projected,y=(rest[i+1][1]-rest[i][1])*projected;
    return[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)];
   };
   const upper=direction(0),lower=direction(1),knee=hip.map((x,i)=>x+upper[i]),ankle=knee.map((x,i)=>x+lower[i]);
   cache.set(side,{rest,current:[hip,knee,ankle]});
  }
  const{rest:r,current:c}=cache.get(side),upper=()=>mapSegment(p,r[0],r[1],c[0],c[1]),lower=()=>mapSegment(p,r[1],r[2],c[1],c[2]);
  if(section==='upper')return upper();if(section==='lower')return lower();
  // Sweep cross-sections through a rounded knee centerline. Position blending
  // of complete limb meshes can pinch one edge and bulge the opposite edge.
  const joint=(chain,y)=>{
   const line=(a,b,yy)=>{const t=(yy-a[1])/(b[1]-a[1]);return mix(a,b,t)};
   const ra=line(r[0],r[1],78),rb=line(r[1],r[2],70);
   if(y>=78){const t=(y-r[0][1])/(r[1][1]-r[0][1]);return{p:mix(chain[0],chain[1],t),d:[chain[1][0]-chain[0][0],chain[1][1]-chain[0][1]]}}
   if(y<=70){const t=(y-r[1][1])/(r[2][1]-r[1][1]);return{p:mix(chain[1],chain[2],t),d:[chain[2][0]-chain[1][0],chain[2][1]-chain[1][1]]}}
   const a=mapSegment(ra,r[0],r[1],chain[0],chain[1]),b=mapSegment(rb,r[1],r[2],chain[1],chain[2]),k=chain[1],t=(78-y)/8;
   return{p:a.map((v,i)=>(1-t)*(1-t)*v+2*t*(1-t)*k[i]+t*t*b[i]),d:a.map((v,i)=>2*((1-t)*(k[i]-v)+t*(b[i]-k[i])))};
  };
  const bind=joint(r,p[1]),live=joint(c,p[1]),rb=Math.hypot(...bind.d),rl=Math.hypot(...live.d),n=[-bind.d[1]/rb,bind.d[0]/rb],offset=(p[0]-bind.p[0])*n[0]+(p[1]-bind.p[1])*n[1];
  return[live.p[0]-live.d[1]/rl*offset,live.p[1]+live.d[0]/rl*offset];
 }
}
