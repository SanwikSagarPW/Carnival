// Asset optimiser: PNG -> WebP and 192 kbps voice clips -> 48 kbps mono MP3.
// Run from the repo root:  npm i --no-save --no-package-lock sharp ffmpeg-static  &&  node scripts/optimize-assets.mjs
// Safe to re-run: files that are already converted are skipped.
import { readdir, readFile, writeFile, rm, stat, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
let before = 0, after = 0;

async function toWebp(file, opts) {
  const out = file.replace(/\.png$/i, '.webp');
  const src = (await stat(file)).size;
  await sharp(file).webp({ effort: 6, ...opts }).toFile(out);
  const dst = (await stat(out)).size;
  before += src; after += dst;
  await rm(file);
}

// Game art: backdrop and activity objects (pixel sizes are unchanged, so "bigger/longer" still holds).
const art = [];
for await (const f of walk('assets/objects')) if (extname(f).toLowerCase() === '.png') art.push(f);
for (const f of art) await toWebp(f, { quality: 86, alphaQuality: 95 });
if (existsSync('assets/carnival-midway.png')) await toWebp('assets/carnival-midway.png', { quality: 80 });

// Sparky rig textures: atlas coordinates depend on pixel size, so only the codec changes.
const rig = 'sparky-animations/runtime';
for await (const f of walk(rig)) {
  if (extname(f).toLowerCase() === '.png') await toWebp(f, { quality: 92, alphaQuality: 100 });
}
for await (const f of walk(rig)) {
  if (extname(f) !== '.atlas') continue;
  const text = await readFile(f, 'utf8');
  const next = text.replace(/^(.*)\.png\b/gm, '$1.webp');
  if (next !== text) await writeFile(f, next);
}
for (const f of ['sparky-animations/runtime/character-upgrade/06-lucas-construction/manifest.json', 'sparky-animations/files.json']) {
  const text = await readFile(f, 'utf8');
  const next = text.replace(/(Lucas_Activity_Icecream|Forearm-v1|Glove-Gloss-v1|Measured-UpperArm-v1|Native_Props|Reference-Iris-v1|Shirt-Redraw-v2|Shorts-Redraw-v3|SleeveFeather|Sparky_Painted-f592a4b974|Unified-Shirt-v2)\.png/g, '$1.webp');
  if (next !== text) await writeFile(f, next);
}

// Voice clips: speech only, so mono 48 kbps is transparent for children's dialogue.
// Already-converted clips (32 kHz) are skipped so re-running never re-encodes twice.
async function alreadyOptimised(file) {
  const b = await readFile(file);
  let i = 0;
  if (b.toString('latin1', 0, 3) === 'ID3') i = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]);
  for (; i < b.length - 3; i++) if (b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0) return ((b[i + 2] >> 2) & 3) === 2;
  return false;
}
let mp3Before = 0, mp3After = 0;
for await (const f of walk('Dialogues')) {
  if (extname(f).toLowerCase() !== '.mp3' || await alreadyOptimised(f)) continue;
  const size = (await stat(f)).size;
  const tmp = f + '.tmp.mp3';
  const r = spawnSync(ffmpeg, ['-y', '-v', 'error', '-i', f, '-map_metadata', '-1', '-ac', '1', '-ar', '32000', '-codec:a', 'libmp3lame', '-b:a', '48k', tmp]);
  if (r.status !== 0) throw new Error('ffmpeg failed for ' + f + ': ' + String(r.stderr));
  const out = (await stat(tmp)).size;
  mp3Before += size;
  if (out < size) { await rm(f); await rename(tmp, f); mp3After += out; } else { await rm(tmp); mp3After += size; }
}

// The rig skeleton is a 1.8 MB binary that hosts often serve uncompressed. A gzip copy is ~30% of the size and
// is unpacked in the browser by FullCharacterPlayer (the raw .skel stays as the fallback).
const skel = 'sparky-animations/runtime/character-upgrade/06-lucas-construction/source/Lucas_Activity_Icecream.skel';
if (existsSync(skel)) await writeFile(skel + '.gz', gzipSync(await readFile(skel), { level: 9 }));

// Everything the game can ask for, for the idle-time background prefetch (see prefetchEverything in game.js).
const list = async (dir, ext) => {
  const out = [];
  if (existsSync(dir)) for await (const f of walk(dir)) if (ext.includes(extname(f).toLowerCase())) out.push(encodeURI(f.split('\\').join('/')));
  return out.sort();
};
await writeFile('assets/preload.json', JSON.stringify({
  images: [...await list('assets/objects', ['.webp']), ...await list('assets/balloons', ['.svg']), ...await list('assets/shapes', ['.svg']),
    'assets/mystery-box.svg', 'assets/mystery-box-open.svg'],
  audio: await list('Dialogues', ['.mp3']),
}));

console.log(`images: ${mb(before)} -> ${mb(after)}`);
console.log(`audio : ${mb(mp3Before)} -> ${mb(mp3After)}`);
