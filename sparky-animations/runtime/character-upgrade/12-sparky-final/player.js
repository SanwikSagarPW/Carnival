/** Reuse the vocal clip's entire mouth attachment contract, including its
 * hide-resting-lips timeline, so two mouth drawings never coexist. */
export function createSpeechAnimation(data){
 const vocal=data.findAnimation('0Final/Vocal/Great choice! How about');
 const slots=new Set(['mouth','Mouth_P','Lips','Lips2']);
 const facial=vocal?.timelines.filter(t=>(t.boneIndex!==undefined&&/^Lips/.test(data.bones[t.boneIndex].name))||(t.slotIndex!==undefined&&slots.has(data.slots[t.slotIndex].name)))||[];
 return facial.length?new spine.Animation('companion-speech',facial,vocal.duration):null;
}
/* Shared renderer: one WebGL context for any number of visible preview canvases. */
export function applyRigPose(v,time){
 const elapsed=v.fixedTime??Math.max(0,time-v.start);
 const dt=v.fixedTime===null?Math.max(0,time-v.previousTime):0;
 v.previousTime=time;v.state.update(dt);v.entry.trackTime=elapsed;
 v.skeleton.setToSetupPose();v.state.apply(v.skeleton);
 for(const [slot,attachment] of v.preservedAttachments)slot.setAttachment(attachment);
 if(time<v.preserveUntil)for(const [slot,attachment] of v.retiringAttachments)if(!slot.getAttachment())slot.setAttachment(attachment);
 if(v.speaking&&v.speechAnimation){
  const frame=v.speechSource?.();
  if(frame){
   const shape='ABCDEFX'.includes(frame.shape)?frame.shape:'X';
   // Reuse the rig's own facial placement and mouth masks. Only D is a mesh
   // with a jaw control; sample its neutral authored placement, not a talk loop.
   v.speechAnimation.apply(v.skeleton,-1,shape==='D'?.30:0,false,null,1,spine.MixBlend.replace,spine.MixDirection.mixIn);
   const slot=v.skeleton.findSlot('mouth');slot.setAttachment(v.skeleton.getAttachment(slot.data.index,'mouth/'+shape));
  }else v.speechAnimation.apply(v.skeleton,-1,Math.max(0,time-v.speechStarted),true,null,1,spine.MixBlend.replace,spine.MixDirection.mixIn);
 }
 v.skeleton.updateWorldTransform(spine.Physics.none);
 if(v.poseModifier){v.poseModifier(v.skeleton,{time,elapsed,dt});v.skeleton.updateWorldTransform(spine.Physics.none);}
}
/* Sticker outline matching the reference: the body silhouette (outline.include
 * decides which slots) is dilated by outline.radius model units in
 * outline.color and composited under the full render. The flame/face art has its
 * own painted outline, so it is excluded. */
