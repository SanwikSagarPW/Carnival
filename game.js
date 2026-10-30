import { SpriteSheetPlayer } from './player.js';
import { DIALOGUES } from './dialogues.js';
import * as audio from './audio.js';

/* ==========================================================================
   Setup
   ========================================================================== */
const SKILLS = [
  { key: 'different', title: 'Find The Different One', theme: 'meadow' },
  { key: 'biggest',   title: 'Select The Biggest One', theme: 'meadow' },
  { key: 'more',      title: 'Which One Has More?',    theme: 'beach' },
  { key: 'longest',   title: 'Select The Longest One', theme: 'meadow' },
  { key: 'shapes',    title: 'Match The Shapes',       theme: 'snow' },
];
const MENU = [
  { key: 'different', asset: 1, label: 'Different' },
  { key: 'biggest',   asset: 5, label: 'Biggest' },
  { key: 'more',      asset: 1, label: 'More' },
  { key: 'longest',   asset: 3, label: 'Longest' },
  { key: 'shapes',    asset: 8, label: 'Shapes' },
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
const btnHome = $('#btn-home');
const fx = $('#fx');
const starCountEl = $('#star-count');
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let skillIndex = 0;
let resolved = false;
let starsWon = 0;
let onNext = null;

/* ==========================================================================
   Scenes — everything that can fire later (timers, voice callbacks) belongs to
   the scene that created it, and silently dies when the scene changes.
   ========================================================================== */
let sceneId = 0;
let sceneTimers = [];
let nudgeTimer = null;

function newScene(screen, theme = 'meadow') {
  sceneId++;
  sceneTimers.forEach(clearTimeout);
  sceneTimers = [];
  clearTimeout(nudgeTimer);
  audio.stopSpeech();
  resolved = false;
  onNext = null;
  btnNext.hidden = true;
  btnNext.classList.remove('pop-in');
  fx.textContent = '';
  game.dataset.screen = screen;
  game.dataset.theme = theme;
  btnHome.hidden = screen === 'splash' || screen === 'menu';
  stage.className = 'stage';
  stage.textContent = '';
  return sceneId;
}

function later(fn, ms) {
  const id = sceneId;
  const t = setTimeout(() => { if (id === sceneId) fn(); }, ms);
  sceneTimers.push(t);
  return t;
}

function setTitle(text) {
  ribbon.textContent = text;
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
  const { onEnd, ...rest } = opts;
  audio.speak(src, { ...rest, onEnd: onEnd ? () => { if (id === sceneId) onEnd(); } : null });
}

/** Say the intro, then keep gently re-asking while the child is stuck. */
function introduce(section) {
  const clips = DIALOGUES[section];
  if (!clips) return;
  audio.warm([...(clips.guide || []), ...(clips.cheerup || [])]);
  speak(clips.intro?.[0], { delay: 450, onEnd: () => armNudge(section, NUDGE_TIMES) });
}

function armNudge(section, tries) {
  clearTimeout(nudgeTimer);
  if (tries <= 0) return;
  const id = sceneId;
  nudgeTimer = setTimeout(() => {
    if (id !== sceneId || resolved) return;
    if (audio.isSpeaking()) return armNudge(section, tries);
    speak(audio.pick(DIALOGUES[section]?.guide));
    armNudge(section, tries - 1);
  }, NUDGE_AFTER_MS);
}

/** The child did something — hold off nudging, restart the quiet timer. */
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
    setTimeout(() => bit.remove(), 900);
  }
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
let player = null;
let runToken = 0;
let idleTimer = null;

const IDLE_CYCLE = [
  ['idle', '01-idle'],
  ['lookLeft', '04-room-game-lu-n-look-left'],
  ['lookRight', '05-room-game-lu-n-look-right'],
  ['idleAlt', '02-idle-eb'],
];
const HAPPY = ['17-clapping', '16-entry-thumbs-up', '14-n2-lu-laugh-03-tummy-hand', '27-intro-dance-lu-dance-hipmove'];
const CLIPS = {
  ...Object.fromEntries(IDLE_CYCLE),
  wow: '13-wow',
  jump: '11-toy-garden-happy-jumping',
  welcome: '18-front-hi',
  dance: '27-intro-dance-lu-dance-hipmove',
  laugh: '14-n2-lu-laugh-03-tummy-hand',
  try: '20-saying-no',
};

