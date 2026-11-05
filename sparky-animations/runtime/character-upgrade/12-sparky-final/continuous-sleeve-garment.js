import{makeTwoPartArms as makeSkinParts,armDiagnostics as skinDiagnostics}from'./measured-arms.js?v=1';
import{makeConnectedSkin}from'./connected-arm-skin.js';
export const armDiagnostics={};
const SCALE=.0975,WIDTH=1659,HEIGHT=948;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const world=(x,y)=>[(x-829.5)*SCALE,194-(y-81)*SCALE];
const boundary=[[0,480],[145,480],[345,490],[385,493],[475,476],[550,455],[610,445],[710,425],[815,398],[948,380]];
const YROWS=[...new Set([...Array.from({length:61},(_,i)=>HEIGHT*i/60),...boundary.map(p=>p[0]),360,365,640])].sort((a,b)=>a-b);
function edge(y){for(let i=0;i<boundary.length-1;i++)if(y<=boundary[i+1][0]){const a=boundary[i],b=boundary[i+1];return a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0])}return boundary.at(-1)[1]}
function frame(a,b){const d=[b[0]-a[0],b[1]-a[1]],length=Math.hypot(...d)||1;return{a,u:d.map(v=>v/length),length}}
const REST={L:{S:[-32,177],E:[-53.5,143],oldS:[-28,177]},R:{S:[31,177],E:[52.8,143],oldS:[29,177]}};
function rigidCloth(q,side,current){const r=REST[side],rest=frame(r.S,r.E),d=[q[0]-r.S[0],q[1]-r.S[1]],s=d[0]*rest.u[0]+d[1]*rest.u[1],n=-d[0]*rest.u[1]+d[1]*rest.u[0],foreshorten=Math.min(1,current.length/rest.length);return[current.a[0]+current.u[0]*s*foreshorten-current.u[1]*n,current.a[1]+current.u[1]*s*foreshorten+current.u[0]*n]}

