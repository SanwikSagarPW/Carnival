import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('game.js', root), 'utf8');
const literal = (name) => {
  const match = new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\]|new Set\\(\\[[^\\]]*\\]\\));`).exec(source);
  assert.ok(match, `${name} not found in game.js`);
  return runInNewContext(`(${match[1]})`);
};
const shapes = literal('SHAPES');
const files = runInNewContext(`(${/const SHAPE_FILES = (\[[^\]]*\]);/.exec(source)[1]})`);
const lookalikes = literal('LOOKALIKES');
const exists = (path) => access(new URL(path, root)).then(() => true, () => false);

test('every shape has a tray piece and a picture pool', async () => {
  assert.ok(shapes.length >= 12, 'the shapes game should offer at least 12 shapes');
  assert.equal(files.length, shapes.length);
  assert.equal(new Set(shapes.map((s) => s.name)).size, shapes.length, 'shape names are unique');
  for (const shape of shapes) assert.ok(await exists(`assets/shapes/${shape.file}`), `${shape.file} is missing`);
});

test('every shape has one picture', async () => {
  assert.equal(new Set(files).size, files.length);
  for (const name of files) assert.ok(await exists(`assets/objects/shapes/${name}.webp`), `picture ${name} is missing`);
});

test('look-alike polygons are limited and every shape can appear in a round', () => {
  for (const index of lookalikes) assert.ok(index >= 0 && index < shapes.length);
  assert.ok(lookalikes.size < 4, 'rounds ask for 4 shapes, so at most 3 look-alikes can exist');
  // Rebuild the game's round rule many times: 4 distinct targets, at most one look-alike, and a spare that is not a target.
  const seenTargets = new Set();
  for (let i = 0; i < 4000; i++) {
    const order = shapes.map((_, index) => index).sort(() => Math.random() - 0.5);
    const targets = [];
    for (const shape of order) if (targets.length < 4 && !(lookalikes.has(shape) && targets.some((t) => lookalikes.has(t)))) targets.push(shape);
    const extra = order.find((s) => !targets.includes(s));
    assert.equal(targets.length, 4);
    assert.ok(targets.filter((t) => lookalikes.has(t)).length <= 1);
    assert.ok(extra !== undefined && !targets.includes(extra));
    targets.forEach((t) => seenTargets.add(t));
  }
  assert.equal(seenTargets.size, shapes.length, 'every shape should be able to be a target');
});

test('the prefetch list includes every shape picture and tray piece', async () => {
  const list = JSON.parse(await readFile(new URL('assets/preload.json', root), 'utf8'));
  for (const shape of shapes) assert.ok(list.images.includes(`assets/shapes/${shape.file}`), `${shape.file} is not prefetched`);
  for (const n of files) assert.ok(list.images.includes(`assets/objects/shapes/${n}.webp`), `picture ${n} is not prefetched`);
});
