import { DIALOGUES } from './dialogues.js';
import * as audio from './audio.js';
import { GameTimers } from './timers.js';

/* ==========================================================================
   Setup
   ========================================================================== */
const SKILLS = [
  { key: 'different', title: 'Find the different one', instruction: 'Which picture does not belong?', theme: 'meadow' },
  { key: 'biggest',   title: 'Find the biggest one', instruction: 'Tap the biggest object.', theme: 'meadow' },
  { key: 'more',      title: 'Which group has more?', instruction: 'Tap the group with more.', theme: 'meadow' },
  { key: 'longest',   title: 'Find the longest one', instruction: 'Tap the longest object.', theme: 'meadow' },
  { key: 'shapes',    title: 'Match the shapes', instruction: 'Drag each shape to its match.', theme: 'meadow' },
];
const ASSET_COUNT = 40;
const PRAISE_DELAY = 750;       // how long a right answer sparkles before the arrow appears
const NUDGE_AFTER_MS = 9000;    // quiet time before Sparky repeats the question
const NUDGE_TIMES = 3;

const $ = (s) => document.querySelector(s);
const game = $('#game');
const stage = $('#stage');
const ribbon = $('#ribbon');
const btnNext = $('#btn-next');
const btnPause = $('#btn-pause');
const pauseDialog = $('#pause-dialog');
const instruction = $('#instruction');
const feedback = $('#feedback');
const hearButton = $('#btn-hear');
const loading = $('#round-loading');
const loadingMessage = $('#loading-message');
const retryButton = $('#btn-retry');
const fx = $('#fx');
const starCountEl = $('#star-count');
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let skillIndex = 0;
let resolved = false;
let starsWon = 0;
let onNext = null;
let currentSection = null;
let roundReady = true;
let retryRound = null;
let speechToken = 0;
let pausedByUser = false;
let resetBalloonLayout = null;
const portrait = matchMedia('(orientation: portrait)');
const clock = new GameTimers();

function suspended() {
  return pausedByUser || portrait.matches || document.hidden;
}

function syncSuspension() {
  const paused = suspended();
  game.classList.toggle('is-suspended', paused);
  game.inert = paused;
  stage.inert = !roundReady;
  clock.setPaused(paused);
  rig?.setPaused(paused || reducedMotion);
  audio.setPaused(paused);
}

function tell(text, tone = '') {
  feedback.textContent = text;
  feedback.dataset.tone = tone;
}

/* ==========================================================================
   Scenes - everything that can fire later (timers, voice callbacks) belongs to
   the scene that created it, and silently dies when the scene changes.
   ========================================================================== */
let sceneId = 0;
let nudgeTimer = null;

function newScene(screen, theme = 'meadow') {
  sceneId++;
  clock.clearAll();
  audio.stopSpeech();
  resolved = false;
  onNext = null;
  btnNext.hidden = true;
  btnNext.classList.remove('pop-in');
  fx.textContent = '';
  game.dataset.screen = screen;
  game.dataset.theme = theme;
  // Close and re-open the curtains so every new round starts like a new act.
  const frame = $('.puzzle-frame');
  frame.classList.remove('curtain-open');
  if (screen === 'play') {
    void frame.offsetWidth;
    frame.classList.add('curtain-open');
  }
  currentSection = null;
  resetBalloonLayout = null;
  delete game.dataset.section;
  roundReady = screen === 'splash';
  retryRound = null;
  loading.hidden = true;
  retryButton.hidden = true;
  hearButton.hidden = screen === 'splash';
  hearButton.disabled = !roundReady;
  game.setAttribute('aria-busy', String(!roundReady));
  $('#eyebrow').textContent = screen === 'splash' ? 'Play, discover, grow' : 'A little learning adventure';
  tell(screen === 'splash' ? 'Sparky is here to help.' : 'Take your time. You can do it!');
  stage.className = 'stage';
  stage.textContent = '';
  document.querySelector('.board-heading .star-row')?.remove();
  syncSuspension();
  return sceneId;
}

function later(fn, ms) {
  const id = sceneId;
  return clock.set(() => { if (id === sceneId) fn(); }, ms);
}

function setTitle(text) {
  ribbon.textContent = text;
  ribbon.removeAttribute('aria-label');
  ribbon.classList.remove('ribbon-in');
  void ribbon.offsetWidth;
  ribbon.classList.add('ribbon-in');
}

function showNext(handler, label = 'Next') {
  onNext = handler;
  btnNext.setAttribute('aria-label', label);
  btnNext.hidden = false;
  btnNext.classList.remove('pop-in');
  void btnNext.offsetWidth;
  btnNext.classList.add('pop-in');
}

/* ---------- voice helpers ---------- */
function speak(src, opts = {}) {
  const id = sceneId;
  const token = ++speechToken;
  const answered = resolved;
  const { onEnd, delay = 0, ...rest } = opts;
  later(() => {
    if (token !== speechToken || (!answered && resolved)) return;
    audio.speak(src, { ...rest, onEnd: onEnd ? () => { if (id === sceneId) onEnd(); } : null });
  }, delay);
}

/** Say the intro, then keep gently re-asking while the child is stuck. */
function introduce(section) {
  const clips = DIALOGUES[section];
  if (!clips) return;
  audio.warm([...(clips.guide || []), ...(clips.cheerup || [])]);
  speak(clips.intro?.[0], { delay: 450, onEnd: () => armNudge(section, NUDGE_TIMES) });
}

function armNudge(section, tries) {
  clock.clear(nudgeTimer);
  if (tries <= 0) return;
  const id = sceneId;
  nudgeTimer = clock.set(() => {
    if (id !== sceneId || resolved) return;
    if (audio.isSpeaking()) return armNudge(section, tries);
    speak(audio.pick(DIALOGUES[section]?.guide));
    armNudge(section, tries - 1);
  }, NUDGE_AFTER_MS);
}

/** The child did something - hold off nudging, restart the quiet timer. */
function touched(section) {
  armNudge(section, NUDGE_TIMES);
}

function cheerUp(section) {
  // Don't pile a second "try again" on top of one that is still playing.
  const pool = DIALOGUES[section]?.cheerup?.length ? DIALOGUES[section].cheerup : DIALOGUES.welcome.cheerup;
  speak(audio.pick(pool), { ifIdle: true, delay: 200 });
}