const outlineCanvases=new WeakMap();
function drawOutline(c,skeleton,outline,glCanvas){
 let o=outlineCanvases.get(glCanvas);if(!o){const mk=()=>{const e=document.createElement('canvas');e.width=glCanvas.width;e.height=glCanvas.height;return e};o={mask:mk(),out:mk()};outlineCanvases.set(glCanvas,o)}
 const order=skeleton.drawOrder;skeleton.drawOrder=order.filter(sl=>outline.include(sl.data.name));
 c.clear(0,0,0,0);c.renderer.begin();c.renderer.drawSkeleton(skeleton,false);c.renderer.end();skeleton.drawOrder=order;
 const m=o.mask.getContext('2d');m.clearRect(0,0,o.mask.width,o.mask.height);m.drawImage(glCanvas,0,0);
 const x=o.out.getContext('2d'),cam=c.renderer.camera,r=outline.radius*glCanvas.width/cam.viewportWidth/(cam.zoom||1);
 x.globalCompositeOperation='source-over';x.clearRect(0,0,o.out.width,o.out.height);
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;x.drawImage(o.mask,Math.cos(a)*r,Math.sin(a)*r)}
 x.drawImage(o.mask,0,0);x.globalCompositeOperation='source-in';x.fillStyle=outline.color;x.fillRect(0,0,o.out.width,o.out.height);x.globalCompositeOperation='source-over';
 c.clear(0,0,0,0);return o.out;
}
export class FullCharacterPlayer {
 static async load(manifestURL){
  const url=new URL(manifestURL,document.baseURI),response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('Unable to load animation manifest');
  const manifest=await response.json();
  // Start the compressed skeleton download in parallel with the Spine runtime; fall back to the raw .skel on any problem.
  const skeletonBlob=manifest.skeletonGzip&&typeof DecompressionStream==='function'?fetch(new URL(manifest.skeletonGzip,url).href+'?v='+manifest.revision).then(r=>{if(!r.ok||!r.body)throw Error('Skeleton HTTP '+r.status);return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).blob()}).then(b=>URL.createObjectURL(b)).catch(error=>{console.warn('Compressed skeleton unavailable; loading raw skeleton.',error);return null;}):null;
  if(!window.spine)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('vendor/spine-webgl.min.js',url);script.onload=resolve;script.onerror=()=>reject(Error('Unable to load bundled Spine runtime'));document.head.append(script)});
  manifest.skeletonBlob=await skeletonBlob;
  try{return await new Promise((resolve,reject)=>new FullCharacterPlayer(manifest,url,resolve,reject));}
  finally{if(manifest.skeletonBlob)URL.revokeObjectURL(manifest.skeletonBlob);}
 }
 constructor(manifest,url,resolve,reject){
  this.manifest=manifest;this.views=new Set();this.speed=1;this.paused=false;this.last=performance.now();this.time=0;
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=800;canvas.style.cssText='position:fixed;left:-10000px;width:640px;height:800px;pointer-events:none';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);this.canvas=canvas;
  const resource=p=>new URL(p,url).href+'?v='+manifest.revision,skel=manifest.skeletonBlob||resource(manifest.skeleton),atlas=resource(manifest.atlas),texture=resource(manifest.texture);const self=this;
  this.instance=new spine.SpineCanvas(canvas,{webglConfig:{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true},app:{
   loadAssets(c){c.assetManager.loadBinary(skel);c.assetManager.loadTextureAtlas(atlas,undefined,undefined,{[manifest.texture.split('/').at(-1)]:texture})},
   initialize(c){self.data=new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(c.assetManager.get(atlas))).readSkeletonData(c.assetManager.get(skel));const m=manifest.camera;c.renderer.camera.position.set(m.x,m.y,0);c.renderer.camera.viewportWidth=m.width;c.renderer.camera.viewportHeight=m.height;c.renderer.camera.update();resolve(self)},
   update(){const now=performance.now(),dt=Math.min((now-self.last)/1000,.1);self.last=now;if(!self.paused&&!document.hidden)self.time+=dt*self.speed},
   render(c){if(!self.data||document.hidden)return;const t0=performance.now();if(t0<(self.nextDraw||0))return;for(const v of self.views){if(!v.visible||(!v.dirty&&self.paused&&!v.speaking))continue;applyRigPose(v,self.time);c.clear(0,0,0,0);c.renderer.resize(spine.ResizeMode.Fit);const rendered=self.referenceAdapter?.(v)??v.skeleton,outline=self.outline&&self.referenceAdapter?drawOutline(c,rendered,self.outline,canvas):null;c.renderer.begin();c.renderer.drawSkeleton(rendered,!self.referenceAdapter);if(self.showMesh){c.renderer.skeletonDebugRenderer.drawMeshTriangles=true;c.renderer.skeletonDebugRenderer.drawMeshHull=false;c.renderer.skeletonDebugRenderer.drawBones=true;c.renderer.drawSkeletonDebug(rendered,false);}c.renderer.end();v.context.clearRect(0,0,v.canvas.width,v.canvas.height);if(outline)v.context.drawImage(outline,0,0,v.canvas.width,v.canvas.height);v.context.drawImage(canvas,0,0,v.canvas.width,v.canvas.height);v.dirty=false}const cost=performance.now()-t0;self.cost=self.cost===undefined?cost:self.cost*.8+cost*.2;self.nextDraw=t0+Math.min(100,Math.max(30,self.cost*2.5))-4;},
   error(c,e){self.instance?.dispose();canvas.remove();reject(Error('Rig load failed: '+JSON.stringify(e)))}
  }});
 }
 add(canvas,clip,{loop=true,baseClip=null,preserveSlots=[]}={}){
  const speechAnimation=createSpeechAnimation(this.data);
  const skeleton=new spine.Skeleton(this.data),stateData=new spine.AnimationStateData(this.data),state=new spine.AnimationState(stateData);
  const validate=name=>{if(!this.data.findAnimation(name))throw Error('Unknown clip: '+name);};validate(clip);
  // Keep the idle base on track zero; all game actions share track one.
  if(baseClip){validate(baseClip);state.setAnimation(0,baseClip,true);}
  state.apply(skeleton);
  const baseAttachments=new Map(skeleton.slots.map(slot=>[slot.data.name,slot.getAttachment()]));
  const attachments=names=>names.map(name=>{const slot=skeleton.findSlot(name);if(!slot)throw Error('Unknown preserved slot: '+name);return [slot,baseAttachments.get(name)]});
  canvas.width=640;canvas.height=800;
  const track=baseClip?1:0;
  const v={speechAnimation,speaking:false,speechStarted:0,poseModifier:null,canvas,context:canvas.getContext('2d'),skeleton,state,stateData,track,baseAttachments,preservedAttachments:attachments(preserveSlots),retiringAttachments:[],preserveUntil:0,entry:state.setAnimation(track,clip,loop),visible:true,dirty:true,start:this.time,previousTime:this.time,fixedTime:null};
  this.views.add(v);
  return {
   setSpeechSource:fn=>{v.speechSource=fn;v.dirty=true;},
   setSpeech:value=>{if(v.speaking!==value){v.speaking=value;v.speechStarted=this.time;v.dirty=true;}},
   setPoseModifier:fn=>{v.poseModifier=fn;v.dirty=true;},
   setAnimation:(name,{loop=true,mixSeconds=.35,preserveSlots=[]}={})=>{
    validate(name);
    // Sample the exact outgoing pose before starting a mix on the same rig.
    applyRigPose(v,this.time);
    v.retiringAttachments=v.preservedAttachments;v.preserveUntil=this.time+mixSeconds;
    v.preservedAttachments=attachments(preserveSlots);
    stateData.setMix(v.entry.animation.name,name,mixSeconds);
    v.entry=state.setAnimation(track,name,loop);v.start=this.time;v.previousTime=this.time;v.fixedTime=null;v.dirty=true;
   },
   setVisible:value=>{v.visible=value;v.dirty=true},
   seek:time=>{v.fixedTime=time;v.dirty=true},
   restart:()=>{v.fixedTime=null;v.start=this.time;v.previousTime=this.time;v.dirty=true},
   destroy:()=>this.views.delete(v)
  };
 }
 setPaused(value){this.paused=value;for(const v of this.views)v.dirty=true}
 setSpeed(value){this.speed=value}
 destroy(){this.views.clear();this.instance.dispose();this.canvas.remove()}
}