async function animate(name = 'idle') {
  clearTimeout(idleTimer);
  const token = ++runToken;
  player?.destroy();
  player = null;
  const id = name === 'happy' ? HAPPY[Math.floor(Math.random() * HAPPY.length)] : (CLIPS[name] || CLIPS.idle);
  const looping = IDLE_CYCLE.some(([key]) => key === name);

  try {
    const next = await SpriteSheetPlayer.load($('#sparky'), `./animations/${id}/animation.json`, {
      loop: looping,
      isCurrent: () => token === runToken,
    });
    if (!next || token !== runToken) { next?.destroy(); return; }
    player = next;
    player.play();
    if (looping) {
      const i = IDLE_CYCLE.findIndex(([key]) => key === name);
      idleTimer = setTimeout(() => animate(IDLE_CYCLE[(i + 1) % IDLE_CYCLE.length][0]), 4400);
    } else {
      idleTimer = setTimeout(() => { if (token === runToken) animate('idle'); }, player.data.durationMs + 160);
    }
  } catch {
    if (token === runToken && name !== 'idle') animate('idle');
  }
}

$('#character').addEventListener('click', () => {
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

function pic(src, cls = '') {
  const img = document.createElement('img');
  img.className = `pic ${cls}`.trim();
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  // natural size feeds the CSS so "bigger"/"longer" pictures really are bigger/longer
  img.addEventListener('load', () => {
    img.style.setProperty('--nw', img.naturalWidth);
    img.style.setProperty('--nh', img.naturalHeight);
  }, { once: true });
  img.src = src;
  return img;
}

const objectSrc = (key, n) => `./assets/objects/${key}/${pad((n % ASSET_COUNT) + 1)}.png`;

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
   Splash + menu
   ========================================================================== */
function showSplash() {
  newScene('splash');
  setTitle("Sparky's Carnival");
  stage.classList.add('is-splash');
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'play-pill';
  play.setAttribute('aria-label', 'Play');
  play.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M16 9v30l24-15z" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round"/></svg><span>PLAY</span>';
  play.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('success');
    audio.startMusic();
    burst(play, 22);
    animate('happy');
    later(showMenu, 280);
  });
  const rays = document.createElement('div');
  rays.className = 'rays';
  stage.append(rays);
  [1, 3, 5, 2].forEach((n, i) => {
    stage.append(pic(`./assets/balloons/0${n}.svg`, `float-balloon fb${i}`));
  });
  stage.append(play);
  animate('welcome');
}

function showMenu() {
  newScene('menu');
  skillIndex = 0;
  setTitle('Choose A Game');
  stage.classList.add('is-menu');
  audio.warm(DIALOGUES.welcome.guide);
  speak(DIALOGUES.welcome.intro[0], { delay: 400, onEnd: () => armMenuNudge(NUDGE_TIMES) });

  MENU.forEach((m, i) => {
    const el = document.createElement('div');
    el.className = 'card menu-card';
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-label', m.label);
    el.style.setProperty('--i', i);
    el.append(pic(objectSrc(m.key, m.asset - 1), 'art-fit'));
    const name = document.createElement('b');
    name.textContent = m.label;
    el.append(name);
    const go = () => {
      skillIndex = SKILLS.findIndex((s) => s.key === m.key);
      audio.sfx('tap');
      burst(el, 8);
      animate('happy');
      startSkill();
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    stage.append(el);
  });
  showNext(() => {
    audio.sfx('success');
    animate('happy');
    skillIndex = 0;
    startSkill();
  }, 'Play all games');
  animate('welcome');
}

function armMenuNudge(tries) {
  clearTimeout(nudgeTimer);
  if (tries <= 0) return;
  const id = sceneId;
  nudgeTimer = setTimeout(() => {
    if (id !== sceneId || game.dataset.screen !== 'menu') return;
    if (audio.isSpeaking()) return armMenuNudge(tries);
    speak(audio.pick(DIALOGUES.welcome.guide));
    armMenuNudge(tries - 1);
  }, NUDGE_AFTER_MS);
}

/* ==========================================================================
   Learning games
   ========================================================================== */
function startSkill() {
  const skill = SKILLS[skillIndex];
  newScene('play', skill.theme);
  setTitle(skill.title);
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
      items: Array.from({ length: 4 }, (_, i) => ({ src: objectSrc('different', i === r.at ? r.odd : r.common), correct: i === r.at })),
      shuffle: false,
    };
  }
  if (skill.key === 'biggest') {
    const r = fresh('biggest', () => {
      const row = rand(8);
      const sizes = spacedPicks(7, 4, 2);
      return { key: `${row}-${sizes}`, row, sizes };
    });
    return {
      items: r.sizes.map((size, i) => ({ src: `./assets/objects/biggest/obj_${r.row}_size_${size}.png?v=clean-biggest-2`, correct: i === 3 })),
      shuffle: true,
    };
  }
  const r = fresh('longest', () => {
    const band = rand(7);
    const lens = spacedPicks(7, 4, 2);
    return { key: `${band}-${lens}`, band, lens };
  });
  return {
    items: r.lens.map((len, i) => ({ src: `./assets/objects/longest/obj_${r.band}_len_${len}.png`, correct: i === 3 })),
    shuffle: true,
  };
}

