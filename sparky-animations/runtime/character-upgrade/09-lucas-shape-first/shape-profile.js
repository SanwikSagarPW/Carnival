const R=Math.PI/180;
export const FIT={head:{source:[-390,705,390,1532],target:[-118,192,118,403]},torso:{source:[-241,343,243,750],target:[-46,110,46,191]},waist:{source:[-223,268,224,456],target:[-53,72,53,120]},neck:{source:[-90,691,102,753],target:[-17,177,17,197]},shoulderL:[-28,177],wristL:[-64,124],shoulderR:[29,177],wristR:[65,124],hipL:[-27,89],hipR:[26,89],kneeL:[-28,71],kneeR:[28,71],footL:[-32,55],footR:[32,55]};
const ARMS={L:new Set(['Right_Shoulder','Right_Shoulder_For_Backside','Hand_Sep_3','Hand_Sep_4','Hand_Sep_111','Hand_Sep_222','Hand_Right']),R:new Set(['Left_Shoulder','Left_Shoulder_For_Backside','Hand_Sep_1','Hand_Sep_2','Hand_Sep_112','Hand_Sep_223','Hand_Left'])};
const HANDS={L:new Set(['Palm_R','Palm_R2','Palm_R9','Palm_R20','Palms-Hold_Hand_3','Palms-Balloon_P','Palms-Balloon_P2']),R:new Set(['Palm_R3','Palm_R8','Palm_R22','Palms-Hold_Hand_8'])};
export function group(n){
 if(n==='Tail'||/^Shadow|root_Char/.test(n))return null;
 for(const s of ['L','R']){if(ARMS[s].has(n))return'arm'+s;if(HANDS[s].has(n))return'hand'+s}
 if(n==='Leg_R')return'legL';if(n==='Leg_L')return'legR';if(n==='Foots-Foot_R')return'footL';if(n==='Foots-Foot_L')return'footR';
 if(n==='Neck')return'neck';if(['Body','Body_2','Body_DP','Stomach_White'].includes(n))return'waist';if(['T_shirt','Pocket','Tummy'].includes(n))return'torso';
 if(/Face|Hair|Eye|EB_|Lips|mouth|Mouth|Toung|Nose|Chick|Whitepart|^N-[LR]$|Laugh_EB/.test(n))return'head';return null;
}
const boxMap=(p,f)=>{const[a,b,c,d]=f.source,[e,g,h,i]=f.target;return[e+(p[0]-a)*(h-e)/(c-a),g+(p[1]-b)*(i-g)/(d-b)]};
const similarity=(a,b,c,d)=>{const x=b[0]-a[0],y=b[1]-a[1],u=d[0]-c[0],v=d[1]-c[1],n=x*x+y*y;return[(u*x+v*y)/n,(v*x-u*y)/n]};
const map=(p,o,q,m)=>[q[0]+m[0]*(p[0]-o[0])-m[1]*(p[1]-o[1]),q[1]+m[1]*(p[0]-o[0])+m[0]*(p[1]-o[1])];
const pos=b=>[b.worldX,b.worldY];
const inverse=(b,p)=>{let x=p[0]-b.worldX,y=p[1]-b.worldY,d=b.a*b.d-b.b*b.c;return[(b.d*x-b.b*y)/d,(b.a*y-b.c*x)/d]};
const forward=(b,p)=>[b.a*p[0]+b.b*p[1]+b.worldX,b.c*p[0]+b.d*p[1]+b.worldY];
export function makeShapeProfile(S,sourceData){
 const bind=new S.Skeleton(sourceData),bs=new S.AnimationState(new S.AnimationStateData(sourceData));bs.setAnimation(0,'0Final/Idle/Idle_EB',false).trackTime=0;bs.apply(bind);bind.updateWorldTransform(S.Physics.none);
 const rd=new S.SkeletonData(),rootData=new S.BoneData(0,'render-root',null);rd.bones.push(rootData);for(const sl of sourceData.slots){const d=new S.SlotData(sl.index,sl.name,rootData);d.blendMode=sl.blendMode;rd.slots.push(d)}const cache=new WeakMap();
 function movePoint(sk,p,driver='T_shirt'){
  const b=bind.findBone(driver),c=sk.findBone(driver),origin=boxMap(pos(b),FIT.torso),goal=boxMap(pos(c),FIT.torso),r=(c.getWorldRotationX()-b.getWorldRotationX())*R,dx=p[0]-origin[0],dy=p[1]-origin[1];return[goal[0]+dx*Math.cos(r)-dy*Math.sin(r),goal[1]+dx*Math.sin(r)+dy*Math.cos(r)];
 }
 function fitBodyPoint(sk,p,g,driver='T_shirt'){
  const neutral=forward(bind.findBone(driver),inverse(sk.findBone(driver),p));return movePoint(sk,boxMap(neutral,FIT[g]),driver);
 }
 function torsoAnchor(sk,target){return movePoint(sk,target)}
 function armFrame(sk,s){const normal=!!sk.findSlot(s==='L'?'Right_Shoulder':'Left_Shoulder')?.getAttachment();const names=normal?(s==='L'?['Hand_L3','Palm_R']:['Hand_L5','Palm_R2']):(s==='L'?['Hand_Sep_3','Hand_Sep_Palm_R_No_Scale']:['Hand_Sep_1','Hand_Sep_Palm_No_Scale']);const rb=bind.findBone(names[0]),hb=bind.findBone(names[1]),root=sk.findBone(names[0]),hand=sk.findBone(names[1]),goal=torsoAnchor(sk,FIT['shoulder'+s]),m=similarity(pos(rb),pos(hb),FIT['shoulder'+s],FIT['wrist'+s]);return{normal,root,hand,rb,hb,goal,m,wrist:map(pos(hand),pos(root),goal,m)}}
 function fitPoint(p,g,sk){
  if(FIT[g]?.source){
   if(g!=='waist')return fitBodyPoint(sk,p,g);
   const neutral=forward(bind.findBone('Body'),inverse(sk.findBone('Body'),p)),q=boxMap(neutral,FIT.waist),body=movePoint(sk,q,'Body'),torso=movePoint(sk,q),t=Math.max(0,Math.min(1,(neutral[1]-350)/106));return[body[0]+(torso[0]-body[0])*t,body[1]+(torso[1]-body[1])*t];
  }
  const s=g.slice(-1);if(g.startsWith('arm')){const f=armFrame(sk,s);return map(p,pos(f.root),f.goal,f.m)}
  if(g.startsWith('hand')){const f=armFrame(sk,s),k=.30/Math.hypot(...f.m);return map(p,pos(f.hand),f.wrist,[f.m[0]*k,f.m[1]*k])}
  const names=s==='L'?['Leg_R','Foots/Foot_R']:['Leg_R3','Foots/Foot_R2'],hip=sk.findBone(names[0]),foot=sk.findBone(names[1]),bh=bind.findBone(names[0]),bf=bind.findBone(names[1]),newHip=movePoint(sk,FIT['hip'+s],'Body'),m=similarity(pos(bh),pos(bf),FIT['hip'+s],FIT['foot'+s]);
  if(g.startsWith('leg'))return map(p,pos(hip),newHip,m);
  const currentAnchor=map(pos(foot),pos(hip),newHip,m),restBounds=s==='L'?[-241.2,14.5,-37.2,160.2]:[36.7,17.8,241.5,163.1],target=s==='L'?[-81,0,-1,59]:[1,0,81,59],point=boxMap([p[0]-foot.worldX+bf.worldX,p[1]-foot.worldY+bf.worldY],{source:restBounds,target}),bindFoot=boxMap(pos(bf),{source:restBounds,target});return[point[0]+currentAnchor[0]-FIT['foot'+s][0],point[1]+currentAnchor[1]-FIT['foot'+s][1]];
 }
 function sample(v){const sk=v.skeleton;let out=cache.get(v);if(!out){out=new S.Skeleton(rd);out.updateWorldTransform(S.Physics.none);cache.set(v,out)}out.drawOrder=sk.drawOrder.map(sl=>out.slots[sl.data.index]);for(const sourceSlot of sk.drawOrder){const g=group(sourceSlot.data.name),a=sourceSlot.getAttachment(),slot=out.slots[sourceSlot.data.index];slot.setAttachment(null);if(!g||!a)continue;slot.color.setFromColor(sourceSlot.color);let verts=[];if(a instanceof S.MeshAttachment||a instanceof S.ClippingAttachment)a.computeWorldVertices(sourceSlot,0,a.worldVerticesLength,verts,0,2);else if(a instanceof S.RegionAttachment)a.computeWorldVertices(sourceSlot,verts,0,2);else continue;const mapped=[];for(let i=0;i<verts.length;i+=2)mapped.push(...fitPoint([verts[i],verts[i+1]],g,sk));let result;
   if(a instanceof S.ClippingAttachment){result=new S.ClippingAttachment(a.name);result.endSlot=a.endSlot?rd.slots[a.endSlot.index]:null;result.vertices=mapped;result.worldVerticesLength=mapped.length}else{result=new S.MeshAttachment(a.name);result.region=a.region;result.uvs=a.uvs;result.regionUVs=a.regionUVs??a.uvs;result.triangles=a.triangles??[0,1,2,2,3,0];result.vertices=mapped;result.worldVerticesLength=mapped.length;result.color.setFromColor(a.color)}slot.setAttachment(result)}
  return out;
 }
 return{sample,bind,fitPoint,armFrame,renderData:rd};
}
export function installShapeProfile(player){const profile=makeShapeProfile(spine,player.data);player.referenceAdapter=v=>profile.sample(v);const c=player.instance;c.renderer.camera.position.set(0,201.5,0);c.renderer.camera.viewportWidth=360;c.renderer.camera.viewportHeight=450;c.renderer.camera.update();return profile;}
