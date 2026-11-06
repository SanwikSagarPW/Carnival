/**
 * audio.js — one place for every sound the game makes.
 *
 * Voice clips   : a single persistent <audio> element (so mobile browsers keep it
 *                 unlocked after the first tap). Every request gets a ticket; a stale
 *                 clip can never fire a callback after something newer has started.
 * Sound effects : small Web Audio synth (marimba, chime, pop, wobble).
 * Music         : very quiet lullaby that ducks while Sparky talks.
 */

const MASTER_VOLUME = 0.85;
const MUSIC_VOLUME = 0.02;
const MUSIC_DUCKED = 0.004;
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';

const MELODY = [
  523.25, null, 659.25, null, 783.99, null, 659.25, null,
  523.25, 523.25, 659.25, 783.99, 1046.5, null, null, null,
  880, null, 1046.5, null, 783.99, null, 659.25, null,
  587.33, null, 659.25, null, 523.25, null, null, null,
];

let enabled = true;
let paused = false;
let unlocked = false;
let ctx = null;
let master = null;
let musicBus = null;
let voice = null;          // the one <audio> element
let ticket = 0;            // bumps on every new/stopped clip
let current = null;        // { ticket, src, onEnd, watchdog }
let pending = null;        // clip asked for before the first tap
let musicTimer = null;
let musicStep = 0;
let musicWanted = false;
const lastPick = new Map();
const warmed = new Set();
let speechListener = null;

/** fn(true) when a dialogue clip starts playing, fn(false) when it ends or is stopped. */
export function onSpeechChange(fn) { speechListener = fn; }
const notifySpeech = (on) => {
  try { speechListener?.(on); } catch (e) { console.error(e); }
};

/* ---------- setup ---------- */

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? MASTER_VOLUME : 0;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 1;
    musicBus.connect(master);
  } catch {
    ctx = null;
  }
  return ctx;
}

function ensureVoice() {
  if (voice) return voice;
  voice = new Audio();
  voice.preload = 'auto';
  voice.addEventListener('ended', () => finish(current?.ticket, true));
  voice.addEventListener('playing', () => { if (current) notifySpeech(true); });
  voice.addEventListener('error', () => {
    console.warn('Dialogue could not load.', current?.src, voice.error);
    finish(current?.ticket, true);
  });
  voice.addEventListener('stalled', () => {
    // A clip that can't load must not leave the game waiting for it.
    const t = current?.ticket;
    setTimeout(() => {
      if (!paused && current?.ticket === t && voice.readyState < 3) {
        console.warn('Dialogue stalled.', current.src);
        finish(t, true);
      }
    }, 2500);
  });
  return voice;
}

/** Call from the first real tap/click. Safe to call again and again. */
export function unlock() {
  const c = ensureContext();
  if (c?.state === 'suspended') c.resume().catch(() => {});
  if (unlocked) return;
  unlocked = true;
  const v = ensureVoice();
  // Prime the element inside the gesture so later programmatic plays are allowed.
  try {
    v.src = SILENT_WAV;
    const p = v.play();
    p?.then(() => v.pause()).catch(() => {});
  } catch { /* ignore */ }
  if (pending) {
    const { src, opts } = pending;
    pending = null;
    setTimeout(() => speak(src, opts), 60);
  }
  if (musicWanted) startMusic();
}

export function isEnabled() { return enabled; }
export function isSpeaking() { return !!current; }

export function setPaused(value) {
  if (paused === value) return;
  paused = value;
  if (paused) {
    clearTimeout(musicTimer);
    if (current) {
      current.remaining = Math.max(0, current.deadline - performance.now());
      clearTimeout(current.watchdog);
      voice?.pause();
    }
    ctx?.suspend().catch((error) => console.warn('Unable to suspend audio.', error));
  } else {
    if (unlocked) ctx?.resume().catch((error) => console.warn('Unable to resume audio.', error));
    if (current && voice) {
      const t = current.ticket;
      current.deadline = performance.now() + current.remaining;
      current.watchdog = setTimeout(() => finish(t, true), current.remaining);
      voice.play().catch((error) => {
        if (error.name !== 'AbortError') {
          console.warn('Unable to resume dialogue.', error);
          finish(t, true);
        }
      });
    } else if (pending && unlocked) {
      const next = pending;
      pending = null;
      speak(next.src, next.opts);
    }
    if (musicWanted) startMusic();
  }
}

