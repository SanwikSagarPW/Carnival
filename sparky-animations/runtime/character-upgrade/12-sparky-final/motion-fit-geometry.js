import{limbFields,LEG_SHIFT}from'./motion-fit-field.js?v=1';
import{loadMeshModel}from'./mesh-pack.js';
import{makeShapeProfile}from'./shape-profile.js?v=ik-1';
const GROUPS={Head:'head',Neck:'neck',Torso:'torso',Shorts:'waist',Arm_L:'armL',Arm_R:'armR',Hand_L:'handL',Hand_R:'handR',Leg_L:'legL',Leg_R:'legR',Foot_L:'footL',Foot_R:'footR',Sock_L:'footL',Sock_R:'footR',Sleeve_L:'armL',Sleeve_R:'armR'};
const ORDER=['Leg_L','Leg_R','Sock_L','Sock_R','Foot_L','Foot_R','Shorts','Arm_L','Arm_R','Sleeve_L','Sleeve_R','Neck','Torso','Head','ForearmFront_L','ForearmFront_R','Hand_L','Hand_R'];
const SHOE={sx:.965,sy:1.0645,base:3.5,y0:5},SLEEVE_SCALE=1.2,SHORTS_WAIST=112,SHORTS_HEM=90,SHORTS_CROTCH=7;
const smooth=(a,b,x)=>{let t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
export function makeSilhouetteProfile(S,sourceData,model,region){
 // Replace the old shirt mesh with a regular surface for the new drawing.
 // A single fixed binding frame keeps the circular badge stable during motion.
 const torso=model.meshes.find(m=>m.name==='Torso'),old=structuredClone(torso),anchors=[16,548,550],scale=.0915;
 const bounds=[-627*scale,194+(193-1254)*scale,(1254-627)*scale,194+193*scale];
 const bary=(p,a,b,c)=>{const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]),x=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/d,y=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/d;return[x,y,1-x-y]};
 torso.points=[];torso.triangles=[];torso.transfers=Object.fromEntries(Object.keys(old.transfers).map(k=>[k,[]]));
 const N=64;for(let y=0;y<=N;y++)for(let x=0;x<=N;x++){const q=[bounds[0]+(bounds[2]-bounds[0])*x/N,bounds[3]-(bounds[3]-bounds[1])*y/N],badge=smooth(11.5,20,Math.hypot(Math.abs(q[0])-20.5,q[1]-164.4)),join=smooth(14,32,Math.abs(q[0]))*smooth(165,188,q[1])*badge,collar=(1-smooth(18,30,Math.abs(q[0])))*badge,fit=[q[0]*(1+.20*smooth(170,184,q[1])*collar)-Math.sign(q[0])*3*join,q[1]+(q[1]-194)*.30*smooth(169,181,q[1])*collar-2*join],w=bary(fit,...anchors.map(i=>old.points[i]));torso.points.push(q);for(const [key,list] of Object.entries(torso.transfers)){const weights=new Map();anchors.forEach((id,k)=>old.transfers[key][id].indices.forEach((n,j)=>weights.set(n,(weights.get(n)??0)+old.transfers[key][id].weights[j]*w[k])));list.push({indices:[...weights.keys()],weights:[...weights.values()]})}}
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const k=y*(N+1)+x;torso.triangles.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2)}
 const fitted=makeShapeProfile(S,sourceData),data=new S.SkeletonData(),root=new S.BoneData(0,'shape-render-root',null);data.bones.push(root);for(const name of ORDER)data.slots.push(new S.SlotData(data.slots.length,name,root));const cache=new WeakMap();
 const getAttachment=(slot,name)=>sourceData.defaultSkin.getAttachment(sourceData.findSlot(slot).index,name);const keysByGroup=new Map();for(const k of Object.keys(model.cages)){const g=model.cages[k].group;keysByGroup.set(g,[...(keysByGroup.get(g)??[]),k])}
 function sample(v,{colours=false}={}){
  let render=cache.get(v);if(!render){render=new S.Skeleton(data);render.updateWorldTransform(S.Physics.none);cache.set(v,render)}const sk=v.skeleton;fitted.setPoseContext(v);const cageCache=new Map(),limbPoint=limbFields(fitted,sk);
  function cagePoints(key){if(cageCache.has(key))return cageCache.get(key);const cage=model.cages[key],slot=sk.findSlot(cage.slot),a=getAttachment(cage.slot,cage.name),p=[];if(a instanceof S.MeshAttachment)a.computeWorldVertices(slot,0,a.worldVerticesLength,p,0,2);else a.computeWorldVertices(slot,p,0,2);const out=[];for(let i=0;i<p.length;i+=2)out.push(...fitted.fitPoint([p[i],p[i+1]],cage.group,sk));cageCache.set(key,out);return out}
  function activeKeys(part){const found=[];for(const slotName of part.sourceSlots){const sl=sk.findSlot(slotName),a=sl.getAttachment(),key=slotName+'::'+a?.name;if(a&&sl.color.a>.01&&(a.color?.a??1)>.01&&part.transfers[key])found.push(key)}if(found.length)return found;return[Object.keys(part.transfers)[0]]}
  function point(part,key,i){const binding=part.transfers[key][i],p=cagePoints(key),out=[0,0];for(let j=0;j<binding.indices.length;j++){out[0]+=p[binding.indices[j]*2]*binding.weights[j];out[1]+=p[binding.indices[j]*2+1]*binding.weights[j]}return out}
  // Seat the lower neck in the same shirt frame; blend only its upper end
  // towards the head, so a head tilt does not pull it out of the opening.
  const shirtKey=activeKeys(old)[0],shirtAnchors=anchors.map(i=>point(old,shirtKey,i));
  const shirtPoint=q=>{const w=bary(q,...anchors.map(i=>old.points[i]));return[0,1].map(axis=>shirtAnchors.reduce((sum,p,j)=>sum+p[axis]*w[j],0))};
  render.shoulderPoint=shirtPoint;
  const live=k=>{const c=model.cages[k],sl=sk.findSlot(c.slot),a=sl.getAttachment();return a&&a.name===c.name&&sl.color.a>.01&&(a.color?.a??1)>.01};
  const groupKeys=g=>keysByGroup.get(g)??[];const canonicalCache=new Map(),armKeysCache=new Map();
  const canonical=g=>{if(!canonicalCache.has(g)){const all=groupKeys(g);canonicalCache.set(g,all.find(live)??all.find(k=>{const c=model.cages[k];return fitted.bind.findSlot(c.slot).getAttachment()?.name===c.name})??all[0])}return canonicalCache.get(g)};
  function footPoint(p,side){
   const name=side==='L'?'Foots/Foot_R':'Foots/Foot_R2',b=sk.findBone(name),rest=fitted.bind.findBone(name),angle=(b.getWorldRotationX()-rest.getWorldRotationX())*Math.PI/180,cx=side==='L'?-32:32,anchor=limbPoint([cx,55],'leg',side,'lower');
   // Reference shoe: same inner edge, 2.5 narrower outward, 3 taller (y 5..54.5).
   const inner=side==='L'?-5.5:5.5,q=[inner+(p[0]-inner)*SHOE.sx-LEG_SHIFT[side],SHOE.y0+(p[1]-SHOE.base)*SHOE.sy],x=q[0]-cx,y=q[1]-55;
   return[anchor[0]+x*Math.cos(angle)-y*Math.sin(angle),anchor[1]+x*Math.sin(angle)+y*Math.cos(angle)];
  }
  for(const part of model.meshes){const keys=activeKeys(part),byGroup=g=>{const k=canonical(g);return part.transfers[k]?k:undefined},any=keys[0];
   const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
   function armPoint(i,side){let q=part.points[i];
    // Reference sleeves flare ~1.2x wider about the shoulder than the painted mesh.
    if(part.name.startsWith('Sleeve_')){const o=side==='L'?[-28,177]:[29,177],u=side==='L'?[-.522,-.853]:[.524,-.852];
     const dx=q[0]-o[0],dy=q[1]-o[1],along=dx*u[0]+dy*u[1],across=-dx*u[1]+dy*u[0];
     // Short sports sleeve: preserve the hidden shoulder root, shorten the
     // visible length and flare the cuff. The whole surface follows upper arm.
     const t=Math.max(0,Math.min(1,along/35)),a=along<0?along:along*.88,n=across*(1.04+.12*t);
     q=[o[0]+u[0]*a-u[1]*n,o[1]+u[1]*a+u[0]*n]}
    return limbPoint(q,'arm',side,part.name.startsWith('Sleeve_')?'upper':part.name.startsWith('Hand_')?'lower':null)}
   const verts=[];for(let i=0;i<part.points.length;i++){const t0=part.points[i],side=part.name.endsWith('L')?'L':'R';let p;if(!/^(Arm_|Sleeve_|Leg_|Foot_|Sock_|Hand_)/.test(part.name))p=point(part,any,i);
    if(part.name==='Head')p=fitted.headPoint([t0[0],t0[1]+2],sk);
    if(part.name==='Neck'){
     // Fixed rest-space fit: narrow tube, hidden top, lower end inside collar.
     // Blend torso and head transforms along its length, as a connected joint.
     const q=[t0[0]*.48,t0[1]>=185?193+(t0[1]-193)*.55:188.6+(t0[1]-185)*1.05];
     p=mix(shirtPoint(q),fitted.headPoint(q,sk),smooth(182,199,t0[1]));
    }
    if(part.name.startsWith('Arm_')||part.name.startsWith('Sleeve_'))p=armPoint(i,side);

    if(part.name==='Shorts'){
     // Waistband rides the hips; each leg opening follows its own thigh, with a
     // smooth falloff between and a blend across the crotch so nothing tears.
     p=fitted.bodyPoint(t0,sk);const w=smooth(SHORTS_WAIST,SHORTS_HEM,t0[1]);
     if(w>0){const side=smooth(SHORTS_CROTCH,-SHORTS_CROTCH,t0[0]),thigh=mix(limbPoint(t0,'leg','R','upper'),limbPoint(t0,'leg','L','upper'),side);p=mix(p,thigh,w)}
    }
    if(part.name.startsWith('Leg_')){const leg=byGroup('leg'+side),body=byGroup('waist');if(leg&&body)p=mix(limbPoint(t0,'leg',side,null),point(part,body,i),smooth(101,108,t0[1]))}
    if(part.name.startsWith('Foot_'))p=footPoint(t0,side);
    if(part.name.startsWith('Sock_')){const foot=byGroup('foot'+side),leg=byGroup('leg'+side);if(foot&&leg)p=mix(footPoint(t0,side),limbPoint(t0,'leg',side,'lower'),smooth(55,64,t0[1]))}
    if(part.name.startsWith('Hand_')){const hand=byGroup('hand'+side),arm=byGroup('arm'+side),root=side==='L'?[-58,124]:[59,124],w=1-smooth(4,14,Math.hypot(t0[0]-root[0],t0[1]-root[1]));if(hand){p=point(part,hand,i);const f=fitted.armFrame(sk,side);p=[f.wrist[0]+(p[0]-f.wrist[0])*1.065,f.wrist[1]+(p[1]-f.wrist[1])*1.065];const a=(f.hand.getWorldRotationX()-f.hb.getWorldRotationX())*Math.PI/180,gs=side==='L'?-6:6;p=[p[0]+gs*Math.cos(a),p[1]+gs*Math.sin(a)]}if(arm)p=mix(p,armPoint(i,side),w)}
    verts.push(...p)
   }
   let mesh=render.findSlot(part.name).getAttachment();if(!mesh){mesh=new S.MeshAttachment(part.name);mesh.region=region;mesh.regionUVs=new Float32Array(verts.length).fill(.5);mesh.worldVerticesLength=verts.length;mesh.triangles=part.triangles;mesh.updateRegion()}mesh.vertices=verts;
   const palettes={Head:[1,.76,.17],Neck:[1,.76,.17],Torso:[.06,.28,.98],Shorts:[.04,.15,.52],Arm_L:[1,.76,.17],Arm_R:[1,.76,.17],Hand_L:[.95,.96,.98],Hand_R:[.95,.96,.98],Leg_L:[1,.76,.17],Leg_R:[1,.76,.17],Foot_L:[.04,.47,1],Foot_R:[.04,.47,1],Sock_L:[.95,.96,.98],Sock_R:[.95,.96,.98],Sleeve_L:[.06,.28,.98],Sleeve_R:[.06,.28,.98]};const rgb=colours?palettes[part.name]:[.71,.81,.81];mesh.color.set(rgb[0],rgb[1],rgb[2],1);render.findSlot(part.name).setAttachment(mesh);
   if(part.name.startsWith('Arm_')){
    const side=part.name.endsWith('L')?'L':'R',overlay=render.findSlot('ForearmFront_'+side);overlay.setAttachment(null);
    if(!fitted.armFrame(sk,side).normal){
     // Lucas switches distal arm layers in folded gestures. Draw only the distal
     // surface in front of clothing; keep the shoulder root concealed.
     const out=verts,tri=part.triangles.filter((_,j)=>part.vertexSegments[part.triangles[j-j%3]]==='lower');
     const front=new S.MeshAttachment('ForearmFront_'+side);front.region=region;front.regionUVs=new Float32Array(out.length).fill(.5);front.vertices=out;front.worldVerticesLength=out.length;front.triangles=tri;front.updateRegion();front.color.setFromColor(mesh.color);overlay.setAttachment(front);
    }
   }

  }
  return render;
 }
 return{sample,data,fitted};
}
export async function installSilhouetteProfile(player,settings){const url=new URL('./material.atlas',import.meta.url).href,am=player.instance.assetManager;await new Promise((ok,no)=>am.loadTextureAtlas(url,ok,(_,e)=>no(Error(String(e)))));const model=await loadMeshModel(import.meta.url),profile=makeSilhouetteProfile(spine,player.data,model,am.get(url).findRegion('white'));player.referenceAdapter=v=>profile.sample(v,settings());const c=player.instance;c.renderer.camera.position.set(0,201.5,0);c.renderer.camera.viewportWidth=360;c.renderer.camera.viewportHeight=450;c.renderer.camera.update();return profile;}
