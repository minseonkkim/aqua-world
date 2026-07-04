// Offline software renderer for AquaWorld fish GLBs → PNG thumbnails.
// No browser / no native GL: reads GLBs with @gltf-transform, rasterizes with a
// tiny z-buffered Lambert shader, and encodes PNGs via zlib. Used to (a) re-bake
// the compendium thumbnails in public/images/fish/ after model changes, and
// (b) produce comparison shots for design iteration.
//
// Run:  node scripts/bake-fish-thumbnails.mjs [--out DIR] [--size N] [--ss K]

import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FISH_DIR = resolve(__dirname, '..', 'public', 'models', 'fish');

// species id (thumbnail filename) → glb basename
const SPECIES_TO_MODEL = {
  clownfish: 'clownfish',
  guppy: 'guppy',
  goldfish: 'goldfish',
  seahorse: 'seahorse',
  zebrafish: 'zebrafish',
  betta: 'betta',
  angelfish: 'angelfish',
  mandarin_fish: 'mandarin',
  leafy_sea_dragon: 'sea_dragon',
  coelacanth: 'coelacanth',
};

// ---- args ----
const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT_DIR = resolve(getArg('--out', resolve(__dirname, '..', 'public', 'images', 'fish')));
const SIZE = parseInt(getArg('--size', '512'), 10);
const SS = parseInt(getArg('--ss', '4'), 10); // supersample factor
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// vec / matrix helpers
// ---------------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// column-major mat4 * vec3 (w=1)
function mulPoint(m, p) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}
function mulDir(m, p) {
  const [x, y, z] = p;
  return [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
}
function mulMat(a, b) {
  const o = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    let v = 0; for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = v;
  }
  return o;
}

// ---------------------------------------------------------------------------
// gather triangles from a GLB
// ---------------------------------------------------------------------------
function nodeWorldMatrix(node) {
  let m = node.getMatrix();
  let p = node.getParentNode ? node.getParentNode() : null;
  while (p) { m = mulMat(p.getMatrix(), m); p = p.getParentNode ? p.getParentNode() : null; }
  return m;
}

function gatherTris(doc) {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() || root.listScenes()[0];
  const tris = []; // {p:[3][3], n:[3][3], color:[r,g,b]}
  const visit = (node) => {
    const mesh = node.getMesh && node.getMesh();
    if (mesh) {
      const world = nodeWorldMatrix(node);
      for (const prim of mesh.listPrimitives()) {
        const posA = prim.getAttribute('POSITION');
        const nrmA = prim.getAttribute('NORMAL');
        const idxA = prim.getIndices();
        if (!posA || !idxA) continue;
        const pos = posA.getArray();
        const nrm = nrmA ? nrmA.getArray() : null;
        const idx = idxA.getArray();
        const mat = prim.getMaterial();
        const base = mat ? mat.getBaseColorFactor() : [0.8, 0.8, 0.8, 1];
        const color = [base[0], base[1], base[2]];
        for (let i = 0; i < idx.length; i += 3) {
          const wp = [], wn = [];
          for (let k = 0; k < 3; k++) {
            const vi = idx[i + k];
            wp.push(mulPoint(world, [pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]]));
            if (nrm) wn.push(norm(mulDir(world, [nrm[vi * 3], nrm[vi * 3 + 1], nrm[vi * 3 + 2]])));
          }
          if (!nrm) { // face normal fallback
            const fn = norm(cross(sub(wp[1], wp[0]), sub(wp[2], wp[0])));
            wn.push(fn, fn, fn);
          }
          tris.push({ p: wp, n: wn, color });
        }
      }
    }
    node.listChildren().forEach(visit);
  };
  scene.listChildren().forEach(visit);
  return tris;
}

// ---------------------------------------------------------------------------
// camera / shading config — gentle 3/4 side view, nose to the LEFT
// ---------------------------------------------------------------------------
// from center toward eye; --front tilts the camera around to look at the nose/mouth
const VIEW_DIR = argv.includes('--front') ? norm([-1, 0.25, -0.35]) : norm([-0.28, 0.22, -1]);
const LIGHTS = [
  { dir: norm([3, 5, 4]), intensity: 1.15, col: [1, 1, 1] },      // key (upper-front)
  { dir: norm([-3, 1.5, -2]), intensity: 0.4, col: [0.55, 0.72, 1] }, // cool rim/fill
];
const AMBIENT = 0.62;