/* ==========================================================================
   Effects
   ========================================================================== */
function burst(origin, amount = 14) {
  if (!origin || reducedMotion) return;
  const box = origin.getBoundingClientRect();
  const area = game.getBoundingClientRect();
  const cx = box.left + box.width / 2 - area.left;
  const cy = box.top + box.height / 2 - area.top;
  const colors = ['#ffd23f', '#ff5c8a', '#5be37d', '#4cc3ff', '#b266ff', '#ff9a3c'];
  for (let i = 0; i < amount; i++) {
    const bit = document.createElement('i');
    const angle = (Math.PI * 2 * i) / amount + (Math.random() - 0.5) * 0.5;
    const dist = 50 + Math.random() * 90;
    bit.style.left = `${cx}px`;
    bit.style.top = `${cy}px`;
    bit.style.background = colors[i % colors.length];
    bit.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    bit.style.setProperty('--dy', `${Math.sin(angle) * dist - 24}px`);
    bit.style.setProperty('--spin', `${Math.round(Math.random() * 240 - 120)}deg`);
    fx.append(bit);
    later(() => bit.remove(), 900);
  }
}

const POP_WORDS = ['Pop!', 'Yay!', 'Boom!', 'Wow!', 'Nice!'];
function popFx(origin) {
  if (!origin) return;
  const box = origin.getBoundingClientRect();
  const area = game.getBoundingClientRect();
  const x = `${box.left + box.width / 2 - area.left}px`;
  const y = `${box.top + box.height * .4 - area.top}px`;
  const ring = document.createElement('span');
  ring.className = 'pop-ring';
  const word = document.createElement('span');
  word.className = 'pop-word';
  word.textContent = POP_WORDS[Math.floor(Math.random() * POP_WORDS.length)];
  word.style.setProperty('--tilt', `${Math.round(Math.random() * 16 - 8)}deg`);
  for (const el of [ring, word]) { el.style.left = x; el.style.top = y; }
  fx.append(ring, word);
  later(() => { ring.remove(); word.remove(); }, 1000);
}

function addStar() {
  starsWon++;
  starCountEl.textContent = String(starsWon);
  const pill = $('#stars-pill');
  pill.classList.remove('bump');
  void pill.offsetWidth;
  pill.classList.add('bump');
}

/* ==========================================================================
   Sparky
   ========================================================================== */
let rig = null;
let view = null;
let runToken = 0;
let idleTimer = null;
let rigPromise = null;
let rigWanted = false;
let webglSupported;
const characterEl = $('#character');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Without WebGL the animation can never run, so don't spend megabytes (and five retries) on it. */
function hasWebgl() {
  if (webglSupported === undefined) {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      webglSupported = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      webglSupported = false;
    }
  }
  return webglSupported;
}
const dataSaverOn = () => {
  const link = navigator.connection;
  return !!(link?.saveData || /(^|-)2g$/.test(link?.effectiveType || ''));
};

/* Sparky's rig is the heaviest download, so it loads in the background after the first screen is up. The static
   poster in #character stands in until the first rig frame is drawn, and stays if the rig can never load.
   On data saver or 2G the poster stays until the child taps Sparky. */
function loadRig() {
  if (!hasWebgl()) return Promise.resolve(null);
  if (!rigWanted && dataSaverOn()) {
    $('#actor-status').textContent = 'Tap Sparky to wake him up';
    return Promise.resolve(null);
  }
  rigPromise ??= (async () => {
    // Let the backdrop, font and poster win the bandwidth race on slow connections.
    if (document.readyState !== 'complete') {
      await Promise.race([new Promise((resolve) => addEventListener('load', resolve, { once: true })), wait(4000)]);
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const { SparkyRigPlayer } = await import('./sparky-animations/player.js');
        const loaded = await SparkyRigPlayer.load();
        // Painted parts already have outlines; the extra silhouette layer produces a displaced shadow.
        if (!location.search.includes('outline')) loaded.outline = null;
        return loaded;
      } catch (error) {
        console.warn(`Sparky load attempt ${attempt + 1} failed.`, error);
        await wait(Math.min(2000 * 2 ** attempt, 15000));
        if (!navigator.onLine) {
          await Promise.race([new Promise((resolve) => addEventListener('online', resolve, { once: true })), wait(30000)]);
        }
      }
    }
    return null;
  })().then((loaded) => {
    if (!loaded) {
      rigPromise = null;
      characterEl.setAttribute('aria-label', 'Sparky. Animation unavailable; tap to retry.');
      $('#actor-status').textContent = 'Tap Sparky to retry';
    }
    return loaded;
  });
  return rigPromise;
}

const IDLE_CYCLE = [
  ['idle', '0Final/Idle/Idle'],
  ['idleAlt', '0Final/Idle/Idle_EB'],
];
const HAPPY = [
  '0Final/Appreciation/Clapping',
  '0Final/Appreciation/Hurray',
  '0Final/Appreciation/Thumbs_Up_2',
  '0Final/Appreciation/Yeahh_1',
  '0Final/Super_Happy',
];
const CLIPS = {
  ...Object.fromEntries(IDLE_CYCLE),
  wow: '0Final/Wow_2',
  jump: '0Final/Woohoo',
  welcome: '0Final/Appreciation/Hurray',
  dance: '0Final/Woohoo',
  laugh: '0Final/Super_Happy',
  try: '0Final/Idle/Lookaround_Wow',
};
const MIX_SECONDS = 0.25;
let talking = false;
let currentName = 'idle';
let lastTalkClip = null;

/** Sparky's authored speaking clips move his whole body: head, arms and gloves. */
function pickTalkClip() {
  const clips = (rig?.manifest.animations || []).map((c) => c.name).filter((n) => n.startsWith('0Final/Vocal/') && n !== lastTalkClip);
  lastTalkClip = clips[Math.floor(Math.random() * clips.length)] || null;
  return lastTalkClip;
}

