import { SpriteSheetPlayer } from './player.js';
import { DIALOGUES } from './dialogues.js';

const SKILLS = [
  { key: 'different', label: 'Different One', title: 'Find the different one!', subtitle: 'Three match! One is a little different.', guide: "Can you spot the one that's different?" },
  { key: 'biggest', label: 'Biggest One', title: 'Which one is biggest?', subtitle: 'Look closely, then tap the giant one!', guide: 'Find the biggest one!' },
  { key: 'more', label: 'Which Has More', title: 'Which group has MORE?', subtitle: 'Count each toy group and tap the bigger pile!', guide: "Let's count together!" },
  { key: 'longest', label: 'Longest One', title: 'Which one is the longest?', subtitle: 'Tap the one that stretches the farthest!', guide: 'Find the longest one!' },
  { key: 'shapes', label: 'Match the Shapes', title: 'Match the shapes!', subtitle: 'Tap a toy, then tap its matching shape space!', guide: 'Tap a toy, then find its shape!' }
];

const ASSET_COUNT = 40;
const $ = (s) => document.querySelector(s);
const panel = $('#content-panel'), speech = $('#speech'), feedback = $('#feedback');
const starCountEl = $('#star-count');

const bank = SKILLS.map((_, skill) => 
  Array.from({ length: ASSET_COUNT }, (_, i) => ({
    id: `${SKILLS[skill].key}-${String(i + 1).padStart(2, '0')}`,
    index: i,
    seed: (i * 17 + skill * 11) % 40
  }))
);

let skillIndex = 0;
let mini = null;
let resolved = false;
let shapeMatches = 0;
let popped = 0;
let soundOn = true;
let player = null;
let runToken = 0;
let audioCtx = null;
let masterGain = null;
let idleCycleTimer = null;
let idleCycleIndex = 0;
let counters = SKILLS.map(() => 0);
let timeoutIds = [];
let starsWon = 0;
let selectedPiece = null;
let bgMusicTimer = null;
let bgMusicStep = 0;

/* ==========================================================================
   AUDIO ENGINE — Hindi/Hinglish MP3 Dialogue Playback
   ========================================================================== */
let activeDialogue = null;

function playDialogue(src) {
  if (!soundOn) return;
  try {
    stopDialogue();
    const audio = new Audio(src);
    activeDialogue = audio;
    audio.addEventListener('play', () => { getAudio(); }, { once: true });
    audio.play().catch(() => {});
  } catch (err) {
    // Missing file or autoplay blocked — never crash the game
  }
}

function stopDialogue() {
  try {
    if (activeDialogue) {
      activeDialogue.pause();
      activeDialogue = null;
    }
  } catch (err) {}
}

