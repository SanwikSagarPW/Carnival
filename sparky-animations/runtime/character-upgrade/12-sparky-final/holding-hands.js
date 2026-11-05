// The holding palms are torso-parented prop layers in the source rig. They
// need their own wrist contract rather than the hidden normal palm controls.
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
export function holdingHands(S,fitted,native){
 const fronts=['Hold_front','Hold_front2'].map(name=>native.findSlot(name));
 if(fronts.some(slot=>!slot?.getAttachment()||slot.color.a<.1||slot.getAttachment().path!=='Palms/Hold_front'))return null;
 const points=fronts.map(slot=>{const a=slot.getAttachment(),v=[];if(!(a instanceof S.RegionAttachment))return null;a.computeWorldVertices(slot,v,0,2);return Array.from({length:4},(_,i)=>fitted.fitPoint(v.slice(i*2,i*2+2),'torso',native))});
 if(points.some(p=>!p))return null;
 const centre=[0,1].map(axis=>points.flat().reduce((sum,p)=>sum+p[axis],0)/8),GAIN=1.5;
 const map=p=>p.map((x,i)=>centre[i]+(x-centre[i])*GAIN);
 const frames=new Map(),wrists=new Map();
 for(const [index,side]of ['L','R'].entries()){
  // Fixed landmark inside the opaque palm base, with enough overlap to cover
  // the round forearm cap. Both front and back palm layers share one fit.
  const p=points[index],u=.30,v=.35,wrist=map(mix(mix(p[1],p[2],u),mix(p[0],p[3],u),v));wrists.set(side,wrist);
  const f=fitted.armFrame(native,side),angle=(f.hand.getWorldRotationX()-f.hb.getWorldRotationX())*Math.PI/180,offset=side==='L'?[-3.2033,0]:[1.0912,0];
  const target=[wrist[0]-offset[0]*Math.cos(angle),wrist[1]-offset[0]*Math.sin(angle)],dx=target[0]-f.goal[0],dy=target[1]-f.goal[1],distance=Math.hypot(dx,dy)||1,ux=dx/distance,uy=dy/distance,A=33,B=31,d=Math.max(2.001,Math.min(63.999,distance)),along=(A*A-B*B+d*d)/(2*d),height=Math.sqrt(Math.max(0,A*A-along*along));
  const candidates=[-1,1].map(sign=>[f.goal[0]+ux*along-uy*height*sign,f.goal[1]+uy*along+ux*height*sign]),dir=side==='L'?-1:1,elbow=candidates.reduce((a,b)=>dir*a[0]>dir*b[0]?a:b);
  frames.set(side,{...f,wrist:target,elbow});
 }
 return{map,frames,wrists};
}