async function animate(name = 'idle') {
  clock.clear(idleTimer);
  const token = ++runToken;
  const looping = name === 'talk' || IDLE_CYCLE.some(([key]) => key === name);
  try {
    rig = await loadRig();
    if (!rig || token !== runToken) return;
    // A talking Sparky never settles back into a still idle until the voice stops.
    if (name === 'idle' && talking && !reducedMotion) name = 'talk';
    currentName = name;
    const clipName = name === 'happy' ? HAPPY[Math.floor(Math.random() * HAPPY.length)]
      : name === 'talk' ? (pickTalkClip() || CLIPS.idle) : (CLIPS[name] || CLIPS.idle);
    rig.setPaused(suspended() || reducedMotion);
    characterEl.classList.toggle('airborne', name === 'jump' || name === 'dance');
    if (view) view.setAnimation(clipName, { loop: looping, mixSeconds: reducedMotion ? 0 : MIX_SECONDS });
    else {
      view = rig.add($('#sparky'), clipName, { loop: looping });
      view.setSpeech(talking);
      // Two frames later the canvas holds Sparky, so the poster can go without a flash.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        characterEl.classList.add('rig-on');
        characterEl.setAttribute('aria-label', 'Sparky');
        $('#actor-status').textContent = '';
      }));
    }

    const seconds = rig.manifest.animations.find((c) => c.name === clipName)?.duration ?? 2;
    if (name === 'talk') {
      // Chain different speaking gestures for as long as the voice keeps going.
      idleTimer = later(() => { if (token === runToken) animate(talking ? 'talk' : 'idle'); }, Math.max(seconds, 1.5) * 1000);
    } else if (looping) {
      const i = IDLE_CYCLE.findIndex(([key]) => key === name);
      idleTimer = later(() => animate(IDLE_CYCLE[(i + 1) % IDLE_CYCLE.length][0]), 4400);
    } else {
      idleTimer = later(() => { if (token === runToken) animate('idle'); }, seconds * 1000 + 160);
    }
  } catch (error) {
    console.error('Unable to change Sparky animation.', error);
    if (token === runToken && name !== 'idle') animate('idle');
  }
}

// The mouth follows the voice, and while Sparky is calmly idling his whole body gestures along with it.
// Celebrations and "try again" reactions finish first, then he carries on gesturing if the voice is still going.
audio.onSpeechChange((on) => {
  talking = on;
  view?.setSpeech(on);
  if (on && !reducedMotion && IDLE_CYCLE.some(([key]) => key === currentName)) animate('talk');
  else if (!on && currentName === 'talk') animate('idle');
});

$('#character').addEventListener('click', () => {
  rigWanted = true;
  audio.sfx('giggle');
  burst($('#character'), 10);
  animate(['dance', 'laugh', 'jump', 'happy'][Math.floor(Math.random() * 4)]);
});
$('#character').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#character').click(); }
});

/* ==========================================================================
   Building blocks
   ========================================================================== */
const pad = (n) => String(n).padStart(2, '0');

const IMAGE_RETRIES = 2;

/** Keep cards non-interactive until their pictures load; failed downloads expose a retry instead of blank answers. */
function pic(src, cls = '') {
  const img = document.createElement('img');
  img.className = `pic is-loading ${cls}`.trim();
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  const owner = sceneId;
  let tries = 0, timeout, retry, settle;
  const request = () => {
    clearTimeout(timeout);
    img.src = tries ? `${src}${src.includes('?') ? '&' : '?'}retry=${tries}` : src;
    timeout = setTimeout(failed, 20000);
  };
  const failed = () => {
    clearTimeout(timeout);
    if (owner !== sceneId) { settle(false); return; }
    if (tries >= IMAGE_RETRIES) {
      console.warn('Picture unavailable after retries.', src);
      settle(false);
      return;
    }
    tries++;
    retry = setTimeout(request, 600 * tries);
  };
  img.addEventListener('load', () => {
    clearTimeout(timeout);
    clearTimeout(retry);
    img.style.setProperty('--nw', img.naturalWidth);
    img.style.setProperty('--nh', img.naturalHeight);
    img.classList.remove('is-loading');
    settle(true);
    img.ready = Promise.resolve(true);
  });
  img.addEventListener('error', failed);
  img.retry = () => {
    clearTimeout(timeout);
    clearTimeout(retry);
    tries = 0;
    img.classList.add('is-loading');
    img.ready = new Promise((resolve) => { settle = resolve; });
    request();
  };
  img.retry();
  return img;
}

let picsRun = 0;
function whenPicsReady(imgs, fn, auto = 0) {
  const id = sceneId;
  const run = ++picsRun;
  roundReady = false;
  loading.hidden = false;
  loadingMessage.textContent = 'Finding your pictures...';
  retryButton.hidden = true;
  game.setAttribute('aria-busy', 'true');
  syncSuspension();
  Promise.all(imgs.map((img) => img.ready)).then((results) => {
    if (id !== sceneId || run !== picsRun) return;
    if (results.every(Boolean)) {
      retryRound = null;
      fitComparisonImages();
      roundReady = true;
      loading.hidden = true;
      hearButton.disabled = false;
      game.setAttribute('aria-busy', 'false');
      syncSuspension();
      later(() => { if (!resolved) fn(); }, 0);
    } else {
      const retryAll = (attempt) => {
        imgs.forEach((img) => { if (!img.complete || !img.naturalWidth) img.retry(); });
        whenPicsReady(imgs, fn, attempt);
      };
      retryRound = () => retryAll(0);
      if (auto < 1) {
        // Quiet background retries first; the button only appears when they are exhausted.
        loadingMessage.textContent = 'Still finding your pictures...';
        later(() => retryAll(auto + 1), 2500);
        return;
      }
      loadingMessage.textContent = 'Your pictures could not load. Let’s try again.';
      retryButton.hidden = false;
    }

  });
}

function fitComparisonImages() {
  const images = [...stage.querySelectorAll('.art-scaled, .art-long')];
  if (!images.length || images.some((img) => !img.naturalWidth)) return;
  const width = Math.max(...images.map((img) => img.naturalWidth));
  // Source crops are not consistently spaced in length. Explicit ratios keep the answer unambiguous.
  const dimensions = images.map((img) => {
    const w = width * Number(img.dataset.comparisonRatio);
    return { width: w, height: w * img.naturalHeight / img.naturalWidth };
  });
  const height = Math.max(...dimensions.map((size) => size.height));
  const scale = Math.min(...images.map((img) => Math.min(
    img.parentElement.clientWidth * .78 / width,
    img.parentElement.clientHeight * .8 / height,
  )));
  images.forEach((img, i) => {
    img.style.width = `${dimensions[i].width * scale}px`;
    img.style.height = `${dimensions[i].height * scale}px`;
  });
}
addEventListener('resize', () => requestAnimationFrame(() => {
  fitComparisonImages();
  resetBalloonLayout?.();
}));

