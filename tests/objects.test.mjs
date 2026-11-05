import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('game.js', root), 'utf8');
const count = Number(/const ASSET_COUNT = (\d+);/.exec(source)?.[1]);
const kindsMatch = /const KINDS = (\[[\s\S]*?\n\]);/.exec(source);
assert.ok(kindsMatch, 'KINDS not found in game.js');
const kinds = runInNewContext(`(${kindsMatch[1]})`);
const exists = (path) => access(new URL(path, root)).then(() => true, () => false);

test('all 40 shared item pictures are present and prefetched', async () => {
  const list = JSON.parse(await readFile(new URL('assets/preload.json', root), 'utf8'));
  assert.equal(count, 40);
  for (let i = 1; i <= count; i++) {
    const path = `assets/objects/pics/${String(i).padStart(2, '0')}.webp`;
    assert.ok(await exists(path), `${path} is missing`);
    assert.ok(list.images.includes(path), `${path} is not prefetched`);
  }
});

test('different-object kind mapping covers every item exactly once', () => {
  const indices = kinds.flat();
  assert.equal(new Set(indices).size, indices.length);
  assert.deepEqual([...indices].sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i));
});