export function setEnabled(on) {
  enabled = on;
  if (master && ctx) master.gain.setTargetAtTime(on ? MASTER_VOLUME : 0, ctx.currentTime, 0.02);
  if (!on) {
    stopSpeech();
    clearTimeout(musicTimer);
  } else {
    if (musicWanted) startMusic();
  }
}

/* ---------- voice clips ---------- */

function finish(t, natural) {
  if (!current || current.ticket !== t) return;
  const done = current;
  current = null;
  clearTimeout(done.watchdog);
  voice?.pause();
  duck(false);
  notifySpeech(false);
  if (natural && done.onEnd) {
    try { done.onEnd(); } catch (e) { console.error(e); }
  }
}

/**
 * Speak a clip. Starting a new clip always stops the previous one.
 * opts.onEnd  — called once, only if THIS clip finished (or failed to load).
 * opts.delay  — wait a moment first (lets a sound effect land before the voice).
 * opts.ifIdle — skip entirely when something is already being said.
 */
export function speak(src, opts = {}) {
  if (!src) return;
  if (opts.ifIdle && current) return;
  if (!enabled) return;
  if (!unlocked || paused) { pending = { src, opts }; return; }

  const myTicket = ++ticket;
  stopSpeech(false);
  const v = ensureVoice();
  current = { ticket: myTicket, src, onEnd: opts.onEnd || null, watchdog: null };

  const begin = () => {
    if (current?.ticket !== myTicket) return;
    try {
      v.src = src;
      v.currentTime = 0;
      duck(true);
      const p = v.play();
      p?.then(() => { if (paused && current?.ticket === myTicket) v.pause(); }).catch((err) => {
        if (err?.name === 'AbortError') return; // replaced by a newer clip
        console.warn('Unable to play dialogue.', src, err);
        finish(myTicket, true);
      });
      // No clip is longer than a minute; never wait forever.
      current.remaining = 60000;
      current.deadline = performance.now() + current.remaining;
      current.watchdog = setTimeout(() => finish(myTicket, true), current.remaining);
    } catch (error) {
      console.warn('Dialogue playback failed.', src, error);
      finish(myTicket, true);
    }
  };
  if (opts.delay) setTimeout(begin, opts.delay); else begin();
}

export function stopSpeech(clearPending = true) {
  if (clearPending) pending = null;
  ticket++;
  if (current) {
    clearTimeout(current.watchdog);
    current = null;
    notifySpeech(false);
  }
  if (voice) {
    try { voice.pause(); } catch { /* ignore */ }
  }
  duck(false);
}

/** Random clip that avoids repeating the previous one from the same list. */
export function pick(list) {
  if (!list?.length) return undefined;
  if (list.length === 1) return list[0];
  const last = lastPick.get(list);
  let next;
  do { next = list[Math.floor(Math.random() * list.length)]; } while (next === last);
  lastPick.set(list, next);
  return next;
}

/** Warm the HTTP cache so the next clip starts instantly. */
export function warm(list = []) {
  if (navigator.connection?.saveData || /(^|-)[23]g$/.test(navigator.connection?.effectiveType || '')) return;
  list.forEach((src) => {
    if (!src || warmed.has(src)) return;
    warmed.add(src);
    fetch(src, { priority: 'low' }).then(async (response) => {
      if (!response.ok) throw new Error(`Dialogue HTTP ${response.status}`);
      await response.arrayBuffer();
    }).catch((error) => {
      warmed.delete(src);
      console.warn('Dialogue prefetch failed; playback will retry.', src, error);
    });
  });
}

function duck(on) {
  if (!musicBus || !ctx) return;
  musicBus.gain.setTargetAtTime(on ? MUSIC_DUCKED / MUSIC_VOLUME : 1, ctx.currentTime, 0.08);
}