const objectSrc = (key, n) => `./assets/objects/pics/${pad((n % ASSET_COUNT) + 1)}.webp`;

/** A white answer card with the little "?" help button in its corner. */
function card({ section, extra = '', onPick, label }) {
  const el = document.createElement('div');
  el.className = `card ${extra}`.trim();
  el.tabIndex = 0;
  if (onPick) {
    el.setAttribute('role', 'button');
    if (label) el.setAttribute('aria-label', label);
    el.addEventListener('click', () => onPick(el));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(el); }
    });
  }
  const hint = document.createElement('button');
  hint.type = 'button';
  hint.className = 'hint';
  hint.setAttribute('aria-label', 'Hear the question again');
  hint.textContent = '?';
  hint.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.sfx('tap');
    speak(audio.pick(DIALOGUES[section]?.guide));
    touched(section);
  });
  el.append(hint);
  return el;
}

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ==========================================================================
   Splash
   ========================================================================== */
function showSplash() {
  newScene('splash');
  setTitle("Sparky's Carnival");
  // Stacked wordmark: letters are separate spans so each can carry its own carnival colour.
  ribbon.setAttribute('aria-label', "Sparky's Carnival");
  ribbon.innerHTML = `<span class="word word-top" aria-hidden="true">Sparky's</span><span class="word word-bottom" aria-hidden="true">${
    [...'Carnival'].map((letter, i) => `<span style="--i:${i}">${letter}</span>`).join('')}</span>`;
  stage.classList.add('is-splash');
  instruction.textContent = 'Little games. Big discoveries.';
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'play-pill';
  play.setAttribute('aria-label', 'Play');
  play.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="ic" d="M15 8v32l26-16z"/></svg><span>Play</span>';
  play.addEventListener('click', () => {
    if (play.classList.contains('is-pressed')) return;
    play.classList.add('is-pressed');
    audio.unlock();
    audio.sfx('success');
    audio.startMusic();
    animate('happy');
    later(() => { skillIndex = 0; starsWon = 0; starCountEl.textContent = '0'; startSkill(); }, 380);
  });
  stage.append(play, menuGames());
  animate('welcome');
}

const MENU_GAMES = [
  ['different', 'Odd one', '<circle cx="14" cy="14" r="8" fill="#3aaef2"/><circle cx="34" cy="14" r="8" fill="#3aaef2"/><circle cx="14" cy="34" r="8" fill="#3aaef2"/><path d="m34 25 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2-4.5-4.4 6.2-.9z" fill="#ff9a2e" stroke="#c9671a" stroke-width="1.5" stroke-linejoin="round"/>'],
  ['biggest', 'Biggest', '<circle cx="19" cy="27" r="15" fill="#ff5c8a"/><circle cx="39" cy="36" r="7" fill="#ffc52e"/><circle cx="14" cy="21" r="4" fill="#fff" opacity=".5"/>'],
  ['more', 'Which more', '<g fill="#3fc96b"><circle cx="9" cy="14" r="4.5"/><circle cx="21" cy="14" r="4.5"/><circle cx="9" cy="27" r="4.5"/><circle cx="21" cy="27" r="4.5"/><circle cx="15" cy="39" r="4.5"/></g><g fill="#a45cf0"><circle cx="37" cy="24" r="4.5"/><circle cx="37" cy="36" r="4.5"/></g>'],
  ['longest', 'Longest', '<rect x="6" y="10" width="14" height="8" rx="4" fill="#ff9a2e"/><rect x="6" y="21" width="26" height="8" rx="4" fill="#3aaef2"/><rect x="6" y="32" width="38" height="8" rx="4" fill="#3fc96b"/>'],
  ['shapes', 'Shapes', '<path d="M13 9 25 31H1z" fill="#ffc52e" stroke="#c98d00" stroke-width="1.5" stroke-linejoin="round"/><rect x="27" y="19" width="17" height="17" rx="4" fill="#ff5c8a"/><circle cx="14" cy="40" r="5" fill="#3aaef2"/>'],
];

/** One tile per game so a child (or parent) can jump straight in. */
function menuGames() {
  const row = document.createElement('div');
  row.className = 'menu-games';
  MENU_GAMES.forEach(([key, label, art]) => {
    const index = SKILLS.findIndex((s) => s.key === key);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'menu-chip';
    chip.setAttribute('aria-label', `Play ${SKILLS[index].title}`);
    chip.innerHTML = `<span class="menu-icon"><svg viewBox="0 0 48 48" aria-hidden="true">${art}</svg></span><span class="menu-label">${label}</span>`;
    chip.addEventListener('click', () => {
      audio.unlock();
      audio.sfx('success');
      audio.startMusic();
      skillIndex = index;
      startSkill();
    });
    row.append(chip);
  });
  return row;
}

/* ==========================================================================
   Learning games
   ========================================================================== */
function startSkill() {
  const skill = SKILLS[skillIndex];
  newScene('play', skill.theme);
  setTitle(skill.title);
  currentSection = skill.key;
  instruction.textContent = skill.instruction;
  animate('idle');
  // pre-fetch the next game's voice lines so the hand-over is instant
  const next = SKILLS[(skillIndex + 1) % SKILLS.length].key;
  audio.warm([...(DIALOGUES[next]?.intro || [])]);

  if (skill.key === 'shapes') return renderShapes(skill);
  if (skill.key === 'more') return renderMore(skill);
  return renderChoices(skill);
}

/* ---------- endless question generator ----------
   Every round is rolled fresh from many parts, and the last few rounds are
   remembered so the same question never comes round twice in a row. */
const rand = (n) => Math.floor(Math.random() * n);
const recent = {};

function fresh(skill, make) {
  const seen = (recent[skill] ??= []);
  let round;
  for (let i = 0; i < 20; i++) {
    round = make();
    if (!seen.includes(round.key)) break;
  }
  seen.push(round.key);
  if (seen.length > 10) seen.shift();
  return round;
}

/** Sorted values from 0..max that are at least `gap` apart, so every size/length is clearly different. */
function spacedPicks(max, count, gap) {
  for (;;) {
    const picked = new Set();
    while (picked.size < count) picked.add(rand(max + 1));
    const a = [...picked].sort((x, y) => x - y);
    if (a.every((v, i) => !i || v - a[i - 1] >= gap)) return a;
  }
}

