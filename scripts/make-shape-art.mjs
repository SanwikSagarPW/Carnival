// Draws the extra shapes for the "Match the shapes" game in the same glossy style as the existing art:
//   - assets/shapes/shape-<name>.svg      the smiling tray piece
//   - assets/objects/shapes/NN.webp       four glossy pictures per regular polygon (pentagon, hexagon, octagon)
// Run from the repo root:  npm i --no-save --no-package-lock sharp  &&  node scripts/make-shape-art.mjs
// Safe to re-run: it rewrites the same files. The rectangle reuses the existing pictures (4, 13, 22, 31, 39).
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const INK = '#2d1038';
const polygon = (sides, radius, startDeg, cx = 100, cy = 100) =>
  Array.from({ length: sides }, (_, i) => {
    const a = ((startDeg + (360 / sides) * i) * Math.PI) / 180;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  });
const points = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

// pentagon points up; hexagon and octagon sit flat on the ground like the shapes in a picture book
const REGULAR = {
  pentagon: { sides: 5, start: -90 },
  hexagon: { sides: 6, start: 0 },
  octagon: { sides: 8, start: 22.5 },
};

const COLOURS = {
  red: ['#ff8f86', '#ef3b3b', '#b3141f'],
  blue: ['#7fd6ff', '#2f9bf0', '#1560b8'],
  green: ['#9be86b', '#3fbf2c', '#1f8a1c'],
  yellow: ['#ffe97a', '#ffc21a', '#d98d00'],
  orange: ['#ffc06b', '#ff8a1f', '#d95d0a'],
  purple: ['#d3a6ff', '#9a52f0', '#6428b5'],
  pink: ['#ff9fd0', '#f04fa0', '#b5206e'],
};
const VARIANTS = {
  pentagon: ['purple', 'yellow', 'blue', 'green'],
  hexagon: ['orange', 'pink', 'green', 'blue'],
  octagon: ['red', 'blue', 'yellow', 'purple'],
};

function toySvg(name, colour) {
  const { sides, start } = REGULAR[name];
  const [light, base, dark] = COLOURS[colour];
  const shape = points(polygon(sides, 82, start));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <clipPath id="c"><polygon points="${shape}"/></clipPath>
  </defs>
  <polygon points="${shape}" fill="url(#g)" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
  <g clip-path="url(#c)">
    <ellipse cx="72" cy="60" rx="30" ry="11" fill="#fff" opacity=".55" transform="rotate(-28 72 60)"/>
    <ellipse cx="128" cy="150" rx="40" ry="9" fill="#fff" opacity=".16" transform="rotate(-8 128 150)"/>
  </g>
</svg>`;
}

// Tray pieces use the 100x100 smiling-face style of the existing shape-*.svg files.
const TRAY = {
  rectangle: { colours: ['#99f6e4', '#2dd4bf', '#0d9488'], draw: '<rect x="7" y="25" width="86" height="50" rx="10" fill="url(#g)" stroke="#0d9488" stroke-width="4.5" stroke-linejoin="round"/>', face: [38, 62, 49] },
  pentagon: { colours: ['#fecaca', '#f87171', '#dc2626'], regular: 'pentagon', face: [41, 59, 55] },
  hexagon: { colours: ['#d9f99d', '#a3e635', '#65a30d'], regular: 'hexagon', face: [41, 59, 48] },
  octagon: { colours: ['#c7d2fe', '#818cf8', '#4f46e5'], regular: 'octagon', face: [41, 59, 48] },
};

function traySvg(name) {
  const t = TRAY[name];
  const [light, base, stroke] = t.colours;
  const [leftEye, rightEye, eyeY] = t.face;
  let body = t.draw;
  if (t.regular) {
    const { sides, start } = REGULAR[t.regular];
    const cy = name === 'pentagon' ? 54 : 50;
    body = `<polygon points="${points(polygon(sides, name === 'pentagon' ? 44 : 43, start, 50, cy))}" fill="url(#g)" stroke="${stroke}" stroke-width="4.5" stroke-linejoin="round"/>`;
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="40%" cy="30%" r="75%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${base}"/>
    </radialGradient>
  </defs>
  ${body}
  <!-- Cute Face -->
  <circle cx="${leftEye}" cy="${eyeY}" r="3.5" fill="#0f172a"/>
  <circle cx="${rightEye}" cy="${eyeY}" r="3.5" fill="#0f172a"/>
  <ellipse cx="${leftEye - 7}" cy="${eyeY + 6}" rx="3.8" ry="2.1" fill="#f43f5e" opacity="0.45"/>
  <ellipse cx="${rightEye + 7}" cy="${eyeY + 6}" rx="3.8" ry="2.1" fill="#f43f5e" opacity="0.45"/>
  <path d="M 45 ${eyeY + 8} Q 50 ${eyeY + 14} 55 ${eyeY + 8}" stroke="#0f172a" stroke-width="2.8" fill="none" stroke-linecap="round"/>
</svg>
`;
}

for (const name of Object.keys(TRAY)) await writeFile(`assets/shapes/shape-${name}.svg`, traySvg(name));

// Pictures continue the existing numbering: files 01-40 are the original sheet, 41+ are drawn here.
let file = 41;
const pools = {};
for (const [name, colours] of Object.entries(VARIANTS)) {
  pools[name] = [];
  for (const colour of colours) {
    const png = await sharp(Buffer.from(toySvg(name, colour)), { density: 144 }).png().toBuffer();
    // Tight crop, then size like the original pictures (about 180px wide).
    const trimmed = await sharp(png).trim().toBuffer();
    await sharp(trimmed).resize({ width: 190, height: 190, fit: 'inside' }).webp({ quality: 86, alphaQuality: 95, effort: 6 })
      .toFile(`assets/objects/shapes/${String(file).padStart(2, '0')}.webp`);
    pools[name].push(file - 1);
    file++;
  }
}
console.log('picture pools (0-based, for SHAPE_ASSET_POOLS):', JSON.stringify(pools));
