const R=Math.PI/180;
export const FIT={head:{source:[-390,705,390,1532],target:[-118,192,118,403]},torso:{source:[-241,343,243,750],target:[-46,110,46,191]},waist:{source:[-223,268,224,456],target:[-53,72,53,120]},neck:{source:[-90,691,102,753],target:[-17,177,17,197]},shoulderL:[-28,177],wristL:[-58,124],shoulderR:[29,177],wristR:[59,124],hipL:[-27,89],hipR:[26,89],kneeL:[-28,71],kneeR:[28,71],footL:[-32,55],footR:[32,55]};
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
 const poseContexts=new WeakMap(),frameCache=new WeakMap();
 function setPoseContext(v){const animation=v.entry?.animation,time=v.fixedTime??v.entry?.trackTime??0;poseContexts.set(v.skeleton,{animation,time:v.entry?.loop&&animation?.duration>0?time%animation.duration:time});frameCache.delete(v.skeleton)}
 function armFrame(sk,s){
  let frames=frameCache.get(sk);if(!frames){frames=new Map();frameCache.set(sk,frames)}if(frames.has(s))return frames.get(s);
  const normal=!!sk.findSlot(s==='L'?'Right_Shoulder':'Left_Shoulder')?.getAttachment(),ctx=poseContexts.get(sk),goal=torsoAnchor(sk,FIT['shoulder'+s]),canonical=s==='L'?['Hand_L3','Hand_L4','Palm_R']:['Hand_L5','Hand_L6','Palm_R2'],folded=s==='L'?['Hand_Sep_3','Hand_Sep_4','Hand_Sep_Palm_R_No_Scale']:['Hand_Sep_1','Hand_Sep_2','Hand_Sep_Palm_No_Scale'],m=similarity(pos(bind.findBone(canonical[0])),pos(bind.findBone(canonical[2])),FIT['shoulder'+s],FIT['wrist'+s]);
  const timelineFor=index=>ctx?.animation?.timelines.find(t=>t instanceof S.AttachmentTimeline&&t.slotIndex===index);
  function attachmentAt(sl,t){const tl=timelineFor(sl.data.index);let name=sl.data.attachmentName;if(tl)for(let i=0;i<tl.frames.length&&tl.frames[i]<=t;i++)name=tl.attachmentNames[i];return name}
  let blend=normal?1:0;
  const shoulder=sk.findSlot(s==='L'?'Right_Shoulder':'Left_Shoulder'),timeline=timelineFor(shoulder.data.index);
  if(timeline){let previous=!!shoulder.data.attachmentName;for(let i=0;i<timeline.frames.length;i++){const key=timeline.frames[i],next=!!timeline.attachmentNames[i],window=Math.min(.06,i?Math.max(.005,(key-timeline.frames[i-1])*.4):.06,i+1<timeline.frames.length?Math.max(.005,(timeline.frames[i+1]-key)*.4):.06);if(key>0&&previous!==next&&Math.abs(ctx.time-key)<window){let t=(ctx.time-key+window)/(2*window);t=t*t*(3-2*t);blend=(previous?1:0)+((next?1:0)-(previous?1:0))*t;break}previous=next}}
  function control(mode){const names=mode?canonical:folded,root=sk.findBone(names[0]),elbow=sk.findBone(names[1]);let hand=sk.findBone(names[2]);
   const family=b=>mode?!/Hand_Sep/.test(b.data.name):/Hand_Sep/.test(b.data.name);
   const candidates=sk.drawOrder.filter(sl=>group(sl.data.name)==='hand'+s&&family(sl.bone));
   let active=candidates.filter(sl=>sl.getAttachment()&&sl.color.a>.1).at(-1);
   if(!active&&ctx){for(const t of [ctx.time+.061,Math.max(0,ctx.time-.061)]){active=candidates.filter(sl=>attachmentAt(sl,t)).at(-1);if(active)break}}
   if(active)hand=active.bone;
   const actualRoot=fitBodyPoint(sk,pos(root),'torso'),referenceRoot=movePoint(sk,boxMap(pos(bind.findBone(root.data.name)),FIT.torso)),anchor=[goal[0]+actualRoot[0]-referenceRoot[0],goal[1]+actualRoot[1]-referenceRoot[1]];
   return{root,hand,goal:anchor,elbow:map(pos(elbow),pos(root),anchor,m),wrist:map(pos(hand),pos(root),anchor,m)};
  }
  const n=control(true),f=control(false),active=normal?n:f,mix=(a,b)=>[a[0]+(b[0]-a[0])*blend,a[1]+(b[1]-a[1])*blend];
  const raw={goal:mix(f.goal,n.goal),elbow:mix(f.elbow,n.elbow),wrist:mix(f.wrist,n.wrist)};
  // Hands hidden with nothing held means hands behind the back: carry the wrist
  // behind the torso so the arm angles back out of sight instead of ending in a stub.
  const visible=sl=>sl.getAttachment()&&sl.color.a>.1,handShown=sk.drawOrder.some(sl=>group(sl.data.name)==='hand'+s&&visible(sl)),onHand=sl=>{for(let b=sl.bone;b;b=b.parent)if(HAND_BONES[s].test(b.data.name))return true;return false},holding=sk.drawOrder.some(sl=>HELD.test(sl.data.name)&&visible(sl)&&(onHand(sl)||HELD_ON_BODY.test(sl.data.name)));
  if(!handShown&&!holding){raw.wrist=[goal[0]+(s==='L'?1:-1)*BEHIND_BACK[0],goal[1]-BEHIND_BACK[1]];raw.behind=true}
  const solved=retargetArm(raw,goal,s,blend);
  const result={normal,blend,root:active.root,hand:active.hand,rb:bind.findBone(active.root.data.name),hb:bind.findBone(active.hand.data.name),goal:solved.goal,m,elbow:solved.elbow,wrist:raw.wrist,raw,behind:!!raw.behind};frames.set(s,result);return result;
 }
 // Lucas's long-sleeved arm roots wander across his torso (up to ~20 units here),
 // which would drag Sparky's short sleeves into or off the shirt. Keep each
 // shoulder pinned to the torso with only a small shrug, preserve Lucas's hand
 // position (claps, face touches, props) and re-solve the elbow with two-bone IK
 // on the side Lucas bends to.
 const HAND_BONES={L:/Hand_Right|Hand_Sep_3|Hand_Sep_4|^Palm_R$/,R:/Hand_Left|Hand_Sep_1|Hand_Sep_2|^Palm_R2$/},HELD_ON_BODY=/^Hold_/,HELD=/^(Hold_|Icecream|Brush|BirthdaySong|Mothers_Day|Cake|Palms)/,BEHIND_BACK=[12,60],BEHIND_BEND=.2,UPPER=33,LOWER=31,FORESHORTEN=[.62,1.06],SHRUG={x:[-2,2],y:[-3,5]};
 function retargetArm(raw,torsoShoulder,s,blend){
  const clamp=(v,[lo,hi])=>Math.max(lo,Math.min(hi,v)),g=[torsoShoulder[0]+clamp(raw.goal[0]-torsoShoulder[0],SHRUG.x),torsoShoulder[1]+clamp(raw.goal[1]-torsoShoulder[1],SHRUG.y)];
  const w=raw.wrist,d=Math.hypot(w[0]-g[0],w[1]-g[1])||1e-6,ux=(w[0]-g[0])/d,uy=(w[1]-g[1])/d,nx=-uy,ny=ux;
  // Positive side: elbow lies along +n. Nearly straight arms bend away from the body.
  const side=ux*(raw.elbow[1]-g[1])-uy*(raw.elbow[0]-g[0]),out=s==='L'?(nx<0?1:-1):(nx>0?1:-1),sign=Math.abs(side)>1.5?Math.sign(side):out;
  // Keep the authored elbow bend angle and let the arm foreshorten to reach the
  // hand (a 2D arm pointing toward the camera looks shorter, not more bent).
  // Only beyond the foreshortening limits does the bend itself change.
  const ex=raw.elbow[0]-raw.goal[0],ey=raw.elbow[1]-raw.goal[1],fx=raw.wrist[0]-raw.elbow[0],fy=raw.wrist[1]-raw.elbow[1],bend=raw.behind?BEHIND_BEND:Math.acos(Math.max(-1,Math.min(1,(ex*fx+ey*fy)/((Math.hypot(ex,ey)*Math.hypot(fx,fy))||1)))),
   span=Math.sqrt(UPPER*UPPER+LOWER*LOWER+2*UPPER*LOWER*Math.cos(bend)),k=Math.max(FORESHORTEN[0],Math.min(FORESHORTEN[1],d/span)),a=UPPER*k,b=LOWER*k,dd=Math.max(Math.abs(a-b)+1e-3,Math.min(a+b-1e-3,d));
  const cosA=Math.max(-1,Math.min(1,(a*a+dd*dd-b*b)/(2*a*dd))),sinA=Math.sqrt(1-cosA*cosA)*sign;
  const e=[g[0]+a*(ux*cosA+nx*sinA),g[1]+a*(uy*cosA+ny*sinA)];
  // Body collision: an elbow below shoulder level stays outside the shirt
  // outline (measured edge ~10 units beyond the shoulder pivot), faded in by
  // height so raised arms are untouched and nothing pops.
  const dir=s==='L'?-1:1,limit=torsoShoulder[0]+dir*ELBOW_CLEAR,cxT=torsoShoulder[0]-dir*28.5,front=Math.abs(raw.wrist[0]-cxT)<32&&raw.wrist[1]>95&&raw.wrist[1]<200,t=Math.max(0,Math.min(1,(g[1]+4-e[1])/10))*(front?1:1-blend),blocked=dir*(e[0]-limit)<0;
  if(blocked)e[0]+=(limit-e[0])*t*t*(3-2*t);
  // Hands in front of the body: the upper arm points toward the camera, so the
  // elbow stays tucked just below the sleeve hem at the side (a front-view
  // cartoon arm) instead of swinging the sleeve across the chest. Weighted
  // smoothly by how far in front the hand is, so poses blend without popping.
  if(!raw.behind){const sm=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)},wf=sm((TUCK.reach-Math.abs(w[0]-cxT))/TUCK.fade)*sm((w[1]-90)/10)*sm((TUCK.top-w[1])/12);
   if(wf>0){
    // Sleeve and upper arm move as one piece of full length, so the elbow is
    // always outside the sleeve; two-joint IK picks the elbow out and down.
    const A=UPPER,B=TUCK.forearm,dd=Math.max(Math.abs(A-B)+1e-3,Math.min(A+B-1e-3,d)),cA=Math.max(-1,Math.min(1,(A*A+dd*dd-B*B)/(2*A*dd))),sA=Math.sqrt(1-cA*cA),
     cand=[1,-1].map(k=>[g[0]+A*(ux*cA-uy*sA*k),g[1]+A*(uy*cA+ux*sA*k)]),pick=cand.reduce((p,q)=>dir*q[0]-.3*q[1]>dir*p[0]-.3*p[1]?q:p);
    e[0]+=(pick[0]-e[0])*wf;e[1]+=(pick[1]-e[1])*wf}}
  return{goal:g,elbow:e};
 }
 // Folded arms only (hanging arms sit naturally behind the torso edge): elbow
 // centre clears the shirt edge (~10 beyond the pivot) by the arm half-width.
 const ELBOW_CLEAR=22,TUCK={reach:52,fade:14,top:255,forearm:34};

 function headPoint(p,sk){const b=bind.findBone('Face'),c=sk.findBone('Face'),r=(c.getWorldRotationX()-b.getWorldRotationX())*R,centerSource=[0,1097],local=inverse(b,centerSource),native=forward(c,local),center=fitBodyPoint(sk,native,'head'),restCenter=boxMap(centerSource,FIT.head),dx=p[0]-restCenter[0],dy=p[1]-restCenter[1];return[center[0]+dx*Math.cos(r)-dy*Math.sin(r),center[1]+dx*Math.sin(r)+dy*Math.cos(r)]}
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
 return{sample,bind,fitPoint,armFrame,headPoint,bodyPoint:(p,sk)=>movePoint(sk,p,'Body'),setPoseContext,renderData:rd};
}
export function installShapeProfile(player){const profile=makeShapeProfile(spine,player.data);player.referenceAdapter=v=>profile.sample(v);const c=player.instance;c.renderer.camera.position.set(0,201.5,0);c.renderer.camera.viewportWidth=360;c.renderer.camera.viewportHeight=450;c.renderer.camera.update();return profile;}