/* ---------- synth ---------- */

function tone(hz, { delay = 0, dur = 0.22, vol = 0.08, type = 'sine', bus = master, overtone = 0 } = {}) {
  const c = ensureContext();
  if (!c || !enabled || !bus) return;
  const t0 = c.currentTime + delay;
  const voices = [[hz, type, vol, dur]];
  if (overtone) voices.push([hz * 3.9, 'triangle', vol * overtone, dur * 0.45]);
  voices.forEach(([f, ty, v, d]) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = ty;
    o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g);
    g.connect(bus);
    o.start(t0);
    o.stop(t0 + d + 0.03);
  });
}

const marimba = (hz, delay, dur, vol) => tone(hz, { delay, dur, vol, overtone: 0.35 });
const chime = (hz, delay, dur, vol) => tone(hz, { delay, dur, vol });

function sweep(from, to, dur, vol) {
  const c = ensureContext();
  if (!c || !enabled) return;
  const t0 = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t0);
  o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

const TAP_NOTES = [523.25, 587.33, 659.25, 783.99, 880];

export function sfx(kind = 'tap', n = 0) {
  if (!enabled) return;
  const c = ensureContext();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});

  switch (kind) {
    case 'tap':
      marimba(TAP_NOTES[Math.floor(Math.random() * TAP_NOTES.length)], 0, 0.16, 0.07);
      break;
    case 'success':
      [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => {
        marimba(hz, i * 0.07, 0.25, 0.09);
        chime(hz * 2, i * 0.07 + 0.02, 0.22, 0.04);
      });
      break;
    case 'wrong':
      sweep(320, 220, 0.22, 0.05);
      break;
    case 'match':
      marimba(659.25, 0, 0.2, 0.07);
      marimba(880, 0.08, 0.28, 0.08);
      chime(1318.5, 0.08, 0.32, 0.04);
      break;
    case 'fanfare':
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((hz, i) => {
        const t = [0, 0.08, 0.16, 0.24, 0.36, 0.48][i];
        marimba(hz, t, 0.35, 0.09);
        chime(hz, t + 0.02, 0.4, 0.05);
      });
      break;
    case 'transition':
      marimba(587.33, 0, 0.18, 0.06);
      marimba(880, 0.09, 0.24, 0.07);
      break;
    case 'giggle':
      [880, 1046.5, 880, 1174.66, 1318.5].forEach((hz, i) => marimba(hz, i * 0.05, 0.12, 0.06));
      break;
    case 'pop':
      sweep(600, 140, 0.09, 0.08);
      // each balloon pops a little higher than the last
      if (n) marimba(523.25 + n * 110, 0.02, 0.22, 0.07);
      break;
    case 'whoosh':
      sweep(260, 520, 0.14, 0.03);
      break;
    default:
  }
}

/* ---------- background music ---------- */

function stepMusic() {
  clearTimeout(musicTimer);
  if (!enabled || !musicWanted || paused || document.hidden) return;
  const note = MELODY[musicStep++ % MELODY.length];
  if (note && ctx?.state === 'running') {
    tone(note, { dur: 0.28, vol: MUSIC_VOLUME, bus: musicBus, overtone: 0.35 });
  }
  musicTimer = setTimeout(stepMusic, 420);
}

export function startMusic() {
  musicWanted = true;
  if (!unlocked || !enabled || paused) return;
  ensureContext();
  clearTimeout(musicTimer);
  musicTimer = setTimeout(stepMusic, 600);
}

export function stopMusic() {
  musicWanted = false;
  clearTimeout(musicTimer);
}

/* ---------- lifecycle ---------- */

// iOS/Safari can drop the context after a call or lock screen.
['pointerdown', 'keydown'].forEach((ev) =>
  document.addEventListener(ev, () => {
    if (!paused && (ctx?.state === 'suspended' || ctx?.state === 'interrupted')) ctx.resume().catch(() => {});
  }, { passive: true })
);