function renderChoices(skill) {
  const section = skill.key;
  const { items, shuffle } = makeOptions(skill);
  const list = shuffle ? shuffled(items) : items;
  stage.classList.add(section === 'different' ? 'grid-4' : 'grid-2x2');
  if (section === 'longest') stage.classList.add('is-longest');

  list.forEach((item, i) => {
    const el = card({
      section,
      label: `Choice ${i + 1}`,
      onPick: (c) => answer(section, item.correct, c),
    });
    const cls = section === 'different' ? 'art-fit' : section === 'biggest' ? 'art-scaled' : 'art-long';
    el.append(pic(item.src, cls));
    el.style.setProperty('--i', i);
    stage.append(el);
  });
  introduce(section);
}

function renderMore(skill) {
  const section = 'more';
  const round = fresh('more', () => {
    const item = rand(ASSET_COUNT);
    const small = 2 + rand(6);                  // 2-7
    const big = small + 2 + rand(3);            // always at least 2 more, never above 11
    return { key: `${item}-${small}-${big}`, item, small, big, bigSide: rand(2) };
  });
  const bigSide = round.bigSide;
  const counts = bigSide === 0 ? [round.big, round.small] : [round.small, round.big];
  stage.classList.add('grid-2');

  counts.forEach((count, side) => {
    const el = card({
      section,
      label: `${count} things`,
      onPick: (c) => answer(section, side === bigSide, c),
    });
    el.style.setProperty('--i', side);
    const pile = document.createElement('div');
    pile.className = 'pile';
    for (let i = 0; i < count; i++) pile.append(pic(objectSrc('more', round.item), 'pile-item'));
    el.append(pile);
    stage.append(el);
  });
  introduce(section);
}