function toSRGB(c) {
  c = Math.min(1, Math.max(0, c));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function renderFish(tris, size, ss) {
  const W = size * ss, H = size * ss;
  const color = new Float32Array(W * H * 4); // premultiplied-ish RGBA linear-ish
  const zbuf = new Float32Array(W * H).fill(-Infinity);

  // view basis
  const zc = VIEW_DIR;                       // toward eye
  const xc = norm(cross([0, 1, 0], zc));     // screen right
  const yc = norm(cross(zc, xc));            // screen up

  // bbox in view space
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let cx = 0, cy = 0, cz = 0, nv = 0;
  for (const t of tris) for (const p of t.p) { cx += p[0]; cy += p[1]; cz += p[2]; nv++; }
  const center = [cx / nv, cy / nv, cz / nv];
  const toView = (p) => { const d = sub(p, center); return [dot(d, xc), dot(d, yc), dot(d, zc)]; };
  for (const t of tris) for (const p of t.p) {
    const v = toView(p);
    minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
    minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
  }
  const spanX = maxX - minX, spanY = maxY - minY;
  const pad = 0.12;
  const span = Math.max(spanX, spanY) * (1 + pad * 2);
  const scale = W / span;
  const ox = (minX + maxX) / 2, oy = (minY + maxY) / 2;
  // screen: nose(+X world) → left. screenX axis xc = cross(up, zc); with VIEW_DIR z≈-1,
  // xc ≈ (-1,0,0) so world +X maps to negative view x → left. Good.
  const project = (p) => {
    const v = toView(p);
    return [
      W / 2 + (v[0] - ox) * scale,
      H / 2 - (v[1] - oy) * scale,
      v[2], // depth: larger = closer to eye
    ];
  };

  const shade = (n, col) => {
    let r = col[0] * AMBIENT, g = col[1] * AMBIENT, b = col[2] * AMBIENT;
    for (const L of LIGHTS) {
      const d = Math.max(0, dot(n, L.dir)) * L.intensity;
      r += col[0] * L.col[0] * d; g += col[1] * L.col[1] * d; b += col[2] * L.col[2] * d;
    }
    return [r, g, b];
  };

  for (const t of tris) {
    const s0 = project(t.p[0]), s1 = project(t.p[1]), s2 = project(t.p[2]);
    const minPx = Math.max(0, Math.floor(Math.min(s0[0], s1[0], s2[0])));
    const maxPx = Math.min(W - 1, Math.ceil(Math.max(s0[0], s1[0], s2[0])));
    const minPy = Math.max(0, Math.floor(Math.min(s0[1], s1[1], s2[1])));
    const maxPy = Math.min(H - 1, Math.ceil(Math.max(s0[1], s1[1], s2[1])));
    const area = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
    if (Math.abs(area) < 1e-9) continue;
    const c0 = shade(t.n[0], t.color), c1 = shade(t.n[1], t.color), c2 = shade(t.n[2], t.color);
    for (let py = minPy; py <= maxPy; py++) {
      for (let px = minPx; px <= maxPx; px++) {
        const fx = px + 0.5, fy = py + 0.5;
        let w0 = ((s1[0] - fx) * (s2[1] - fy) - (s2[0] - fx) * (s1[1] - fy)) / area;
        let w1 = ((s2[0] - fx) * (s0[1] - fy) - (s0[0] - fx) * (s2[1] - fy)) / area;
        let w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * s0[2] + w1 * s1[2] + w2 * s2[2];
        const pi = py * W + px;
        if (z <= zbuf[pi]) continue;
        zbuf[pi] = z;
        const ci = pi * 4;
        color[ci] = w0 * c0[0] + w1 * c1[0] + w2 * c2[0];
        color[ci + 1] = w0 * c0[1] + w1 * c1[1] + w2 * c2[1];
        color[ci + 2] = w0 * c0[2] + w1 * c1[2] + w2 * c2[2];
        color[ci + 3] = 1;
      }
    }
  }

  // downsample (box filter) → size×size RGBA8, sRGB-encoded
  const out = Buffer.alloc(size * size * 4);
  const inv = 1 / (ss * ss);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const pi = ((y * ss + sy) * W + (x * ss + sx)) * 4;
        r += color[pi]; g += color[pi + 1]; b += color[pi + 2]; a += color[pi + 3];
      }
      r *= inv; g *= inv; b *= inv; a *= inv;
      const oi = (y * size + x) * 4;
      // un-premultiply not needed (bg is 0); encode sRGB, keep straight alpha
      out[oi] = Math.round(toSRGB(a > 0 ? r / a : 0) * 255);
      out[oi + 1] = Math.round(toSRGB(a > 0 ? g / a : 0) * 255);
      out[oi + 2] = Math.round(toSRGB(a > 0 ? b / a : 0) * 255);
      out[oi + 3] = Math.round(a * 255);
    }
  }
  return out; // RGBA8
}

// ---------------------------------------------------------------------------
// minimal PNG encoder (RGBA, filter 0)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgba, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const io = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression])
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const only = getArg('--only', null); // optional single glb basename
for (const [species, model] of Object.entries(SPECIES_TO_MODEL)) {
  if (only && model !== only) continue;
  const glbPath = resolve(FISH_DIR, `${model}.glb`);
  const doc = await io.read(glbPath);
  const tris = gatherTris(doc);
  const rgba = renderFish(tris, SIZE, SS);
  const png = encodePNG(rgba, SIZE, SIZE);
  const outPath = resolve(OUT_DIR, `${species}.png`);
  writeFileSync(outPath, png);
  console.log(`✓ ${species.padEnd(16)} (${tris.length} tris) → ${outPath}`);
}
console.log('\nDone.');
