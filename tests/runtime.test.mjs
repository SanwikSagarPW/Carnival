import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import { GameTimers } from '../timers.js';
import { decodeMeshPack } from '../sparky-animations/runtime/character-upgrade/12-sparky-final/mesh-pack.js';

const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

test('paused timers retain their remaining duration and run exactly once', async () => {
  const clock = new GameTimers();
  let fired = 0;
  clock.set(() => fired++, 80);
  await wait(20);
  clock.setPaused(true);
  await wait(100);
  assert.equal(fired, 0);
  clock.setPaused(false);
  await wait(100);
  assert.equal(fired, 1);
  assert.equal(clock.pending.size, 0);
});

test('timers created during pause and cancelled scene callbacks do not fire', async () => {
  const clock = new GameTimers();
  let fired = 0;
  clock.setPaused(true);
  const cancelled = clock.set(() => fired++, 10);
  clock.clear(cancelled);
  clock.set(() => fired++, 10);
  await wait(30);
  assert.equal(fired, 0);
  clock.clearAll();
  clock.setPaused(false);
  await wait(30);
  assert.equal(fired, 0);
});

test('compact mesh preserves every binding and stays below 0.25 rig units of rest-position error', async () => {
  const base = new URL('../sparky-animations/runtime/character-upgrade/12-sparky-final/', import.meta.url);
  const original = JSON.parse(await readFile(new URL('mesh-model.json', base), 'utf8'));
  const gz = await readFile(new URL('mesh-model.pack.gz', base));
  assert.ok(gz.byteLength < 1.5 * 1024 * 1024);
  const raw = gunzipSync(gz);
  const decoded = decodeMeshPack(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  assert.equal(decoded.meshes.length, original.meshes.length);
  let maxPositionError = 0;
  for (let m = 0; m < original.meshes.length; m++) {
    for (const [key, rows] of Object.entries(original.meshes[m].transfers)) {
      const packed = decoded.meshes[m].transfers[key];
      assert.equal(packed.length, rows.length);
      const points = original.cages[key].points;
      for (let row = 0; row < rows.length; row++) {
        assert.deepEqual(packed[row].indices, rows[row].indices);
        let dx = 0, dy = 0;
        for (let i = 0; i < rows[row].weights.length; i++) {
          const error = rows[row].weights[i] - packed[row].weights[i];
          assert.ok(Math.abs(error) <= 1 / 32768);
          dx += error * points[2 * rows[row].indices[i]];
          dy += error * points[2 * rows[row].indices[i] + 1];
        }
        maxPositionError = Math.max(maxPositionError, Math.hypot(dx, dy));
      }
    }
  }
  assert.ok(maxPositionError < .25, `Mesh error: ${maxPositionError}`);
});

test('truncated mesh data fails explicitly', () => {
  assert.throws(() => decodeMeshPack(new ArrayBuffer(2)), /Truncated/);
  const invalid = new ArrayBuffer(4);
  new DataView(invalid).setUint32(0, 100, true);
  assert.throws(() => decodeMeshPack(invalid), /Invalid mesh header/);
});

test('cache read failures log an error and preserve normal network loading', async () => {
  const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  for (const failOpen of [true, false]) {
    const request = new Request('https://game.example/assets/balloons/01.svg');
    let fetched = 0, warned = 0;
    const response = await runInNewContext(`${source}\nhandle(request, new URL(request.url), {});`, {
      self: { addEventListener() {} },
      caches: {
        async open() {
          if (failOpen) throw new Error('Cache unavailable');
          return { async match() { throw new Error('Cache read failed'); } };
        },
      },
      console: { warn() { warned++; } },
      async fetch(req) {
        assert.equal(req, request);
        fetched++;
        return new Response('network picture');
      },
      request, URL,
    });
    assert.equal(await response.text(), 'network picture');
    assert.equal(fetched, 1);
    assert.equal(warned, 1);
  }
});

test('cached audio ranges return the exact requested bytes without a network request', async () => {
  const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const request = new Request('https://game.example/speech.mp3', { headers: { Range: 'bytes=2-5' } });
  const response = await runInNewContext(`${source}\nhandle(request, new URL(request.url), {});`, {
    self: { addEventListener() {} },
    caches: {
      async open() {
        return { async match() { return new Response('0123456789', { headers: { 'Content-Type': 'audio/mpeg' } }); } };
      },
    },
    fetch() { assert.fail('Cached audio must not need the network'); },
    request, URL, Response,
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), 'bytes 2-5/10');
  assert.equal(await response.text(), '2345');
});