/* Which "different" pictures are the same kind of thing (index = position in the art sheet).
   The odd one out is always a different kind, so it can never be confused with the others. */
const KINDS = [
  [0, 8, 13, 20, 29, 33, 36], [1, 14, 24], [2, 15, 25, 30, 37], [3, 26, 39], [4, 34], [5, 22],
  [6, 16, 28, 38], [7, 19], [9, 35], [10, 27], [11, 31], [12, 23, 32], [17], [18], [21],
];
const kindOf = new Map();
KINDS.forEach((list, k) => list.forEach((n) => kindOf.set(n, k)));

function makeOptions(skill) {
  if (skill.key === 'different') {
    const r = fresh('different', () => {
      const common = rand(ASSET_COUNT);
      let odd;
      do { odd = rand(ASSET_COUNT); } while (kindOf.get(odd) === kindOf.get(common));
      return { key: `${common}-${odd}`, common, odd, at: rand(4) };
    });
    return {
      items: Array.from({ length: 4 }, (_, i) => ({ src: objectSrc('items', i === r.at ? r.odd : r.common), correct: i === r.at })),
      shuffle: false,
    };
  }
  if (skill.key === 'biggest') {
    const r = fresh('biggest', () => {
      const row = rand(ASSET_COUNT);
      const sizes = spacedPicks(7, 4, 2);
      return { key: `${row}-${sizes}`, row, sizes };
    });
    return {
      items: r.sizes.map((size, i) => ({
        src: `./assets/objects/pics/${pad(r.row + 1)}.webp`,
        correct: i === 3, comparisonRatio: [.38, .56, .74, 1][i],
      })),
      shuffle: true,
    };
  }
  const r = fresh('longest', () => {
    // Pencil, brush, ribbon, rope and crayon read as "long"; the train and curly ribbon do not.
    const band = [1, 2, 3, 5, 7][rand(5)];
    const lens = spacedPicks(7, 4, 2);
    return { key: `${band}-${lens}`, band, lens };
  });
  return {
    items: r.lens.map((len, i) => ({
      src: `./assets/objects/long/${r.band}.webp`,
      correct: i === 3, comparisonRatio: [.38, .56, .74, 1][i],
    })),
    shuffle: true,
  };
}

function renderChoices(skill) {
  const section = skill.key;
  const { items, shuffle } = makeOptions(skill);
  const list = shuffle ? shuffled(items) : items;
  const hue = section === 'biggest' ? rand(6) * 60 : 0;
  stage.classList.add(section === 'different' ? 'grid-4' : 'grid-2x2');
  if (section === 'longest') stage.classList.add('is-longest');
  audio.warm(DIALOGUES[section]?.intro);

  const imgs = [];
  list.forEach((item, i) => {
    const el = card({
      section,
      label: `Choice ${i + 1}`,
      onPick: (c) => answer(section, item.correct, c),
    });
    const cls = section === 'different' ? 'art-fit' : section === 'biggest' ? 'art-scaled' : 'art-long';
    const img = pic(item.src, cls);
    if (hue) img.style.filter = `hue-rotate(${hue}deg)`;
    if (item.comparisonRatio) img.dataset.comparisonRatio = item.comparisonRatio;
    imgs.push(img);
    el.append(img);
    el.style.setProperty('--i', i);
    stage.append(el);
  });
  whenPicsReady(imgs, () => introduce(section));
}

function renderMore(skill) {
  const section = 'more';
  const round = fresh('more', () => {
    const item = rand(ASSET_COUNT);
    const small = 2 + rand(6);                  // 2-7
    const big = small + 2 + rand(3);            // always at least 2 more, never above 11
    return { key: `${item}-${small}-${big}`, item, small, big, bigSide: rand(2), hue: rand(6) * 60 };
  });
  const bigSide = round.bigSide;
  const counts = bigSide === 0 ? [round.big, round.small] : [round.small, round.big];
  stage.classList.add('grid-2');
  audio.warm(DIALOGUES[section]?.intro);
  const imgs = [];

  counts.forEach((count, side) => {
    const el = card({
      section,
      label: `${count} things`,
      onPick: (c) => answer(section, side === bigSide, c),
    });
    el.style.setProperty('--i', side);
    const pile = document.createElement('div');
    pile.className = 'pile';
    pile.style.filter = `hue-rotate(${round.hue}deg)`;
    const columns = round.big > 6 ? 3 : 2;
    pile.style.setProperty('--columns', columns);
    pile.style.setProperty('--rows', Math.ceil(round.big / columns));
    for (let i = 0; i < count; i++) {
      const img = pic(objectSrc('items', round.item), 'pile-item');
      imgs.push(img);
      pile.append(img);
    }
    el.append(pile);
    stage.append(el);
  });
  whenPicsReady(imgs, () => introduce(section));
}

function answer(section, correct, el) {
  if (resolved || suspended() || !roundReady) return;
  audio.unlock();
  if (!correct) {
    audio.sfx('wrong');
    el.classList.remove('wrong');
    void el.offsetWidth;
    el.classList.add('wrong');
    animate('try');
    tell('Not quite. Have another look!', 'retry');
    cheerUp(section);
    touched(section);
    return;
  }
  resolved = true;
  clock.clear(nudgeTimer);
  audio.stopSpeech();
  audio.sfx('success');
  el.classList.add('correct');
  stage.classList.add('has-answer');
  burst(el, 18);
  animate('happy');
  addStar();
  tell('You found it! Ready for the next game?', 'success');
  later(() => {
    audio.sfx('fanfare');
    showNext(advance, 'Next game');
  }, PRAISE_DELAY);
}

function advance() {
  audio.sfx('transition');
  skillIndex = (skillIndex + 1) % SKILLS.length;
  if (skillIndex === 2) return showMystery();
  if (skillIndex === 4) return showBalloons();
  startSkill();
}

/* ==========================================================================
   Match the shapes - drag a shape from the tray onto the toy it belongs to
   ========================================================================== */