export function makeTwoPartArms(S,skinAtlas,seamRegion,garmentAtlas){
 const skin=makeSkinParts(S,skinAtlas,seamRegion),connectedSkin=makeConnectedSkin(S,skinAtlas);let context;
 function clothUV(x,y){
  const z=Math.min(x,WIDTH-x),f=context.frames[x<WIDTH/2?'L':'R'],dx=f.elbow[0]-f.goal[0],dy=f.elbow[1]-f.goal[1],lift=smooth(-.8,-.2,dy/(Math.hypot(dx,dy)||1));
  const band=lift*smooth(340,390,y)*(1-smooth(480,530,y))*smooth(450,465,z)*(1-smooth(500,515,z));
  return[x/WIDTH,(y+(330-y)*band)/HEIGHT];
 }
 function attachment(name,verts,uv,tri,alpha=1){const m=new S.MeshAttachment(name);m.region=garmentAtlas.findRegion('Shirt');m.regionUVs=new Float32Array(uv);m.updateRegion();m.vertices=verts;m.worldVerticesLength=verts.length;m.triangles=tri;m.color.set(1,1,1,alpha);return m}
 function sharedPoint(px,py){
  const q=world(px,py),base=context.shirtPoint(q),left=edge(py),t=(px-left)/(WIDTH-2*left),row=1-smooth(345,475,py),wl=(1-smooth(0,.28,t))*row,wr=smooth(.72,1,t)*row;
  const ls=context.shirtPoint(REST.L.oldS),rs=context.shirtPoint(REST.R.oldS),lf=context.frames.L,rf=context.frames.R;
  return[base[0]+(lf.goal[0]-ls[0])*wl+(rf.goal[0]-rs[0])*wr,base[1]+(lf.goal[1]-ls[1])*wl+(rf.goal[1]-rs[1])*wr];
 }
 function mesh(name,rows,nx,p,alpha=1){const verts=[],uv=[],tri=[];rows.forEach((y,j)=>{for(let i=0;i<=nx;i++){const v=p(i/nx,y);verts.push(...v.world);uv.push(...v.uv)}});for(let j=0;j<rows.length-1;j++)for(let i=0;i<nx;i++){const k=j*(nx+1)+i;tri.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2)}return attachment(name,verts,uv,tri,alpha)}
 function body(frames,shirtPoint){
  context={frames,shirtPoint};return mesh('UnifiedShirtBody',YROWS,40,(n,y)=>{const x=edge(y)+(WIDTH-2*edge(y))*n;return{world:sharedPoint(x,y),uv:clothUV(x,y)}});
 }
 function sample(f,side,shirtPoint){
  const pieces=skin.sample(f,side,shirtPoint),d={...skinDiagnostics[side]},oldRest=side==='L'?frame([-32,177],[-50.6319,150]):frame([31,177],[50.1484,150]),oldCurrent=frame(d.shoulder,d.elbow),rotation=Math.atan2(oldCurrent.u[1],oldCurrent.u[0])-Math.atan2(oldRest.u[1],oldRest.u[0]),offset=side==='L'?[-2.8681,-7]:[2.6516,-7];
  d.elbow=[d.elbow[0]+offset[0]*Math.cos(rotation)-offset[1]*Math.sin(rotation),d.elbow[1]+offset[0]*Math.sin(rotation)+offset[1]*Math.cos(rotation)];
  const lowerAxis=frame(d.elbow,d.wrist);d.forearmLean=Math.atan2(Math.abs(lowerAxis.u[0]),Math.abs(lowerAxis.u[1]))*180/Math.PI;
  const current=frame(d.shoulder,d.elbow),rows=YROWS.filter(y=>y<=640),r=REST[side];
  function sleevePoint(n,y){
   const underlap=y<=365?8*(1-smooth(345,365,y)):0,left=edge(y)+underlap,x0=100+(left-100)*n,x=side==='L'?x0:WIDTH-x0,q0=world(x,y),cuffFit=smooth(.45,.8,n)*smooth(365,540,y),q=[q0[0]+(side==='L'?1:-1)*6*cuffFit,q0[1]-2*cuffFit],arm=rigidCloth(q,side,current),shirt=sharedPoint(x,y),root=smooth(.94,.995,n)*(1-smooth(260,365,y));
   return{world:mix(arm,shirt,root),uv:clothUV(x,y)};
  }
  const sleeve=mesh('UnifiedSleeve_'+side,rows,28,(n,y)=>sleevePoint(n*(y<=365?.985:1),y));
  // The underarm follows the complete sleeve underside, all the way to the
  // inner cuff corner. Joining at y365 used the cropped armpit tip instead.
  const fixed=y=>sharedPoint(side==='L'?edge(y)+6:WIDTH-edge(y)-6,y);
  const cuffY=590,cuffX=380,innerN=(cuffX-100)/(edge(cuffY)-100);
  const low=fixed(385),tip=sleevePoint(innerN,cuffY).world;
  // The underside runs along the arm, as in the supplied filled outline.
  // Keep its torso endpoint inside the shirt when the sleeve lifts.
  if(Math.abs(current.u[0])>.2){
   const aligned=tip[1]+(low[0]-tip[0])*current.u[1]/current.u[0];
   const min=fixed(475)[1],max=fixed(260)[1],w=smooth(-.7,-.1,current.u[1]);
   low[1]+=(Math.max(min,Math.min(max,aligned))-low[1])*w;
  }
  const joinRows=Array.from({length:29},(_,i)=>145+(cuffY-145)*i/28);
  const rootFade=mesh('ContinuousUnderarm_'+side,joinRows,28,(n,y)=>{
   const t=(y-145)/(cuffY-145),top=mix(fixed(145),sleevePoint(.975,145).world,n);
   // A shallow, continuous underside replaces the deep triangular cutout.
   // Both endpoints sit inside their respective opaque surfaces.
   const bottom=mix(low,tip,n);
   const x=side==='L'?edge(y)+24:WIDTH-edge(y)-24;
   return{world:mix(top,bottom,t),uv:clothUV(x,y)};
  });
  const skinParts=connectedSkin.sample(d,f,side);
  const cuff=mesh('UnifiedCuff_'+side,rows.filter(y=>y>=360),28,sleevePoint);
  const seams=Array.from({length:21},(_,i)=>{const y=145+200*i/20;return sharedPoint(side==='L'?edge(y):WIDTH-edge(y),y)});
  armDiagnostics[side]={...d,seam:seams,sleeveLengthScale:Math.min(1,current.length/frame(r.S,r.E).length)};
  const fades=Array(7).fill(null);fades[0]=rootFade;
  return{joints:d,upper:sleeve,upperSkin:skinParts.upper,lower:skinParts.lower,upperFade:fades,wristFade:Array(3).fill(null),cuff,seam:null};
 }
 return{body,sample};
}
