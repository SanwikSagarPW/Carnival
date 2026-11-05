// Shared cross-section-preserving fields for skin and garments. Native Lucas
// joint positions drive motion; both sides of every sleeve use this same field.
const pos=b=>[b.worldX,b.worldY];
export const LEG_SHIFT={L:4.5,R:-4.5};
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function segment(p,a,b,c,d){
 const ux=b[0]-a[0],uy=b[1]-a[1],len=Math.hypot(ux,uy),vx=d[0]-c[0],vy=d[1]-c[1],outLen=Math.hypot(vx,vy);
 const t=((p[0]-a[0])*ux+(p[1]-a[1])*uy)/(len*len),n=((p[0]-a[0])*-uy+(p[1]-a[1])*ux)/len;
 return[c[0]+t*vx-n*vy/outLen,c[1]+t*vy+n*vx/outLen];
}
function bent(p,rest,current){
 const[a,e,b]=rest,[c,f,d]=current,dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
 const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den,k=((e[0]-a[0])*dx+(e[1]-a[1])*dy)/den;
 let w=Math.max(0,Math.min(1,(t-k+.14)/.28));w=w*w*(3-2*w);
 const p1=segment(p,a,e,c,f),p2=segment(p,e,b,f,d);
 if(w<=0||w>=1)return w<=0?p1:p2;
 // Blend around the current joint centre in angle space rather than position
 // space, so acute elbow/knee bends stay round instead of collapsing to a wedge.
 const x1=p1[0]-f[0],y1=p1[1]-f[1],x2=p2[0]-f[0],y2=p2[1]-f[1],r1=Math.hypot(x1,y1),r2=Math.hypot(x2,y2);
 if(r1<1e-6||r2<1e-6)return mix(p1,p2,w);
 let a1=Math.atan2(y1,x1),da=Math.atan2(y2,x2)-a1;if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;
 const ang=a1+da*w,r=r1+(r2-r1)*w;
 return[f[0]+r*Math.cos(ang),f[1]+r*Math.sin(ang)];
}
export function limbFields(fitted,sk){
 const cache=new Map();
 return function deform(p,kind,side,section=null){
  const key=kind+side;
  if(!cache.has(key)){
   const isArm=kind==='arm',frame=isArm?fitted.armFrame(sk,side):null;
   const names=isArm?(frame.normal?(side==='L'?['Hand_L3','Hand_L4','Palm_R']:['Hand_L5','Hand_L6','Palm_R2']):(side==='L'?['Hand_Sep_3','Hand_Sep_4','Hand_Sep_Palm_R_No_Scale']:['Hand_Sep_1','Hand_Sep_2','Hand_Sep_Palm_No_Scale'])):(side==='L'?['Leg_R','Leg_R2','Foots/Foot_R']:['Leg_R3','Leg_R4','Foots/Foot_R2']);
   // Folded controls have their own neutral cage. Do not read normal-arm angles
   // when the native animation switches to separated forearm attachments.
   const restNames=isArm?(side==='L'?['Hand_L3','Hand_L4','Palm_R']:['Hand_L5','Hand_L6','Palm_R2']):names;
   const rest=restNames.map(n=>fitted.fitPoint(pos(fitted.bind.findBone(n)),kind+side,fitted.bind));
   const current=names.map(n=>fitted.fitPoint(pos(sk.findBone(n)),kind+side,sk));
   // Reference legs stand 4.5 units closer together than the Lucas hip spacing.
   if(!isArm)for(const q of current)q[0]+=LEG_SHIFT[side];
   if(isArm){rest[0]=side==='L'?[-28,177]:[29,177];rest[1]=fitted.armFrame(fitted.bind,side).elbow.slice();rest[2]=side==='L'?[-58,124]:[59,124];current[0]=frame.goal;current[1]=frame.elbow;current[2]=frame.wrist}
   cache.set(key,{rest,current});
  }
  const f=cache.get(key);if(section==='upper')return segment(p,f.rest[0],f.rest[1],f.current[0],f.current[1]);if(section==='lower')return segment(p,f.rest[1],f.rest[2],f.current[1],f.current[2]);return bent(p,f.rest,f.current);
 }
}
