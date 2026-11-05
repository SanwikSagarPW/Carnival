import{BLUE_ROWS,SKIN_ROWS}from'./measured-arm-source.js';

export const armDiagnostics={};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const smooth=(a,b,x)=>{let t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const rig=([x,y])=>[x-118,403-y];
const REF={
 L:{S:rig([86,226]),E:rig([67.3681,253]),W:rig([56.7967,279]),width:18.5271,
  outer:[[85,214],[76,221],[66,233],[56,244],[51,247]].map(rig),
  seam:[[94,214],[90,222],[88,234],[86,245],[84,252]].map(rig),hem:rig([82,258]),
  oldS:[-28,177],oldE:[-43.9,149.9],oldW:[-58,124]},
 R:{S:rig([149,226]),E:rig([168.1484,253]),W:rig([178.0912,279]),width:18.6806,
  outer:[[150,214],[159,221],[169,233],[179,244],[185,247]].map(rig),
  seam:[[141,214],[145,222],[147,234],[149,245],[151,252]].map(rig),hem:rig([153,258]),
  oldS:[29,177],oldE:[45.1,150],oldW:[59,124]},
};
function curve(points,t){const s=Math.max(0,Math.min(1,t))*(points.length-1),i=Math.min(points.length-2,Math.floor(s));return mix(points[i],points[i+1],s-i)}
function row(table,y){for(let i=0;i<table.length-1;i++)if(y<=table[i+1][0]){const a=table[i],b=table[i+1];return mix(a.slice(1),b.slice(1),Math.max(0,(y-a[0])/(b[0]-a[0])))}return table.at(-1).slice(1)}
function rotation(p,a){return[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)]}
function frame(a,b){const d=[b[0]-a[0],b[1]-a[1]],length=Math.hypot(...d)||1;return{a,u:d.map(v=>v/length),length}}
function bonePoint(q,rest,current){const d=[q[0]-rest.a[0],q[1]-rest.a[1]],along=d[0]*rest.u[0]+d[1]*rest.u[1],cross=-d[0]*rest.u[1]+d[1]*rest.u[0];return[current.a[0]+current.u[0]*along*Math.min(1,current.length/rest.length)-current.u[1]*cross,current.a[1]+current.u[1]*along*Math.min(1,current.length/rest.length)+current.u[0]*cross]}

