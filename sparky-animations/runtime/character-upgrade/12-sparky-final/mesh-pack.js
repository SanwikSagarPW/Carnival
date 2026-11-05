// Decoder for mesh-model.pack(.gz), produced by scripts/pack-mesh-model.mjs. Returns the same object shape as the
// original mesh-model.json, so callers need no other change.
export async function loadMeshModel(baseURL) {
  if (typeof DecompressionStream === 'function') {
    try {
      const res = await fetch(new URL('mesh-model.pack.gz', baseURL));
      if (!res.ok || !res.body) throw new Error('gz unavailable');
      return decodeMeshPack(await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    } catch (error) {
      console.warn('Compressed mesh unavailable; retrying the uncompressed pack.', error);
    }
  }
  const res = await fetch(new URL('mesh-model.pack', baseURL));
  if (!res.ok) throw new Error('Unable to load mesh model');
  return decodeMeshPack(await res.arrayBuffer());
}

export function decodeMeshPack(buffer) {
  if (buffer.byteLength < 4) throw new Error('Truncated mesh pack');
  const jsonLength = new DataView(buffer).getUint32(0, true);
  if (jsonLength > buffer.byteLength - 4) throw new Error('Invalid mesh header');
  const model = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, jsonLength)));
  const base = 4 + jsonLength;
  const n = (buffer.byteLength - base) / 2;
  if (!Number.isInteger(n) || !Number.isFinite(model.weightScale) || model.weightScale <= 0) {
    throw new Error('Invalid mesh weights');
  }
  const bytes = new Uint8Array(buffer, base);
  const scale = model.weightScale;
  let p = 0;
  for (const mesh of model.meshes) {
    for (const key of Object.keys(mesh.transfers)) {
      mesh.transfers[key] = mesh.transfers[key].map(([start, count]) => {
        if (!Number.isInteger(start) || start < 0 || !Number.isInteger(count) || count < 1 || p + count > n) {
          throw new Error('Invalid mesh binding');
        }
        const indices = new Array(count);
        const weights = new Array(count);
        for (let i = 0; i < count; i++, p++) {
          indices[i] = start + i;
          weights[i] = ((((bytes[p] << 8) | bytes[n + p]) << 16) >> 16) / scale;
        }
        return { indices, weights };
      });
    }
  }
  if (p !== n) throw new Error('Unexpected mesh payload');
  return model;
}
