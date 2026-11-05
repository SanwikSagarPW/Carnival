/**
 * Sparky game runtime.
 *
 *   import {createSparky} from './runtime/sparky.js';
 *   const sparky = await createSparky(document.querySelector('canvas'));
 *   sparky.play('Idle EB', {loop: true});
 *   await sparky.play('Clapping');            // resolves when a one-shot clip ends
 *   sparky.play('Idle EB', {loop: true});     // 0.3 s blend by default
 *   sparky.setSpeaking(true);                 // mouth cycles visemes
 *   sparky.setSpeechSource(() => ({shape: 'D'}));   // or drive Rhubarb/Papagayo shapes A-F, X
 *
 * Clips can be named by title ('Clapping') or full rig path
 * ('0Final/Appreciation/Clapping'); sparky.clips lists them all.
 * Requires an HTTP server (ES modules + fetch) and WebGL.
 */
const here = new URL('.', import.meta.url);

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(Error('Unable to load ' + src));
    document.head.append(s);
  });
}

export async function createSparky(canvas, {outline = true, speed = 1} = {}) {
  if (!window.spine) await loadScript(new URL('vendor/spine-webgl.min.js', here).href);
  const base = new URL('character-upgrade/12-sparky-final/', here);
  const [{FullCharacterPlayer}, {installPaintedProfile}] = await Promise.all([
    import(new URL('player.js', base).href),
    import(new URL('motion-fit-painted.js?gesture-fit=2', base).href),
  ]);
  const player = await FullCharacterPlayer.load(new URL('../06-lucas-construction/manifest.json', base).href);
  let speaking = false;
  await installPaintedProfile(player, () => ({speaking}));
  if (!outline) player.outline = null;
  player.setSpeed(speed);

  const clips = player.manifest.animations.map(a => ({name: a.name, title: a.title, category: a.category, duration: a.duration}));
  const find = id => clips.find(c => c.name === id || c.title === id) ?? (() => { throw Error('Unknown Sparky clip: ' + id); })();
  const first = find('Idle EB');
  const view = player.add(canvas, first.name, {loop: true});
  let current = first, pending = null;

  return {
    clips,
    get current() { return current.title; },
    /** Play a clip. Resolves when a non-looping clip finishes (or is replaced). */
    play(id, {loop = false, mix = 0.3} = {}) {
      const clip = find(id);
      pending?.resolve(false); pending = null;
      view.setAnimation(clip.name, {loop, mixSeconds: mix});
      current = clip;
      if (loop) return Promise.resolve(true);
      return new Promise(resolve => {
        const timer = setTimeout(() => { pending = null; resolve(true); }, clip.duration / player.speed * 1000);
        pending = {resolve: v => { clearTimeout(timer); resolve(v); }};
      });
    },
    seek(seconds) { view.seek(seconds); },
    resume() { view.restart(); },
    setSpeaking(on) { speaking = !!on; view.setSpeech(speaking); },
    setSpeechSource(fn) { view.setSpeechSource(fn); },
    setSpeed(v) { player.setSpeed(v); },
    setPaused(v) { player.setPaused(v); },
    setVisible(v) { view.setVisible(v); },
    destroy() { pending?.resolve(false); view.destroy(); player.destroy(); },
    /** Low-level access for engines that need it. */
    player,
  };
}