function pickRandom(arr) {
  if (!arr || !arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function scheduleGuide(section, delayMs) {
  later(() => {
    if (resolved) return;
    try {
      const clip = pickRandom(DIALOGUES[section]?.guide);
      if (clip) playDialogue(clip);
    } catch (err) {}
  }, delayMs);
}

function clearTimers() {
  timeoutIds.forEach(clearTimeout);
  timeoutIds = [];
}

function later(fn, ms) {
  const id = setTimeout(fn, ms);
  timeoutIds.push(id);
  return id;
}

/* ==========================================================================
   WEB AUDIO TODDLER SOUND SYNTHESIZER (WARM MARIMBA / XYLOPHONE / CHIMES)
   ========================================================================== */
function getAudio() {
  if (!soundOn) return null;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    audioCtx ??= new Audio();
    if (!masterGain) {
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.85;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Play a warm wooden marimba tone with harmonic overtone */
function playMarimba(hz, delay = 0, duration = 0.22, volume = 0.08) {
  const ctx = getAudio();
  if (!ctx) return;
  const start = ctx.currentTime + delay;

  // Fundamental note
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(hz, start);

  gain1.gain.setValueAtTime(0.0001, start);
  gain1.gain.linearRampToValueAtTime(volume, start + 0.008);
  gain1.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc1.connect(gain1);
  gain1.connect(masterGain);
  osc1.start(start);
  osc1.stop(start + duration + 0.02);

  // Marimba wooden overtone (approx 3.9x fundamental)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(hz * 3.9, start);

  gain2.gain.setValueAtTime(0.0001, start);
  gain2.gain.linearRampToValueAtTime(volume * 0.35, start + 0.004);
  gain2.gain.exponentialRampToValueAtTime(0.0001, start + (duration * 0.45));

  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc2.start(start);
  osc2.stop(start + duration + 0.02);
}

/** Play a sparkling bell / glockenspiel chime */
function playChime(hz, delay = 0, duration = 0.35, volume = 0.07) {
  const ctx = getAudio();
  if (!ctx) return;
  const start = ctx.currentTime + delay;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(hz, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playSfx(kind = 'tap') {
  const ctx = getAudio();
  if (!ctx) return;

  if (kind === 'tap') {
    // Warm marimba pop
    const notes = [523.25, 587.33, 659.25, 783.99, 880];
    const pick = notes[Math.floor(Math.random() * notes.length)];
    playMarimba(pick, 0, 0.16, 0.07);
  } 
  else if (kind === 'success') {
    // Joyful rising xylophone arpeggio (C5 -> E5 -> G5 -> C6)
    [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => {
      playMarimba(hz, i * 0.07, 0.25, 0.09);
      playChime(hz * 2, i * 0.07 + 0.02, 0.22, 0.04);
    });
  } 
  else if (kind === 'wrong') {
    // Gentle cartoon spring wobble (encouraging, never harsh)
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.22);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  } 
  else if (kind === 'match') {
    // Sweet double ding
    playMarimba(659.25, 0, 0.2, 0.07);
    playMarimba(880, 0.08, 0.28, 0.08);
    playChime(1318.5, 0.08, 0.32, 0.04);
  } 
  else if (kind === 'prize' || kind === 'fanfare') {
    // Triumphant preschool celebration melody!
    const tune = [
      { hz: 523.25, t: 0 },
      { hz: 659.25, t: 0.08 },
      { hz: 783.99, t: 0.16 },
      { hz: 1046.5, t: 0.24 },
      { hz: 1318.5, t: 0.36 },
      { hz: 1567.98, t: 0.48 }
    ];
    tune.forEach(n => {
      playMarimba(n.hz, n.t, 0.35, 0.09);
      playChime(n.hz, n.t + 0.02, 0.4, 0.05);
    });
  } 
  else if (kind === 'transition') {
    playMarimba(587.33, 0, 0.18, 0.06);
    playMarimba(880, 0.09, 0.24, 0.07);
  } 
  else if (kind === 'giggle') {
    // Playful giggly high marimba notes
    [880, 1046.5, 880, 1174.66, 1318.5].forEach((hz, i) => {
      playMarimba(hz, i * 0.05, 0.12, 0.06);
    });
  }
  else if (kind === 'pop') {
    // Bubbly soap pop
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }
}

/** Gentle preschool background marimba groove */
function stepBackgroundMusic() {
  if (!soundOn) return;
  const ctx = getAudio();
  if (!ctx || ctx.state === 'suspended') return;

  // C major nursery lullaby progression
  const melody = [
    523.25, null, 659.25, null, 783.99, null, 659.25, null,
    523.25, 523.25, 659.25, 783.99, 1046.5, null, null, null,
    880, null, 1046.5, null, 783.99, null, 659.25, null,
    587.33, null, 659.25, null, 523.25, null, null, null
  ];

  const note = melody[bgMusicStep % melody.length];
  if (note) {
    playMarimba(note, 0, 0.28, 0.022);
  }
  bgMusicStep++;
  bgMusicTimer = setTimeout(stepBackgroundMusic, 420);
}

function startBgMusic() {
  clearTimeout(bgMusicTimer);
  if (soundOn) {
    bgMusicTimer = setTimeout(stepBackgroundMusic, 600);
  }
}

function stopBgMusic() {
  clearTimeout(bgMusicTimer);
}

/* ==========================================================================
   VISUAL EFFECTS: SPARKLE & STAR BURSTS
   ========================================================================== */
function spawnBurst(origin, kind = 'sparkle', amount = 14) {
  const layer = $('#effects-layer'), area = $('.play-area');
  if (!layer || !origin || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const box = origin.getBoundingClientRect(), bounds = area.getBoundingClientRect();
  const cx = box.left + box.width / 2 - bounds.left;
  const cy = box.top + box.height / 2 - bounds.top;
  const colors = ['#fde047', '#ff4d79', '#4ade80', '#38bdf8', '#c084fc', '#fb923c'];

  for (let i = 0; i < amount; i++) {
    const bit = document.createElement('i');
    const angle = (Math.PI * 2 * i / amount) + (Math.random() - 0.5) * 0.4;
    const distance = 36 + Math.random() * 64;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 20;
    const turn = Math.round(Math.random() * 140 - 70);

    bit.className = `fx-bit ${kind === 'stars' ? 'is-star' : ''}`;
    bit.style.left = `${cx}px`;
    bit.style.top = `${cy}px`;
    bit.style.background = colors[i % colors.length];
    bit.style.setProperty('--dx', `${dx}px`);
    bit.style.setProperty('--dy', `${dy}px`);
    bit.style.setProperty('--sx', `${dx * 0.3}px`);
    bit.style.setProperty('--sy', `${dy * 0.3}px`);
    bit.style.setProperty('--turn', `${turn}deg`);
    bit.style.setProperty('--st', `${turn * 0.25}deg`);

    layer.append(bit);
    setTimeout(() => bit.remove(), 850);
  }
}

function say(text, kind = 'good') {
  feedback.textContent = text;
  feedback.className = `feedback show ${kind}`;
  later(() => {
    feedback.className = 'feedback';
  }, 1300);
  // Trigger matching animation only for non-hint states
  if (kind === 'good') animate('happy');
  else if (kind === 'try') animate('try');
  // 'hint' keeps the current animation unchanged
}

function addStar() {
  starsWon++;
  if (starCountEl) {
    starCountEl.textContent = String(starsWon);
  }
  const starHud = document.querySelector('.hud-stars');
  if (starHud) {
    starHud.classList.remove('star-celebrate');
    void starHud.offsetWidth;
    starHud.classList.add('star-celebrate');
    later(() => starHud.classList.remove('star-celebrate'), 650);
  }
}

/* ==========================================================================
   CHARACTER ANIMATIONS (SPARKY / LUCAS)
   ========================================================================== */
async function animate(name = 'idle') {
  clearTimeout(idleCycleTimer);
  const token = ++runToken;
  const activePlayer = player;
  player = undefined;
  activePlayer?.destroy();

  const idleCycle = [
    ['idle', '01-idle'],
    ['lookLeft', '04-room-game-lu-n-look-left'],
    ['lookRight', '05-room-game-lu-n-look-right'],
    ['idleAlt', '02-idle-eb']
  ];

  // Joyful preschool reaction variations
  const happyVariations = [
    '17-clapping', 
    '16-entry-thumbs-up', 
    '14-n2-lu-laugh-03-tummy-hand', 
    '27-intro-dance-lu-dance-hipmove'
  ];
  const chosenHappy = happyVariations[Math.floor(Math.random() * happyVariations.length)];

  const paths = {
    ...Object.fromEntries(idleCycle),
    happy: chosenHappy,
    wow: '13-wow',
    jump: '11-toy-garden-happy-jumping',
    welcome: '18-front-hi',
    dance: '27-intro-dance-lu-dance-hipmove',
    laugh: '14-n2-lu-laugh-03-tummy-hand',
    try: '20-saying-no'
  };

  const id = paths[name] || paths.idle;

  try {
    const nextPlayer = await SpriteSheetPlayer.load($('#sparky'), `./animations/${id}/animation.json`, {
      loop: idleCycle.some(([key]) => key === name),
      isCurrent: () => token === runToken
    });
    if (!nextPlayer || token !== runToken) {
      nextPlayer?.destroy();
      return;
    }
    player = nextPlayer;
    player.play();

    const idleIndex = idleCycle.findIndex(([key]) => key === name);
    if (idleIndex >= 0) {
      idleCycleIndex = idleIndex;
      idleCycleTimer = setTimeout(() => {
        animate(idleCycle[(idleIndex + 1) % idleCycle.length][0]);
      }, 4400);
    } else {
      idleCycleTimer = setTimeout(() => {
        if (token === runToken) animate('idle');
      }, player.data.durationMs + 160);
    }
  } catch {
    if (token === runToken && name !== 'idle') animate('idle');
  }
}

/* ==========================================================================
   BUBBLE FIELD GENERATOR (KIDS LOVE POPPING BUBBLES!)
   ========================================================================== */
function initBubbleField() {
  const field = $('#bubble-field');
  if (!field) return;

  const tints = [
    'rgba(56, 189, 248, 0.45)', // sky
    'rgba(244, 114, 182, 0.45)', // pink
    'rgba(74, 222, 128, 0.45)',  // mint
    'rgba(250, 204, 21, 0.45)',  // yellow
    'rgba(192, 132, 252, 0.45)', // lilac
    'rgba(251, 146, 60, 0.45)'   // orange
  ];

  function spawnSoapBubble(offsetSec = null) {
    if (document.hidden) return;
    if (field.querySelectorAll('.toddler-bubble').length < 12) {
      const bubble = document.createElement('div');
      bubble.className = 'toddler-bubble';
      const size = 32 + Math.random() * 42;
      const startX = 3 + Math.random() * 94;
      const duration = 9 + Math.random() * 7;
      const drift = (Math.random() - 0.5) * 70;
      const tint = tints[Math.floor(Math.random() * tints.length)];

      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${startX}%`;
      bubble.style.setProperty('--rise-duration', `${duration}s`);
      bubble.style.setProperty('--drift-x', `${drift}px`);
      bubble.style.setProperty('--bubble-tint', tint);

      if (offsetSec !== null) {
        bubble.style.animationDelay = `-${offsetSec}s`;
      }

      // Pop on touch / click
      const popBubble = (e) => {
        e.stopPropagation();
        playSfx('pop');
        spawnBurst(bubble, 'stars', 9);
        bubble.remove();
      };
      bubble.addEventListener('click', popBubble);
      bubble.addEventListener('touchstart', popBubble, { passive: true });

      bubble.addEventListener('animationiteration', () => {
        bubble.remove();
      });

      field.append(bubble);
    }
    later(spawnSoapBubble, 1400);
  }

  // Initial population of bubbles already floating in the sky
  [1.5, 3.8, 5.2, 7.0, 9.5].forEach(sec => spawnSoapBubble(sec));
  later(spawnSoapBubble, 1200);
}

/* ==========================================================================
   GAME BOOTH RENDERING
   ========================================================================== */
function objectArt(skill, item, extraClass = '', customSrc = null) {
  const image = document.createElement('img');
  image.className = `sprite-art ${extraClass}`.trim();
  image.src = customSrc || `./assets/objects/${skill.key}/${String(item % ASSET_COUNT + 1).padStart(2, '0')}.png`;
  image.alt = '';
  image.draggable = false;
  image.decoding = 'async';
  return image;
}

function panelHead(skill) {
  const n = String(counters[skillIndex] % 40 + 1).padStart(2, '0');
  return `
    <p class="round-kicker">
      <span class="booth-tag">${skill.label}</span>
      <span class="round-count">ROUND ${n} OF 40</span>
    </p>
    <h1 class="round-title">${skill.title}</h1>
    <p class="round-subtitle">${skill.subtitle}</p>
  `;
}

function startSkill() {
  stopDialogue();
  clearTimers();
  mini = null;
  resolved = false;
  feedback.className = 'feedback';
  feedback.textContent = '';
  const skill = SKILLS[skillIndex];
  speech.textContent = skill.guide;

  panel.classList.remove('is-menu', 'is-complete');

  if (skill.key === 'shapes') return renderShapes(skill);
  if (skill.key === 'more') return renderMore(skill);

  // Play intro dialogue for this skill then schedule a guide
  try {
    const introMap = {
      different: DIALOGUES.different.intro[0],
      biggest:   DIALOGUES.biggest.intro[0],
      longest:   DIALOGUES.longest.intro[0],
    };
    const introSrc = introMap[skill.key];
    if (introSrc) playDialogue(introSrc);
    later(() => scheduleGuide(skill.key, 0), 4000);
  } catch (err) {}

  const isLongest = skill.key === 'longest';
  const isBiggest = skill.key === 'biggest';

  const options = makeOptions(skill);
  panel.innerHTML = `
    ${panelHead(skill)}
    <div class="choices ${isLongest ? 'is-longest' : isBiggest ? 'is-biggest' : ''}" role="group" aria-label="Answer choices"></div>
    <p class="image-hint">${isLongest ? '🏁 Look at the track! Tap the LONGEST one reaching farthest!' : isBiggest ? '🔍 Look closely! Tap the GIANT biggest one!' : '👉 Tap your favorite answer!'}</p>
  `;

  const holder = panel.querySelector('.choices');
  options.items.forEach((item, i) => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.type = 'button';
    b.setAttribute('aria-label', `Choice ${i + 1}`);

    const art = objectArt(skill, item.asset, isLongest ? 'long-art' : 'size-art', item.customSrc);

    if (isLongest) {
      const track = document.createElement('div');
      track.className = 'longest-track';

      const startMarker = document.createElement('span');
      startMarker.className = 'track-start';
      startMarker.textContent = '🏁';
      startMarker.setAttribute('aria-hidden', 'true');

      const wrap = document.createElement('div');
      wrap.className = 'longest-art-wrap';
      art.style.setProperty('--art-width', `${item.widthPercent ?? 100}%`);
      wrap.append(art);

      const goalMarker = document.createElement('span');
      goalMarker.className = 'track-goal';
      goalMarker.textContent = '⭐';
      goalMarker.setAttribute('aria-hidden', 'true');

      track.append(startMarker, wrap, goalMarker);
      b.append(track);
    } else {
      b.append(art);
    }

    b.insertAdjacentHTML('beforeend', `<span class="choice-number">${i + 1}</span>`);
    b.addEventListener('click', () => answer(i === options.answer, b));
    holder.append(b);
  });
}

function shuffled(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function makeOptions(skill) {
  const currentAsset = bank[skillIndex][counters[skillIndex] % ASSET_COUNT], q = currentAsset.index;
  let items;

  if (skill.key === 'different') {
    const common = currentAsset.seed % ASSET_COUNT;
    const odd = (common + 17) % ASSET_COUNT;
    const oddAt = (q * 3 + counters[skillIndex]) % 4;
    items = Array.from({ length: 4 }, (_, i) => ({
      asset: i === oddAt ? odd : common,
      correct: i === oddAt
    }));
  } else if (skill.key === 'biggest') {
    // Each size is a clean transparent PNG rendered from one isolated master cutout.
    const rowIdx = counters[skillIndex] % 8;
    const pickSizes = [0, 2, 4, 7]; // Small, medium, big, giant; spread the visual sizes clearly
    items = pickSizes.map(size => ({
      asset: rowIdx,
      customSrc: `./assets/objects/biggest/obj_${rowIdx}_size_${size}.png?v=clean-biggest-2`,
      correct: size === 7
    }));
  } else if (skill.key === 'longest') {
    // 7 hand-drawn horizontal toys (pencil, paintbrush, ribbon, train, candy rope, spiral, crayon)
    // with 8 hand-drawn lengths (0 to 7) - wheels stay circular, zero stretching
    const bandIdx = counters[skillIndex] % 7;
    const pickLens = [0, 2, 5, 7]; // Short, Medium, Long, Super-Long
    items = pickLens.map(len => ({
      asset: bandIdx,
      customSrc: `./assets/objects/longest/obj_${bandIdx}_len_${len}.png`,
      widthPercent: [28, 48, 72, 100][pickLens.indexOf(len)],
      correct: len === 7
    }));
  }

  const mixed = shuffled(items);
  return { items: mixed, answer: mixed.findIndex(item => item.correct) };
}

function renderMore(skill) {
  // Play intro dialogue then schedule a guide
  try {
    playDialogue(DIALOGUES.more.intro[0]);
    later(() => scheduleGuide('more', 0), 4000);
  } catch (err) {}
  const round = bank[skillIndex][counters[skillIndex] % ASSET_COUNT];
  const seed = round.seed;
  // Dramatic count difference (e.g. 2 vs 5, 3 vs 7, 2 vs 6) for toddlers
  const left = 2 + (seed % 3);           // 2, 3, or 4
  const delta = 4 + ((seed * 7) % 4);    // 4, 5, 6, or 7
  const right = left + delta;             // at least 6, up to 11
  const correctGroup = (seed + counters[skillIndex]) % 2;
  const counts = correctGroup === 0 ? [right, left] : [left, right];

  panel.innerHTML = `
    ${panelHead(skill)}
    <div class="group-board" role="group" aria-label="Choose the group with more objects"></div>
    <p class="image-hint">👉 Tap the toy group with MORE!</p>
  `;

  const board = panel.querySelector('.group-board');
  counts.forEach((count, index) => {
    const b = document.createElement('button');
    b.className = 'group-choice';
    b.type = 'button';
    b.setAttribute('aria-label', `${count} items`);

    const grid = document.createElement('span');
    grid.className = 'group-grid';
    for (let i = 0; i < count; i++) {
      grid.append(objectArt(skill, round.index));
    }
    b.append(grid);

    const label = document.createElement('span');
    label.className = 'group-count';
    label.textContent = `⭐ ${count} Items`;
    b.append(label);

    b.addEventListener('click', () => answer(index === correctGroup, b));
    board.append(b);
  });
}

const shapeConfig = [
  { name: 'circle', label: 'Circle', icon: '🟡', file: 'shape-circle.svg', color: '#0284c7', bg: 'radial-gradient(circle at 50% 40%, #ffffff 0%, #e0f2fe 100%)' },
  { name: 'triangle', label: 'Triangle', icon: '🔺', file: 'shape-triangle.svg', color: '#16a34a', bg: 'radial-gradient(circle at 50% 40%, #ffffff 0%, #dcfce7 100%)' },
  { name: 'square', label: 'Square', icon: '🟧', file: 'shape-square.svg', color: '#ea580c', bg: 'radial-gradient(circle at 50% 40%, #ffffff 0%, #ffedd5 100%)' },
  { name: 'star', label: 'Star', icon: '⭐', file: 'shape-star.svg', color: '#ca8a04', bg: 'radial-gradient(circle at 50% 40%, #ffffff 0%, #fef9c3 100%)' },
  { name: 'heart', label: 'Heart', icon: '❤️', file: 'shape-heart.svg', color: '#db2777', bg: 'radial-gradient(circle at 50% 40%, #ffffff 0%, #fce7f3 100%)' },
  { name: 'diamond', label: 'Diamond', icon: '🔷', file: 'shape-diamond.svg', color: '#0891b2', bg: 'radial-gradient(circle at 50% 40%, #ffffff 0%, #cffafe 100%)' },
  { name: 'oval', label: 'Oval', icon: '🔴', file: 'shape-oval.svg', color: '#dc2626', bg: 'radial-gradient(circle at 50% 40%, #ffffff 0%, #fee2e2 100%)' },
  { name: 'moon', label: 'Moon', icon: '🌙', file: 'shape-moon.svg', color: '#9333ea', bg: 'radial-gradient(circle at 50% 40%, #ffffff 0%, #f3e8ff 100%)' }
];

const shapeNames = shapeConfig.map(s => s.name);
const shapeAssetPools = [
  [0, 9, 18, 27, 36],
  [2, 11, 20, 29, 38],
  [3, 12, 21, 30, 39],
  [7, 16, 25, 34],
  [6, 15, 24, 33],
  [5, 14, 23, 32],
  [1, 10, 19, 28, 37],
  [8, 17, 26, 35]
];

function renderShapes(skill) {
  // Play intro dialogue then schedule a guide
  try {
    playDialogue(DIALOGUES.shapes.intro[0]);
    later(() => scheduleGuide('shapes', 0), 4000);
  } catch (err) {}
  shapeMatches = 0;
  selectedPiece = null;
  const seed = bank[skillIndex][counters[skillIndex] % ASSET_COUNT].seed;
  const shapes = [0, 1, 2, 3, 4, 5, 6, 7].sort((a, b) => ((a * 13 + seed) % 41) - ((b * 13 + seed) % 41));
  const targets = shapes.slice(0, 4).sort((a, b) => a - b);
  const toys = shuffled(targets);

  panel.innerHTML = `
    ${panelHead(skill)}
    <div class="shape-board" aria-label="Shape target spaces"></div>
    <div class="shape-toys" aria-label="Shape toy pieces"></div>
    <p class="image-hint">👉 Tap a toy below, then tap its matching shape space!</p>
  `;

  const board = panel.querySelector('.shape-board');
  const toysEl = panel.querySelector('.shape-toys');

  targets.forEach(shape => {
    const cfg = shapeConfig[shape];
    const card = document.createElement('div');
    card.className = 'shape-match-card';

    const target = document.createElement('button');
    target.type = 'button';
    target.className = 'shape-target';
    target.dataset.target = shape;
    target.style.setProperty('--shape-color', cfg.color);
    target.style.setProperty('--shape-bg', cfg.bg);
    target.setAttribute('aria-label', `${cfg.label} shape space`);

    target.innerHTML = `
      <img class="shape-silhouette" src="./assets/shapes/${cfg.file}" alt="${cfg.label}">
      <span class="shape-badge">${cfg.icon} ${cfg.label}</span>
    `;

    target.addEventListener('click', () => {
      if (selectedPiece) {
        tryMatch(selectedPiece, target);
      } else {
        playSfx('tap');
        say(`Tap a toy piece first! ⭐`, 'try');
      }
    });

    card.append(target);
    board.append(card);
  });

  toys.forEach(shape => {
    const cfg = shapeConfig[shape];
    const piece = document.createElement('button');
    piece.type = 'button';
    piece.className = 'shape-piece';
    piece.draggable = true;
    piece.dataset.shape = shape;
    piece.setAttribute('aria-label', `${cfg.label} toy piece`);

    const pool = shapeAssetPools[shape];
    const asset = pool[counters[skillIndex] % pool.length];
    piece.append(objectArt(skill, asset));

    piece.addEventListener('click', () => {
      playSfx('tap');
      selectedPiece = piece;
      panel.querySelectorAll('.shape-piece').forEach(x => x.classList.toggle('selected', x === piece));
      
      // Highlight matching target with friendly pulse
      panel.querySelectorAll('.shape-target').forEach(t => {
        t.classList.toggle('target-hint', Number(t.dataset.target) === shape && !t.classList.contains('matched'));
      });
      
      say(`Can you find the ${cfg.label} shape? ⭐`, 'hint');
    });

    piece.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', String(shape));
      selectedPiece = piece;
    });

    toysEl.append(piece);
  });

  // Touch and Drag-drop handlers
  panel.querySelectorAll('.shape-target').forEach(target => {
    target.addEventListener('dragover', e => {
      e.preventDefault();
      target.classList.add('over');
    });
    target.addEventListener('dragleave', () => target.classList.remove('over'));
    target.addEventListener('drop', e => {
      e.preventDefault();
      target.classList.remove('over');
      const shapeVal = e.dataTransfer.getData('text/plain');
      const piece = panel.querySelector(`.shape-piece[data-shape="${shapeVal}"]`);
      if (piece) tryMatch(piece, target);
    });
  });
}

function tryMatch(piece, target) {
  if (!piece || target.classList.contains('matched')) return;

  const pieceShape = Number(piece.dataset.shape);
  const targetShape = Number(target.dataset.target);

  if (pieceShape !== targetShape) {
    playSfx('wrong');
    const correctCfg = shapeConfig[pieceShape];
    const targetCfg = shapeConfig[targetShape];
    say(`Almost! That's ${targetCfg.label}! Look for ${correctCfg.label}! ⭐`, 'try');
    target.classList.add('bump');
    later(() => target.classList.remove('bump'), 350);
    animate('try');
    // Cheerup dialogue for wrong shape match
    try {
      const cheerup = pickRandom(DIALOGUES.shapes.cheerup);
      if (cheerup) playDialogue(cheerup);
    } catch (err) {}
    return;
  }

  playSfx('match');
  spawnBurst(target, 'stars', 16);
  piece.disabled = true;
  piece.classList.add('matched');
  piece.classList.remove('selected');
  target.classList.add('matched');
  target.classList.remove('target-hint');

  // Place matched toy with check badge inside target space
  const toyImg = piece.querySelector('img').cloneNode(true);
  toyImg.className = 'matched-toy';
  target.innerHTML = '';
  target.append(toyImg);
  target.insertAdjacentHTML('beforeend', '<img class="match-check" src="./assets/icon-check.svg" alt="Matched!"><span class="shape-badge">⭐ Matched!</span>');

  // Clear hints
  panel.querySelectorAll('.shape-target').forEach(t => t.classList.remove('target-hint'));
  selectedPiece = null;

  shapeMatches++;
  // Play single-match celebration dialogue
  try {
    const matchClip = pickRandom(DIALOGUES.shapes.matchSingle);
    if (matchClip) playDialogue(matchClip);
  } catch (err) {}
  say(`A perfect fit! Wonderful! ⭐`, 'good');
  animate('happy');

  if (shapeMatches === 4) {
    playSfx('prize');
    spawnBurst(panel, 'stars', 24);
    say(`Hooray! You matched all four shapes! 🎉`, 'good');
    // Play all-matched dialogue
    try {
      if (DIALOGUES.shapes.matchAll[0]) playDialogue(DIALOGUES.shapes.matchAll[0]);
    } catch (err) {}
    later(() => finishSkill(), 650);
  }
}

function answer(correct, button) {
  if (resolved) return;

  if (!correct) {
    playSfx('wrong');
    button.classList.add('wrong');
    say('Great try! Take another peek! 🌟', 'try');
    later(() => button.classList.remove('wrong'), 500);
    animate('try');
    // Play a cheerup dialogue for the current skill
    try {
      const cheerup = pickRandom(DIALOGUES[SKILLS[skillIndex].key]?.cheerup);
      if (cheerup) playDialogue(cheerup);
    } catch (err) {}
    return;
  }

  resolved = true;
  playSfx('success');
  spawnBurst(button, 'stars', 18);
  button.classList.add('correct');
  finishSkill();
}

function finishSkill() {
  resolved = true;
  addStar();
  const skill = SKILLS[skillIndex];
  panel.classList.add('is-complete');
  feedback.className = 'feedback';
  feedback.textContent = '';
  speech.textContent = 'Hooray! You did it! High five!';
  // General celebration dialogue
  try {
    const cheerup = pickRandom(DIALOGUES.welcome.cheerup);
    if (cheerup) playDialogue(cheerup);
  } catch (err) {}
  animate('happy');
  spawnBurst(panel, 'stars', 24);

  panel.innerHTML = `
    <div class="round-done">
      <div class="done-badge-wrap">⭐</div>
      <p class="round-kicker">${skill.label}</p>
      <h2>You Did It!</h2>
      <p>⭐️ You're a superstar player! ⭐️</p>
      <button class="continue-button" id="continue" type="button">
        Let's Go! <img src="./assets/icon-arrow.svg" alt="">
      </button>
    </div>
  `;

  panel.querySelector('#continue').addEventListener('click', e => {
    playSfx('transition');
    spawnBurst(e.currentTarget, 'sparkle', 14);
    advance();
  });
}

function advance() {
  counters[skillIndex] = (counters[skillIndex] + 1) % ASSET_COUNT;
  skillIndex = (skillIndex + 1) % SKILLS.length;

  if (skillIndex === 2) return showMystery();
  if (skillIndex === 4) return showBalloons();

  animate('idle');
  startSkill();
}

/* ==========================================================================
   MINI-GAMES: MYSTERY BOX & BALLOON POP
   ========================================================================== */
function showMystery() {
  panel.classList.remove('is-menu');
  mini = 'mystery';
  resolved = false;
  feedback.className = 'feedback';
  feedback.textContent = '';
  speech.textContent = "Ooh! Tap a mystery box to see what's inside!";
  // Play mystery intro dialogue and schedule a guide
  try {
    playDialogue(DIALOGUES.mystery.intro[0]);
    later(() => {
      try { const g = pickRandom(DIALOGUES.mystery.guide); if (g) playDialogue(g); } catch(e) {}
    }, 3000);
  } catch (err) {}

  panel.innerHTML = `
    <p class="round-kicker">BONUS FUN • MYSTERY SURPRISE</p>
    <h1 class="round-title">Pick a Mystery Box!</h1>
    <p class="round-subtitle">Choose any box to reveal a magical surprise!</p>
    <div class="mini-scene">
      ${[0, 1, 2].map(i => `
        <button class="mystery-box" data-box="${i}" aria-label="Mystery gift box ${i + 1}" type="button">
          <img class="box-art" src="./assets/mystery-box.svg" alt="Gift box">
        </button>
      `).join('')}
    </div>
    <p class="image-hint">✨ Every box has a wonderful prize! ✨</p>
  `;

  panel.querySelectorAll('.mystery-box').forEach(box => {
    box.addEventListener('click', () => {
      if (resolved) return;
      resolved = true;
      addStar();
      playSfx('prize');
      spawnBurst(box, 'stars', 24);
      box.classList.add('open');
      box.querySelector('.box-art').src = './assets/mystery-box-open.svg';

      const prizes = [35, 28, 36, 37, 38];
      const prize = objectArt(SKILLS[1], prizes[Math.floor(Math.random() * prizes.length)]);
      prize.className = 'box-prize';
      box.append(prize);

      say('Ta-da! You found a surprise treasure! ⭐', 'good');
      animate('wow');
      // Play prize dialogue
      try {
        if (DIALOGUES.mystery.prize[0]) playDialogue(DIALOGUES.mystery.prize[0]);
      } catch (err) {}

      panel.insertAdjacentHTML('beforeend', `
        <button class="continue-button" id="mini-next" type="button" style="margin-top: 14px;">
          Next Game! <img src="./assets/icon-arrow.svg" alt="">
        </button>
      `);

      $('#mini-next').addEventListener('click', e => {
        playSfx('transition');
        spawnBurst(e.currentTarget, 'sparkle', 14);
        mini = null;
        animate('idle');
        startSkill();
      });
    });
  });
}

function showBalloons() {
  panel.classList.remove('is-menu');
  mini = 'balloons';
  popped = 0;
  resolved = false;
  feedback.className = 'feedback';
  feedback.textContent = '';
  speech.textContent = "Let's pop 5 colorful balloons!";
  // Play balloons intro dialogue and schedule a guide
  try {
    playDialogue(DIALOGUES.balloons.intro[0]);
    later(() => {
      try { const g = pickRandom(DIALOGUES.balloons.guide); if (g) playDialogue(g); } catch(e) {}
    }, 3000);
  } catch (err) {}

  panel.innerHTML = `
    <p class="round-kicker">BONUS FUN • BALLOON POP</p>
    <h1 class="round-title">Pop 5 Smiling Balloons!</h1>
    <p class="round-subtitle">Tap the colorful balloons as they float up to the sky!</p>
    <div class="mini-scene balloon-row" aria-label="Floating balloons arena"></div>
    <div class="balloon-progress" aria-live="polite">
      <div class="progress-balloons">
        ${[1, 2, 3, 4, 5].map(n => `
          <span class="progress-balloon" id="p-balloon-${n}">
            <img src="./assets/balloons/0${n}.svg" alt="">
          </span>
        `).join('')}
      </div>
      <strong id="balloon-count">0 of 5</strong>
    </div>
  `;

  const row = panel.querySelector('.balloon-row');

  function spawnBalloon(initialOffset = null) {
    if (resolved) return;
    if (row.querySelectorAll('.balloon:not(.popped)').length < 6) {
      const b = document.createElement('button');
      const width = 78 + Math.random() * 24;
      b.className = 'balloon';

      const paletteIndex = Math.floor(Math.random() * 7);
      const art = document.createElement('img');
      art.src = `./assets/balloons/0${paletteIndex + 1}.svg`;
      art.className = 'balloon-art';
      art.alt = 'Smiling balloon';
      b.append(art);

      const liftHeight = row.clientHeight > 50 ? (row.clientHeight + 160) : 380;
      b.style.setProperty('--balloon-width', `${width}px`);
      b.style.setProperty('--start-x', `${5 + Math.random() * 80}%`);
      b.style.setProperty('--lift', `-${liftHeight}px`);
      b.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 90)}px`);
      b.style.setProperty('--float-time', `${5.5 + Math.random() * 2.5}s`);
      if (initialOffset !== null) {
        b.style.animationDelay = `-${initialOffset}s`;
      }
      b.setAttribute('aria-label', 'Pop smiling balloon');

      b.addEventListener('animationend', e => {
        if (e.animationName === 'balloonFloatUp' || e.animationName === 'balloonPopExplode') {
          b.remove();
        }
      });

      const onPop = (e) => {
        e.stopPropagation();
        if (b.classList.contains('popped') || resolved) return;
        b.classList.add('popped');
        popped++;
        // Every 2nd pop, play a guide dialogue
        if (popped % 2 === 0 && popped < 5) {
          try {
            const g = pickRandom(DIALOGUES.balloons.guide);
            if (g) playDialogue(g);
          } catch (err) {}
        }

        playSfx('pop');
        playMarimba(523.25 + popped * 110, 0, 0.22, 0.08);
        spawnBurst(b, 'stars', 18);

        // Floating +1 star score indicator
        const scorePop = document.createElement('span');
        scorePop.textContent = '+1 ⭐';
        scorePop.style.cssText = `
          position: absolute;
          left: ${b.offsetLeft + width / 2 - 20}px;
          top: ${b.offsetTop}px;
          font-size: 24px;
          font-weight: 900;
          color: #f59e0b;
          text-shadow: 0 2px 4px rgba(0,0,0,0.2), 0 0 10px #fef08a;
          pointer-events: none;
          z-index: 20;
          animation: floatScore 0.8s ease-out forwards;
        `;
        row.append(scorePop);
        setTimeout(() => scorePop.remove(), 800);

        $('#balloon-count').textContent = `${popped} of 5`;
        const progItem = $(`#p-balloon-${popped}`);
        if (progItem) {
          progItem.classList.add('is-popped');
          progItem.innerHTML = '<img src="./assets/cocomelon-star.svg" alt="Pop!">';
        }

        const praises = ['Pop-tastic! 🎈', 'Great pop! ⭐', 'Awesome! 🌟', 'Super job! 🎈', 'Hooray! ⭐️'];
        say(praises[popped - 1], 'good');
        animate('happy');

        if (popped === 5) {
          resolved = true;
          addStar();
          later(() => {
            playSfx('fanfare');
            spawnBurst(row, 'stars', 30);
            say('🎈 You popped all five balloons! Superstar! ⭐️', 'good');
            animate('jump');
            // Play all-popped dialogue
            try {
              if (DIALOGUES.balloons.allPopped[0]) playDialogue(DIALOGUES.balloons.allPopped[0]);
            } catch (err) {}
            panel.insertAdjacentHTML('beforeend', `
              <button class="continue-button" id="mini-next" type="button" style="margin-top: 14px;">
                Keep Playing! <img src="./assets/icon-arrow.svg" alt="">
              </button>
            `);
            $('#mini-next').addEventListener('click', ev => {
              playSfx('transition');
              spawnBurst(ev.currentTarget, 'sparkle', 16);
              mini = null;
              animate('idle');
              startSkill();
            });
          }, 350);
        }
      };

      b.addEventListener('click', onPop);
      b.addEventListener('touchstart', onPop, { passive: true });

      row.append(b);
    }
    if (!resolved) later(spawnBalloon, 700);
  }

  // Spawn initial set
  spawnBalloon(2.2);
  spawnBalloon(3.8);
  spawnBalloon(1.0);
  later(() => spawnBalloon(), 600);
}

/* ==========================================================================
   MAIN MENU
   ========================================================================== */
function showMainMenu() {
  stopDialogue();
  clearTimers();
  mini = null;
  resolved = false;
  skillIndex = 0;
  counters = SKILLS.map(() => 0);
  feedback.className = 'feedback';
  feedback.textContent = '';
  panel.classList.remove('is-complete');
  panel.classList.add('is-menu');
  $('.game-shell').classList.remove('is-playing');
  speech.textContent = 'Welcome! Tap a game or press Play!';
  // Play welcome intro then schedule a guide after 3s
  try {
    playDialogue(DIALOGUES.welcome.intro[0]);
    later(() => {
      try { const g = pickRandom(DIALOGUES.welcome.guide); if (g) playDialogue(g); } catch(e) {}
    }, 3000);
  } catch (err) {}

  const menuItems = [
    ['different', 1, 'Spot Different'],
    ['biggest', 5, 'Find Biggest'],
    ['more', 1, 'Count More'],
    ['longest', 3, 'Find Longest'],
    ['shapes', 8, 'Match Shapes']
  ];

  panel.innerHTML = `
    <div class="main-menu">
      <p class="menu-kicker">🎪 SPARKY'S CARNIVAL QUEST 🎪</p>
      <h1><span>Let's Play,</span> <strong>Sparky!</strong></h1>
      <p class="menu-intro">Five fun games for curious little learners!</p>
      <div class="menu-games" aria-label="Choose a game">
        ${menuItems.map(([folder, asset, label]) => `
          <button class="menu-game" type="button" data-skill="${folder}" aria-label="${label}">
            <img src="./assets/objects/${folder}/${String(asset).padStart(2, '0')}.png" alt="">
            <b>${label}</b>
          </button>
        `).join('')}
      </div>
      <button class="menu-play" id="menu-play" type="button">
        <img src="./assets/icon-play.svg" alt=""> Play All Games!
      </button>
    </div>
  `;

  panel.querySelectorAll('.menu-game').forEach(card => {
    card.addEventListener('click', () => {
      const chosen = SKILLS.findIndex(skill => skill.key === card.dataset.skill);
      if (chosen < 0) return;
      skillIndex = chosen;
      playSfx('tap');
      $('.game-shell').classList.add('is-playing');
      animate('happy');
      startSkill();
      startBgMusic();
    });
  });

  $('#menu-play').addEventListener('click', () => {
    playSfx('success');
    $('.game-shell').classList.add('is-playing');
    animate('happy');
    startSkill();
    startBgMusic();
  });
}

/* ==========================================================================
   INTERACTIVE SPARKY / TICKLE TAP
   ========================================================================== */
function setupCharacterInteractions() {
  const wrap = $('#character-wrap');
  if (!wrap) return;

  const tickleSparky = (e) => {
    e.stopPropagation();
    playSfx('giggle');
    spawnBurst(wrap, 'stars', 12);
    
    const giggles = [
      'Hehehe, that tickles!',
      'Yay! You are my best friend!',
      "Let's play another game!",
      'High five! 🖐️',
      'You are doing super-duper!'
    ];
    speech.textContent = giggles[Math.floor(Math.random() * giggles.length)];

    const dances = ['dance', 'laugh', 'jump', 'happy'];
    const dance = dances[Math.floor(Math.random() * dances.length)];
    animate(dance);
  };

  wrap.addEventListener('click', tickleSparky);
  wrap.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tickleSparky(e);
    }
  });
}

/* ==========================================================================
   INITIALIZATION & EVENT LISTENERS
   ========================================================================== */
function toggleSound() {
  soundOn = !soundOn;
  const toggleBtn = $('#sound-toggle');
  const soundIcon = $('#sound-icon');

  toggleBtn.classList.toggle('is-muted', !soundOn);
  toggleBtn.setAttribute('aria-label', soundOn ? 'Mute sound effects' : 'Enable sound effects');
  
  if (soundIcon) {
    soundIcon.src = soundOn ? './assets/icon-speaker.svg' : './assets/icon-speaker-muted.svg';
  }

  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(soundOn ? 0.85 : 0, audioCtx.currentTime, 0.025);
  }

  if (soundOn) {
    playSfx('tap');
    startBgMusic();
  } else {
    stopBgMusic();
  }
}