const SHAPES = [
  { name: 'circle',    file: 'shape-circle.svg' },
  { name: 'triangle',  file: 'shape-triangle.svg' },
  { name: 'square',    file: 'shape-square.svg' },
  { name: 'star',      file: 'shape-star.svg' },
  { name: 'heart',     file: 'shape-heart.svg' },
  { name: 'diamond',   file: 'shape-diamond.svg' },
  { name: 'oval',      file: 'shape-oval.svg' },
  { name: 'moon',      file: 'shape-moon.svg' },
  { name: 'rectangle', file: 'shape-rectangle.svg' },
  { name: 'pentagon',  file: 'shape-pentagon.svg' },
  { name: 'hexagon',   file: 'shape-hexagon.svg' },
  { name: 'octagon',   file: 'shape-octagon.svg' },
];
// Pentagon, hexagon and octagon look alike to young children, so a round never asks for more than one of them.
const LOOKALIKES = new Set([9, 10, 11]);
// Which pictures in assets/objects/shapes are which shape, as 0-based picture numbers (picture n is file n+1.webp). Same order as SHAPES.
// Pictures 0-39 come from the original art sheet (9 per row: circle oval triangle square rectangle diamond heart star moon);
// 40-51 are drawn by scripts/make-shape-art.mjs.
const SHAPE_FILES = ['circle', 'triangle', 'square', 'star', 'heart', 'diamond', 'oval', 'moon', 'rectangle', 'pentagon', 'hexagon', 'octagon'];
const shapePictureSrc = (shape) => `./assets/objects/shapes/${SHAPE_FILES[shape]}.webp`;

function renderShapes(skill) {
  const section = 'shapes';
  const round = fresh('shapes', () => {
    const order = shuffled(SHAPES.map((_, index) => index));
    const targets = [];
    for (const shape of order) {
      if (targets.length < 4 && !(LOOKALIKES.has(shape) && targets.some((t) => LOOKALIKES.has(t)))) targets.push(shape);
    }
    return {
      key: `${[...targets].sort((a, b) => a - b).join('-')}`,
      targets, extra: order.find((s) => !targets.includes(s)),
    };
  });
  const { targets, extra } = round;                          // one spare piece in the tray
  const tray = shuffled([...targets, extra]);
  let matched = 0;
  let held = null;                                           // tapped (not dragged) piece
  const misses = new Map();

  stage.classList.add('is-shapes');
  const board = document.createElement('div');
  board.className = 'shape-board';
  const trayEl = document.createElement('div');
  trayEl.className = 'shape-tray';
  stage.append(board, trayEl);

  const slots = new Map();
  const imgs = [];
  shuffled(targets).forEach((shape, i) => {
    const el = card({ section, extra: 'shape-card' });
    el.style.setProperty('--i', i);
    const image = pic(shapePictureSrc(shape), 'toy');
    imgs.push(image);
    el.append(image);
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'slot';
    slot.setAttribute('aria-label', `Match the ${SHAPES[shape].name} picture`);
    slot.dataset.shape = shape;
    slot.innerHTML = '<span>?</span>';
    slot.addEventListener('click', () => { if (held) place(held, slot); });
    el.append(slot);
    board.append(el);
    slots.set(shape, slot);
  });

  function hintSlot(shape, on) {
    slots.forEach((s, k) => s.classList.toggle('glow', on && k === shape && !s.classList.contains('filled')));
  }

  function place(piece, slot) {
    if (suspended() || !roundReady) return;
    const shape = Number(piece.dataset.shape);
    if (slot.classList.contains('filled') || piece.classList.contains('done')) return;
    touched(section);
    if (Number(slot.dataset.shape) !== shape) {
      audio.sfx('wrong');
      slot.classList.remove('bump');
      void slot.offsetWidth;
      slot.classList.add('bump');
      animate('try');
      tell('Try a different space.', 'retry');
      cheerUp(section);
      const m = (misses.get(shape) || 0) + 1;
      misses.set(shape, m);
      if (m >= 2) hintSlot(shape, true);         // after two misses, show where it goes
      return;
    }
    audio.sfx('match');
    burst(slot, 14);
    piece.classList.add('done');
    piece.classList.remove('selected', 'dragging');
    piece.setAttribute('aria-pressed', 'false');
    piece.style.transform = '';
    held = null;
    hintSlot(shape, false);
    slot.classList.add('filled');
    slot.disabled = true;
    slot.setAttribute('aria-label', `${SHAPES[shape].name} matched`);
    slot.classList.remove('glow');
    slot.textContent = '';
    slot.append(pic(`./assets/shapes/${SHAPES[shape].file}`, 'placed'));
    slot.insertAdjacentHTML('beforeend', '<svg class="tick" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#2fc455" stroke="#fff" stroke-width="4"/><path d="m14 25 7 7 14-16" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    matched++;
    tell(`${matched} of 4 shapes matched. Nice work!`, 'success');

    if (matched < 4) {
      speak(audio.pick(DIALOGUES.shapes.matchSingle), { delay: 250 });
      animate('happy');
    } else {
      resolved = true;
      clock.clear(nudgeTimer);
      addStar();
      audio.sfx('fanfare');
      burst(stage, 26);
      speak(DIALOGUES.shapes.matchAll[0], { delay: 500 });
      animate('jump');
      tell('All the shapes match! Well done.', 'success');
      later(() => showNext(advance, 'Next game'), 1100);
    }
  }

  tray.forEach((shape) => {
    const piece = document.createElement('div');
    piece.className = 'tray-piece';
    piece.dataset.shape = shape;
    piece.setAttribute('role', 'button');
    piece.tabIndex = 0;
    piece.setAttribute('aria-label', `${SHAPES[shape].name} shape`);
    const image = pic(`./assets/shapes/${SHAPES[shape].file}`);
    imgs.push(image);
    piece.append(image);
    const selectPiece = () => {
      if (piece.classList.contains('done') || suspended() || !roundReady) return;
      audio.sfx('tap');
      held = held === piece ? null : piece;
      trayEl.querySelectorAll('.tray-piece').forEach((p) => {
        p.classList.toggle('selected', p === held);
        p.setAttribute('aria-pressed', String(p === held));
      });
      tell(held ? `Now tap the matching ${SHAPES[shape].name} picture.` : 'Pick a shape to match.');
      touched(section);
    };
    piece.setAttribute('aria-pressed', 'false');
    piece.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPiece(); }
    });
    makeDraggable(piece, {
      slots: () => [...slots.values()],
      onTap: selectPiece,
      onDrop: (slot) => (slot ? place(piece, slot) : null),
      onLift: () => {
        held = null;
        trayEl.querySelectorAll('.selected').forEach((p) => {
          p.classList.remove('selected');
          p.setAttribute('aria-pressed', 'false');
        });
        audio.sfx('whoosh');
      },
    });
    trayEl.append(piece);
  });

  whenPicsReady(imgs, () => introduce(section));
}

