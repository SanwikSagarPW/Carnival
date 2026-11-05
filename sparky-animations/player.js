import{FullCharacterPlayer}from'./runtime/character-upgrade/12-sparky-final/player.js';
import{installPaintedProfile}from'./runtime/character-upgrade/12-sparky-final/motion-fit-painted.js?gesture-fit=2';
const here=new URL('.',import.meta.url);
export class SparkyRigPlayer{
 static async load(manifestURL=new URL('manifest.json',here)){
  const response=await fetch(manifestURL);
  if(!response.ok)throw Error('Sparky manifest HTTP '+response.status);
  const manifest=await response.json();
  if(!window.spine)await new Promise((ok,no)=>{const script=document.createElement('script');script.src=new URL('runtime/vendor/spine-webgl.min.js',here);script.onload=ok;script.onerror=()=>no(Error('Cannot load bundled animation runtime'));document.head.append(script)});
  const player=await FullCharacterPlayer.load(new URL(manifest.sourceManifest,here));
  try{await installPaintedProfile(player,()=>({}));}
  catch(error){player.destroy();throw error;}
  player.manifest=manifest;
  // One fixed padded camera across the gallery and inspector.
  const camera=player.instance.renderer.camera;camera.viewportWidth*=1.2;camera.viewportHeight*=1.2;camera.update();
  return player;
 }
}