$('#sound-toggle').addEventListener('click', toggleSound);

$('#hud-home-logo')?.addEventListener('click', () => {
  stopDialogue();
  playSfx('transition');
  showMainMenu();
  animate('welcome');
});

$('#hud-main-menu')?.addEventListener('click', () => {
  stopDialogue();
  playSfx('transition');
  showMainMenu();
  animate('welcome');
});

$('#main-menu-btn')?.addEventListener('click', () => {
  stopDialogue();
  playSfx('transition');
  showMainMenu();
  animate('welcome');
});

$('#hud-restart')?.addEventListener('click', () => {
  stopDialogue();
  playSfx('tap');
  clearTimers();
  skillIndex = 0;
  counters = SKILLS.map(() => 0);
  mini = null;
  animate('idle');
  startSkill();
});

$('#restart')?.addEventListener('click', () => {
  stopDialogue();
  playSfx('tap');
  clearTimers();
  skillIndex = 0;
  counters = SKILLS.map(() => 0);
  mini = null;
  animate('idle');
  startSkill();
});

// Sound context unlock on any first user gesture
document.addEventListener('pointerdown', () => {
  getAudio();
}, { once: true });

window.addEventListener('beforeunload', () => {
  clearTimers();
  stopBgMusic();
  player?.destroy();
  audioCtx?.close();
});

// Initialize elements
initBubbleField();
setupCharacterInteractions();

const urlParams = new URLSearchParams(window.location.search);
const paramSkill = urlParams.get('skill');
const paramMini = urlParams.get('mini');

if (paramMini === 'mystery') {
  $('.game-shell').classList.add('is-playing');
  animate('idle');
  showMystery();
} else if (paramMini === 'balloons') {
  $('.game-shell').classList.add('is-playing');
  animate('idle');
  showBalloons();
} else if (paramSkill) {
  const chosen = SKILLS.findIndex(s => s.key === paramSkill);
  if (chosen >= 0) {
    skillIndex = chosen;
    $('.game-shell').classList.add('is-playing');
    animate('idle');
    startSkill();
  } else {
    animate('welcome');
    showMainMenu();
  }
} else {
  animate('welcome');
  showMainMenu();
}

new MutationObserver(() => {
  panel.classList.remove('enter');
  void panel.offsetWidth;
  panel.classList.add('enter');
}).observe(panel, { childList: true });