/** Pointer-based dragging so it works the same with a finger or a mouse. */
function makeDraggable(el, { slots, onTap, onDrop, onLift }) {
  el.addEventListener('pointerdown', (e) => {
    if (resolved || suspended() || !roundReady || el.classList.contains('done')) return;
    audio.unlock();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    el.setPointerCapture(e.pointerId);

    const move = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > 10) {
        dragging = true;
        el.classList.add('dragging');
        onLift?.();
      }
      if (dragging) el.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`;
    };
    const end = (ev) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      if (ev.type === 'pointercancel' || suspended()) {
        el.classList.remove('dragging');
        el.style.transform = '';
        return;
      }
      if (!dragging) return onTap?.();
      el.classList.remove('dragging');
      const target = slots().find((s) => {
        const r = s.getBoundingClientRect();
        const pad = r.width * 0.25;          // forgiving drop zone for little fingers
        return ev.clientX > r.left - pad && ev.clientX < r.right + pad && ev.clientY > r.top - pad && ev.clientY < r.bottom + pad;
      });
      el.style.transform = '';               // springs home via CSS transition unless placed
      onDrop?.(target || null);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });
}

/* ==========================================================================
   Bonus: mystery boxes
   ========================================================================== */
function showMystery() {
  newScene('play', 'candy');
  setTitle('A little surprise');
  instruction.textContent = 'Pick a mystery box. What could be inside?';
  animate('idle');
  stage.classList.add('grid-3');
  const section = 'mystery';
  currentSection = section;
  const imgs = [];

  [0, 1, 2].forEach((i) => {
    const el = card({
      section,
      label: `Mystery box ${i + 1}`,
      extra: 'box-card',
      onPick: (c) => {
        if (resolved || suspended() || !roundReady) return;
        resolved = true;
        clock.clear(nudgeTimer);
        audio.stopSpeech();
        addStar();
        audio.sfx('fanfare');
        burst(c, 24);
        c.classList.add('open', 'correct');
        stage.classList.add('has-answer');
        c.querySelector('.pic').src = './assets/mystery-box-open.svg';
        c.append(pic(objectSrc('items', rand(ASSET_COUNT)), 'prize'));
        animate('wow');
        tell('A surprise just for you!', 'success');
        speak(DIALOGUES.mystery.prize[0], { delay: 400 });
        later(() => showNext(() => { audio.sfx('transition'); startSkill(); }, 'Next game'), 1200);
      },
    });
    el.style.setProperty('--i', i);
    const image = pic('./assets/mystery-box.svg', 'art-fit');
    imgs.push(image);
    el.append(image);
    stage.append(el);
  });
  whenPicsReady(imgs, () => introduce(section));
}

/* ==========================================================================
   Bonus: balloons
   ========================================================================== */
function showBalloons() {
  newScene('play', 'meadow');
  setTitle('Pop the balloons');
  instruction.textContent = 'Tap 5 balloons. Pop, pop, pop!';
  animate('idle');
  stage.classList.add('is-balloons');
  const section = 'balloons';
  currentSection = section;
  game.dataset.section = section;
  const GOAL = 5;
  let popped = 0;
  const balloonImages = Array.from({ length: 7 }, (_, i) =>
    pic(`./assets/balloons/${pad(i + 1)}.svg`, 'balloon-art'));

  const sky = document.createElement('div');
  sky.className = 'balloon-sky';
  const stars = document.createElement('div');
  stars.className = 'star-row';
  stars.innerHTML = Array.from({ length: GOAL }, () =>
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 5 5.6 12.2 13.4 1.4-10 9 2.9 13.2L24 34 12.1 40.8 15 27.6l-10-9 13.4-1.4z"/></svg>').join('');
  stage.append(sky);
  document.querySelector('.board-heading').append(stars);

  let spawnTimer = null;
  function spawn(seedDelay = 0) {
    if (resolved) return;
    const active = [...sky.querySelectorAll('.balloon')];
    const maxWidth = Math.max(52, Math.min(150, game.clientHeight * .19));
    // Reserve the entire pop expansion plus sway and a clear gap between lanes.
    const laneCount = Math.max(1, Math.min(6, Math.floor(sky.clientWidth / (maxWidth * 1.3 + 24))));
    if (active.length < laneCount * 2) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'balloon';
      b.setAttribute('aria-label', 'Balloon');
      // small / medium / large tiers with slight jitter, so sizes are clearly different
      const tier = rand(3);
      const width = Math.max(48, maxWidth * [.68, .84, 1][tier] * (0.95 + Math.random() * 0.1));
      b.style.setProperty('--w', `${width}px`);
      // A lane is free again once its last balloon has risen past the lower half of the sky.
      const skyBox = sky.getBoundingClientRect();
      const occupied = new Set(active.filter((balloon) => seedDelay || balloon.getBoundingClientRect().top - skyBox.top > skyBox.height * .5)
        .map((balloon) => Number(balloon.dataset.lane)));
      const available = Array.from({ length: laneCount }, (_, i) => i).filter((i) => !occupied.has(i));
      if (!available.length) { if (!seedDelay && !resolved) spawnTimer = later(spawn, 400); return; }
      const lane = available[rand(available.length)];
      b.dataset.lane = String(lane);
      b.style.setProperty('--x', `${(lane + .5) * 100 / laneCount}%`);
      b.style.setProperty('--lift', `${sky.clientHeight * .8}px`);
      b.style.setProperty('--drift', '0px');
      b.style.setProperty('--time', `${(10 + Math.random() * 3) * [.82, .92, 1][tier]}s`);
      b.style.setProperty('--sway-time', `${2.8 + Math.random() * 1.6}s`);
      if (seedDelay) b.style.animationDelay = `-${seedDelay}s`;
      b.style.setProperty('--sway-delay', `${-Math.random() * 3}s`);
      b.style.setProperty('--rest-y', `${40 + (lane % 3) * 16}%`);
      const art = balloonImages[rand(balloonImages.length)].cloneNode();
      b.append(art);
      b.addEventListener('animationend', (e) => {
        if (e.animationName === 'rise' || e.animationName === 'balloonBurst') b.remove();
      });
      b.addEventListener('click', () => {
        audio.unlock();
        if (b.classList.contains('popped') || resolved || suspended() || !roundReady) return;
        b.classList.add('popped');
        popped++;
        instruction.textContent = `${popped} of ${GOAL} balloons popped!`;
        tell(`${popped} of ${GOAL} balloons popped!`, 'success');
        audio.sfx('pop', popped);
        burst(b, 18);
        popFx(b);
        const slot = stars.children[popped - 1];
        if (slot) slot.classList.add('on');
        animate('happy');
        touched(section);
        if (popped === 2 || popped === 4) speak(audio.pick(DIALOGUES.balloons.guide), { delay: 200 });
        if (popped >= GOAL) {
          resolved = true;
          clock.clear(nudgeTimer);
          addStar();
          later(() => {
            audio.sfx('fanfare');
            burst(stars, 26);
            animate('jump');
            tell('You popped them all! Let’s keep playing.', 'success');
            instruction.textContent = 'You popped them all! Let’s keep playing.';
            speak(DIALOGUES.balloons.allPopped[0], { delay: 300 });
            showNext(() => { audio.sfx('transition'); startSkill(); }, 'Next game');
          }, 400);
        }
      });
      sky.append(b);
    }
    if (!seedDelay && !resolved) spawnTimer = later(spawn, 650);
  }
  resetBalloonLayout = () => {
    clock.clear(spawnTimer);
    sky.replaceChildren();
    if (roundReady && !resolved) { [5, 3, 1.5].forEach((d) => spawn(d)); spawn(); }
  };
  whenPicsReady(balloonImages, () => {
    [5, 3, 1.5].forEach((d) => spawn(d));
    spawn();
    introduce(section);
  });
}

/* ==========================================================================
   Shared controls
   ========================================================================== */
const soundBtn = $('#btn-sound');
soundBtn.addEventListener('click', () => {
  audio.unlock();
  const on = !audio.isEnabled();
  audio.setEnabled(on);
  soundBtn.classList.toggle('is-off', !on);
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  if (on) { audio.sfx('tap'); audio.startMusic(); }
});

function openPause() {
  pausedByUser = true;
  pauseDialog.showModal();
  syncSuspension();
}
function closePause() {
  pausedByUser = false;
  pauseDialog.close();
  syncSuspension();
}
btnPause.addEventListener('click', openPause);
pauseDialog.addEventListener('close', () => {
  if (!portrait.matches && !pauseDialog.open) pausedByUser = false;
  syncSuspension();
});
pauseDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closePause();
});
$('#btn-resume').addEventListener('click', closePause);
$('#btn-start').addEventListener('click', () => {
  closePause();
  showSplash();
});
retryButton.addEventListener('click', () => retryRound?.());
// Browsers only allow sound after a first tap, so start the music on whatever the player touches first.
['pointerdown', 'keydown'].forEach((type) => addEventListener(type, () => {
  audio.unlock();
  audio.startMusic();
}, { once: true, capture: true }));
addEventListener('online', () => retryRound?.());
hearButton.addEventListener('click', () => {
  if (!currentSection || !roundReady || suspended()) return;
  audio.unlock();
  if (!audio.isEnabled()) {
    tell('Sound is off. Tap the sound button to hear the question.');
    return;
  }
  speak(DIALOGUES[currentSection]?.intro?.[0]);
});
portrait.addEventListener('change', () => {
  if (portrait.matches && pauseDialog.open) pauseDialog.close();
  else if (!portrait.matches && pausedByUser && !pauseDialog.open) pauseDialog.showModal();
  syncSuspension();
});
document.addEventListener('visibilitychange', syncSuspension);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !pauseDialog.open && !portrait.matches) {
    openPause();
  }
});

btnNext.addEventListener('click', () => {
  audio.unlock();
  if (suspended() || !roundReady) return;
  const go = onNext;
  if (!go) return;
  btnNext.hidden = true;
  go();
});

document.addEventListener('pointerdown', () => audio.unlock(), { once: true, capture: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('pagehide', (event) => {
  audio.setPaused(true);
  clock.setPaused(true);
  rig?.setPaused(true);
  if (!event.persisted) rig?.destroy();
});
window.addEventListener('pageshow', syncSuspension);

/* ==========================================================================
   Offline cache + idle-time prefetch
   ========================================================================== */
if ('serviceWorker' in navigator) {
  const register = () => navigator.serviceWorker.register('./sw.js').catch((error) => {
    console.warn('Offline cache unavailable; normal network loading remains active.', error);
  });
  if (document.readyState === 'complete') register();
  else addEventListener('load', register, { once: true });
}

/** Quietly download every picture and voice clip, one or two at a time, once Sparky has loaded. */
async function prefetchEverything() {
  const link = navigator.connection;
  if (link?.saveData || /(^|-)[23]g$/.test(link?.effectiveType || '') || (link?.downlink && link.downlink < 1.5)) return;
  let list;
  try {
    const response = await fetch('./assets/preload.json');
    if (!response.ok) throw new Error(`Asset list HTTP ${response.status}`);
    list = await response.json();
  } catch (error) {
    console.warn('Background asset list unavailable.', error);
    return;
  }
  const urls = [...list.images, ...list.audio];
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      if (suspended() || !roundReady) { await wait(2000); continue; }
      try {
        const res = await fetch(urls[next++], { priority: 'low' });
        if (!res.ok) throw new Error(`Prefetch HTTP ${res.status}`);
        await res.arrayBuffer();
      } catch (error) {
        console.warn('Optional prefetch failed; assets will retry when needed.', error);
        await wait(1500);
      }
    }
  };
  await Promise.all([worker(), worker()]);
}
loadRig().then(() => wait(1500)).then(prefetchEverything);

/* ==========================================================================
   Start
   ========================================================================== */
const params = new URLSearchParams(location.search);
const wantSkill = SKILLS.findIndex((s) => s.key === params.get('skill'));
if (params.get('mini') === 'mystery') showMystery();
else if (params.get('mini') === 'balloons') showBalloons();
else if (wantSkill >= 0) { skillIndex = wantSkill; startSkill(); }
else showSplash();
syncSuspension();