function answer(section, correct, el) {
  if (resolved) return;
  audio.unlock();
  if (!correct) {
    audio.sfx('wrong');
    el.classList.remove('wrong');
    void el.offsetWidth;
    el.classList.add('wrong');
    animate('try');
    cheerUp(section);
    touched(section);
    return;
  }
  resolved = true;
  clearTimeout(nudgeTimer);
  audio.stopSpeech();
  audio.sfx('success');
  el.classList.add('correct');
  stage.classList.add('has-answer');
  burst(el, 18);
  animate('happy');
  addStar();
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
   Match the shapes — drag a shape from the tray onto the toy it belongs to
   ========================================================================== */
const SHAPES = [
  { name: 'circle',   file: 'shape-circle.svg' },
  { name: 'triangle', file: 'shape-triangle.svg' },
  { name: 'square',   file: 'shape-square.svg' },
  { name: 'star',     file: 'shape-star.svg' },
  { name: 'heart',    file: 'shape-heart.svg' },
  { name: 'diamond',  file: 'shape-diamond.svg' },
  { name: 'oval',     file: 'shape-oval.svg' },
  { name: 'moon',     file: 'shape-moon.svg' },
];
// Which pictures in assets/objects/shapes are which shape (checked against the art sheet,
// 8 per row: circle oval triangle square rectangle diamond heart star moon...). Same order as SHAPES.
const SHAPE_ASSET_POOLS = [
  [0, 9, 18, 27, 35],   // circle
  [2, 11, 20, 29, 37],  // triangle
  [3, 12, 21, 30, 38],  // square
  [7, 16, 25, 34],      // star
  [6, 15, 24, 33],      // heart
  [5, 14, 23, 32],      // diamond
  [1, 10, 19, 28, 36],  // oval
  [8, 17, 26],          // moon
];

function renderShapes(skill) {
  const section = 'shapes';
  const round = fresh('shapes', () => {
    const order = shuffled([0, 1, 2, 3, 4, 5, 6, 7]);
    const targets = order.slice(0, 4);
    const toys = Object.fromEntries(targets.map((s) => [s, rand(SHAPE_ASSET_POOLS[s].length)]));
    return { key: [...targets].sort().join('') + Object.values(toys).join(''), targets, extra: order[4], toys };
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
  shuffled(targets).forEach((shape, i) => {
    const pool = SHAPE_ASSET_POOLS[shape];
    const el = card({ section, extra: 'shape-card' });
    el.style.setProperty('--i', i);
    el.append(pic(objectSrc('shapes', pool[round.toys[shape]]), 'toy'));
    const slot = document.createElement('div');
    slot.className = 'slot';
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
    const shape = Number(piece.dataset.shape);
    if (slot.classList.contains('filled') || piece.classList.contains('done')) return;
    touched(section);
    if (Number(slot.dataset.shape) !== shape) {
      audio.sfx('wrong');
      slot.classList.remove('bump');
      void slot.offsetWidth;
      slot.classList.add('bump');
      animate('try');
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
    piece.style.transform = '';
    held = null;
    hintSlot(shape, false);
    slot.classList.add('filled');
    slot.classList.remove('glow');
    slot.textContent = '';
    slot.append(pic(`./assets/shapes/${SHAPES[shape].file}`, 'placed'));
    slot.insertAdjacentHTML('beforeend', '<svg class="tick" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#2fc455" stroke="#fff" stroke-width="4"/><path d="m14 25 7 7 14-16" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    matched++;

    if (matched < 4) {
      speak(audio.pick(DIALOGUES.shapes.matchSingle), { delay: 250 });
      animate('happy');
    } else {
      resolved = true;
      clearTimeout(nudgeTimer);
      addStar();
      audio.sfx('fanfare');
      burst(stage, 26);
      speak(DIALOGUES.shapes.matchAll[0], { delay: 500 });
      animate('jump');
      later(() => showNext(advance, 'Next game'), 1100);
    }
  }

  tray.forEach((shape) => {
    const piece = document.createElement('div');
    piece.className = 'tray-piece';
    piece.dataset.shape = shape;
    piece.setAttribute('role', 'button');
    piece.setAttribute('aria-label', `${SHAPES[shape].name} shape`);
    piece.append(pic(`./assets/shapes/${SHAPES[shape].file}`));
    makeDraggable(piece, {
      slots: () => [...slots.values()],
      onTap: () => {
        audio.sfx('tap');
        held = held === piece ? null : piece;
        trayEl.querySelectorAll('.tray-piece').forEach((p) => p.classList.toggle('selected', p === held));
        touched(section);
      },
      onDrop: (slot) => (slot ? place(piece, slot) : null),
      onLift: () => { held = null; trayEl.querySelectorAll('.selected').forEach((p) => p.classList.remove('selected')); audio.sfx('whoosh'); },
    });
    trayEl.append(piece);
  });

  introduce(section);
}

/** Pointer-based dragging so it works the same with a finger or a mouse. */
function makeDraggable(el, { slots, onTap, onDrop, onLift }) {
  el.addEventListener('pointerdown', (e) => {
    if (resolved || el.classList.contains('done')) return;
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
  setTitle('Pick A Mystery Box');
  animate('idle');
  stage.classList.add('grid-3');
  const section = 'mystery';

  [0, 1, 2].forEach((i) => {
    const el = card({
      section,
      label: `Mystery box ${i + 1}`,
      extra: 'box-card',
      onPick: (c) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(nudgeTimer);
        audio.stopSpeech();
        addStar();
        audio.sfx('fanfare');
        burst(c, 24);
        c.classList.add('open', 'correct');
        stage.classList.add('has-answer');
        c.querySelector('.pic').src = './assets/mystery-box-open.svg';
        c.append(pic(objectSrc('different', rand(ASSET_COUNT)), 'prize'));
        animate('wow');
        speak(DIALOGUES.mystery.prize[0], { delay: 400 });
        later(() => showNext(() => { audio.sfx('transition'); startSkill(); }, 'Next game'), 1200);
      },
    });
    el.style.setProperty('--i', i);
    el.append(pic('./assets/mystery-box.svg', 'art-fit'));
    stage.append(el);
  });
  introduce(section);
}

/* ==========================================================================
   Bonus: balloons
   ========================================================================== */
function showBalloons() {
  newScene('play', 'meadow');
  setTitle('Pop The Balloons');
  animate('idle');
  stage.classList.add('is-balloons');
  const section = 'balloons';
  const GOAL = 5;
  let popped = 0;

  const sky = document.createElement('div');
  sky.className = 'balloon-sky';
  const stars = document.createElement('div');
  stars.className = 'star-row';
  stars.innerHTML = Array.from({ length: GOAL }, () =>
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 5 5.6 12.2 13.4 1.4-10 9 2.9 13.2L24 34 12.1 40.8 15 27.6l-10-9 13.4-1.4z"/></svg>').join('');
  stage.append(sky, stars);

  let lane = -1;
  function spawn() {
    if (resolved) return;
    if (sky.querySelectorAll('.balloon:not(.popped)').length < 6) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'balloon';
      b.setAttribute('aria-label', 'Balloon');
      const width = 84 + Math.random() * 28;
      b.style.setProperty('--w', `${width}px`);
      // pick a lane different from the last balloon so they don't stack up
      let next;
      do { next = Math.floor(Math.random() * 6); } while (next === lane);
      lane = next;
      b.style.setProperty('--x', `${3 + lane * 15 + Math.random() * 6}%`);
      b.style.setProperty('--lift', `${sky.clientHeight + 260}px`);
      b.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 80)}px`);
      b.style.setProperty('--time', `${6.5 + Math.random() * 2.5}s`);
      const art = pic(`./assets/balloons/${pad(1 + Math.floor(Math.random() * 7))}.svg`, 'balloon-art');
      b.append(art);
      b.addEventListener('animationend', (e) => {
        if (e.animationName === 'rise' || e.animationName === 'burst') b.remove();
      });
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        audio.unlock();
        if (b.classList.contains('popped') || resolved) return;
        b.classList.add('popped');
        popped++;
        audio.sfx('pop', popped);
        burst(b, 16);
        const slot = stars.children[popped - 1];
        if (slot) slot.classList.add('on');
        animate('happy');
        touched(section);
        if (popped === 2 || popped === 4) speak(audio.pick(DIALOGUES.balloons.guide), { delay: 200 });
        if (popped >= GOAL) {
          resolved = true;
          clearTimeout(nudgeTimer);
          addStar();
          later(() => {
            audio.sfx('fanfare');
            burst(stars, 26);
            animate('jump');
            speak(DIALOGUES.balloons.allPopped[0], { delay: 300 });
            showNext(() => { audio.sfx('transition'); startSkill(); }, 'Next game');
          }, 400);
        }
      });
      sky.append(b);
    }
    if (!resolved) later(spawn, 750);
  }
  spawn();
  introduce(section);
}

/* ==========================================================================
   Chrome: sound, home, next
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

btnHome.addEventListener('click', () => {
  audio.sfx('transition');
  showMenu();
});

btnNext.addEventListener('click', () => {
  audio.unlock();
  const go = onNext;
  if (!go) return;
  btnNext.hidden = true;
  go();
});

document.addEventListener('pointerdown', () => audio.unlock(), { once: true, capture: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('pagehide', () => { audio.stopSpeech(); audio.stopMusic(); player?.destroy(); });

/* ==========================================================================
   Start
   ========================================================================== */
const params = new URLSearchParams(location.search);
const wantSkill = SKILLS.findIndex((s) => s.key === params.get('skill'));
if (params.get('mini') === 'mystery') showMystery();
else if (params.get('mini') === 'balloons') showBalloons();
else if (wantSkill >= 0) { skillIndex = wantSkill; startSkill(); }
else if (params.get('screen') === 'menu') showMenu();
else showSplash();