export function makeTwoPartArms(S,atlas,seamRegion){
 function mesh(name,region,verts,uv,tri,alpha=1,tint=[1,1,1]){
  const m=new S.MeshAttachment(name);m.region=region==='Seam'?seamRegion:atlas.findRegion(region);m.regionUVs=new Float32Array(uv);m.updateRegion();m.vertices=verts;m.worldVerticesLength=verts.length;m.triangles=tri;m.color.set(...tint,alpha);
  // Float vertex colours can brighten the blue without changing the white band.
  // The source flat blue is G≈131; the accepted shirt patch is G≈144.
  if(region==='UpperArm'&&name.startsWith('Sleeve'))m.color.g=144/131;
  return m;
 }
 function grid(name,region,nx,ny,point,alpha=1,tint){
  const verts=[],uv=[],tri=[];for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const p=point(i/nx,j/ny);verts.push(...p.world);uv.push(...p.uv)}
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*(nx+1)+i;tri.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2)}
  return mesh(name,region,verts,uv,tri,alpha,tint);
 }
 function sample(f,side,shirtPoint){
  const r=REF[side],oldUpper=frame(r.oldS,r.oldE),motionUpper=frame(f.goal,f.elbow),deltaAngle=Math.atan2(motionUpper.u[1],motionUpper.u[0])-Math.atan2(oldUpper.u[1],oldUpper.u[0]);
  const ss=shirtPoint(r.S),os=shirtPoint(r.oldS),S0=[f.goal[0]+ss[0]-os[0],f.goal[1]+ss[1]-os[1]];
  const de=rotation([r.E[0]-r.oldE[0],r.E[1]-r.oldE[1]],deltaAngle),E=[f.elbow[0]+de[0],f.elbow[1]+de[1]];
  const handAngle=(f.hand.getWorldRotationX()-f.hb.getWorldRotationX())*Math.PI/180,dw=rotation([r.W[0]-r.oldW[0],r.W[1]-r.oldW[1]],handAngle),W=[f.wrist[0]+dw[0],f.wrist[1]+dw[1]];
  const restUpper=frame(r.S,r.E),upperFrame=frame(S0,E),lowerFrame=frame(E,W),mirror=side==='L'?1:-1;
  // The cuff rows follow the traced hem, not the lengthwise parameter of
  // the armhole. This keeps the white band parallel to the reference opening.
  const outerTop=side==='L'?[[85,214],[76,221],[66,230],[57.82,237.12]]:[[150,214],[159,221],[169,230],[178.18,237.12]];
  const innerTop=side==='L'?[[94,214],[90,222],[88,234],[86,245],[85,249]]:[[141,214],[145,222],[147,234],[149,245],[150,249]];
  const outerHem=side==='L'?[51,247]:[185,247],innerHem=side==='L'?[82,258]:[153,258],dir=side==='L'?1:-1;
  const outerRest=y=>y<=600?rig(curve(outerTop,(y-150)/450)):rig([outerHem[0]+dir*.568*12*(810-y)/210,outerHem[1]-.823*12*(810-y)/210]);
  const innerRest=y=>y<=600?rig(curve(innerTop,(y-150)/450)):rig([innerHem[0]+dir*.25*12*(810-y)/210,innerHem[1]-.75*12*(810-y)/210]);
  const sleevePoint=(n,t)=>{
   const y=150+660*t,q=mix(outerRest(y),innerRest(y),n),arm=bonePoint(q,restUpper,upperFrame),shirt=shirtPoint(q),seamWeight=y<=350?1:1-smooth(350,500,y),w=Math.max(n**4*seamWeight,1-smooth(0,.12,t));
   return mix(arm,shirt,w);
  };
  const sleeve=(name,a,b,n0=0,n1=.94,alpha=1)=>grid(name,'UpperArm',16,Math.max(3,Math.ceil((b-a)*36)),(u,v)=>{
   const n=n0+(n1-n0)*u,t=a+(b-a)*v,y=150+660*t,[x0,x1]=row(BLUE_ROWS,y);return{world:sleevePoint(n,t),uv:[(x0+(x1-x0)*n)/1024,y/1536]};
  },alpha);
  const upper=sleeve('SleeveMain_'+side,0,1);
  // Only the last 6% of cloth width is feathered; it lies under the sewn line.
  const upperFade=[[.94,.96,.9],[.96,.98,.6],[.98,1,.25]].map(([a,b,v],i)=>sleeve('SleeveJoin_'+side+'_'+i,0,1,a,b,v));
  while(upperFade.length<7)upperFade.push(null);
  const skin=(name,y0,y1,alpha=1)=>grid(name,'UpperArm',10,10,(n,t)=>{
   const y=y0+(y1-y0)*t,[x0,x1]=row(SKIN_ROWS,y),x=x0+(x1-x0)*n,cross=(x-512)*r.width/320*mirror,along=(y-830)*3/550;
   return{world:[E[0]+upperFrame.u[0]*along-upperFrame.u[1]*cross,E[1]+upperFrame.u[1]*along+upperFrame.u[0]*cross],uv:[x/1024,y/1536]};
  },alpha,[1,193/215,1]);
  const upperSkin=skin('UpperSkin_'+side,830,1300,.8);
  upperFade[3]=skin('UpperElbowJoin_'+side,1300,1340,.5);upperFade[4]=skin('UpperElbowJoinEnd_'+side,1340,1380,.15);
  const lower=(name,y0,y1,alpha=1)=>grid(name,'Forearm',12,Math.max(3,Math.ceil((y1-y0)/24)),(n,t)=>{
   const y=y0+(y1-y0)*t,x=500+255*n,cross=(x-628)*r.width/211*mirror,s=y<280?(y-280)*9/95:y<=980?(y-280)*lowerFrame.length/700:lowerFrame.length+(y-980)*3/92;
   return{world:[E[0]+lowerFrame.u[0]*s-lowerFrame.u[1]*cross,E[1]+lowerFrame.u[1]*s+lowerFrame.u[0]*cross],uv:[x/1254,y/1254]};
  },alpha);
  const forearm=lower('Forearm_'+side,175,1000),wristFade=[[1000,1025,.85],[1025,1050,.5],[1050,1080,.15]].map(([a,b,v],i)=>lower('WristJoin_'+side+'_'+i,a,b,v));
  const cuff=sleeve('SleeveCuff_'+side,(600-150)/660,1);
  const seamPoints=Array.from({length:33},(_,i)=>shirtPoint(innerRest(150+(350-150)*i/32))),sv=[],su=[],st=[];
  for(let i=0;i<seamPoints.length;i++){const prev=seamPoints[Math.max(0,i-1)],next=seamPoints[Math.min(32,i+1)],f0=frame(prev,next),p=seamPoints[i];for(const sign of [-1,1]){sv.push(p[0]-f0.u[1]*.35*sign,p[1]+f0.u[0]*.35*sign);su.push(.5,.5)}if(i<32){const k=i*2;st.push(k,k+1,k+2,k+2,k+1,k+3)}}
  const seam=mesh('ArmholeSeam_'+side,'Seam',sv,su,st,.65,[.035,.13,.3]);
  armDiagnostics[side]={shoulder:S0,elbow:E,wrist:W,bend:Math.acos(Math.max(-1,Math.min(1,upperFrame.u[0]*lowerFrame.u[0]+upperFrame.u[1]*lowerFrame.u[1])))*180/Math.PI,sleeveLengthScale:Math.min(1,upperFrame.length/restUpper.length),forearmLean:Math.atan2(Math.abs(lowerFrame.u[0]),Math.abs(lowerFrame.u[1]))*180/Math.PI,width:r.width,seam:seamPoints};
  return{upper,upperSkin,lower:forearm,upperFade,wristFade,cuff,seam};
 }
 return{sample};
}
