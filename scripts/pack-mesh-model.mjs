// Packs the 34 MB rig mesh model into a compact binary the browser can decode in milliseconds.
// Run from the repo root:  node scripts/pack-mesh-model.mjs
//
// The "transfers" weight tables are 99.9% of mesh-model.json. Every table entry covers a contiguous index range, so only
// [start, count] plus the quantised weights are stored. Weights are 16-bit fixed point (max error 3e-5), written as all
// high bytes followed by all low bytes, which gzips about 25% smaller than interleaved bytes.
//
// Output (decoded by loadMeshModel in mesh-pack.js):
//   mesh-model.pack     uncompressed  (~2.8 MB, fallback for browsers without DecompressionStream)
//   mesh-model.pack.gz  gzip          (~1.3 MB, preferred)
// Layout: u32le jsonLength | json (transfers entries replaced by [start,count]) | N high bytes | N low bytes
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const dir = 'sparky-animations/runtime/character-upgrade/12-sparky-final/';
const model = JSON.parse(await readFile(dir + 'mesh-model.json', 'utf8'));
const SCALE = 16384;

const weights = [];
for (const mesh of model.meshes) {
  for (const key of Object.keys(mesh.transfers)) {
    mesh.transfers[key] = mesh.transfers[key].map(({ indices, weights: w }) => {
      indices.forEach((v, i) => { if (v !== indices[0] + i) throw new Error('Non-contiguous indices in ' + mesh.name); });
      for (const x of w) {
        const q = Math.round(x * SCALE);
        if (q > 32767 || q < -32768) throw new Error('Weight out of range: ' + x);
        weights.push(q);
      }
      return [indices[0], indices.length];
    });
  }
}
model.weightScale = SCALE;

const json = Buffer.from(JSON.stringify(model), 'utf8');
const head = Buffer.alloc(4);
head.writeUInt32LE(json.length);
const hi = Buffer.alloc(weights.length);
const lo = Buffer.alloc(weights.length);
weights.forEach((q, i) => { hi[i] = (q >> 8) & 255; lo[i] = q & 255; });

const pack = Buffer.concat([head, json, hi, lo]);
const gz = gzipSync(pack, { level: 9 });
await writeFile(dir + 'mesh-model.pack', pack);
await writeFile(dir + 'mesh-model.pack.gz', gz);
console.log(`weights ${weights.length}, pack ${(pack.length / 1048576).toFixed(2)} MB, gz ${(gz.length / 1048576).toFixed(2)} MB`);
