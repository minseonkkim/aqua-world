// AquaWorld fish GLB generator.
// Builds stylized procedural fish meshes from profile-curve bodies plus
// proper paddle/forked fins, and writes them to public/models/fish/<id>.glb.
//
// Conventions:
//   +X = swim/forward direction (nose at +X, tail at -X)
//   +Y = up
//   +Z = right side of the fish
//
// Run:  node scripts/generate-fish-models.mjs

import { NodeIO, Document } from '@gltf-transform/core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'models', 'fish');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// 4x4 matrix helpers (column-major)
// ---------------------------------------------------------------------------
const M = {
  ident: () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
  translate: (tx, ty, tz) => [1,0,0,0, 0,1,0,0, 0,0,1,0, tx,ty,tz,1],
  scale: (sx, sy, sz) => [sx,0,0,0, 0,sy,0,0, 0,0,sz,0, 0,0,0,1],
  rotX: (r) => { const c=Math.cos(r), s=Math.sin(r); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; },
  rotY: (r) => { const c=Math.cos(r), s=Math.sin(r); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; },
  rotZ: (r) => { const c=Math.cos(r), s=Math.sin(r); return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]; },
  mul(a, b) {
    const out = new Array(16);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        let v = 0;
        for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
        out[c * 4 + r] = v;
      }
    }
    return out;
  },
  chain: (...mats) => mats.reduce((a, b) => M.mul(a, b), M.ident()),
};

function transformGeom(geom, mat) {
  const positions = new Array(geom.positions.length);
  const normals = new Array(geom.normals.length);
  for (let i = 0; i < geom.positions.length; i += 3) {
    const x = geom.positions[i], y = geom.positions[i + 1], z = geom.positions[i + 2];
    positions[i]     = mat[0] * x + mat[4] * y + mat[8]  * z + mat[12];
    positions[i + 1] = mat[1] * x + mat[5] * y + mat[9]  * z + mat[13];
    positions[i + 2] = mat[2] * x + mat[6] * y + mat[10] * z + mat[14];
  }
  for (let i = 0; i < geom.normals.length; i += 3) {
    const x = geom.normals[i], y = geom.normals[i + 1], z = geom.normals[i + 2];
    let nx = mat[0] * x + mat[4] * y + mat[8]  * z;
    let ny = mat[1] * x + mat[5] * y + mat[9]  * z;
    let nz = mat[2] * x + mat[6] * y + mat[10] * z;
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[i]     = nx / len;
    normals[i + 1] = ny / len;
    normals[i + 2] = nz / len;
  }
  return { positions, normals, indices: geom.indices.slice() };
}

// ---------------------------------------------------------------------------
// Color helpers — convert "#rrggbb" to linear [r,g,b]
// ---------------------------------------------------------------------------
function hex(h) {
  const v = h.replace('#', '');
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return [
    toLinear(parseInt(v.slice(0, 2), 16) / 255),
    toLinear(parseInt(v.slice(2, 4), 16) / 255),
    toLinear(parseInt(v.slice(4, 6), 16) / 255),
  ];
}

const WHITE = hex('#f4f4f4');
const BLACK = hex('#0a0a0a');

// ---------------------------------------------------------------------------
// fishBody — lathe-like body with non-circular elliptical cross-section.
// sideProfile(t) returns half-height (Y), topProfile(t) returns half-width (Z),
// for t in [0,1] (0 = nose at +length/2, 1 = tail base at -length/2).
// ---------------------------------------------------------------------------
function fishBody({ length, sideProfile, topProfile, segments = 36, rings = 20 }) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = length * (0.5 - t);
    const hy = Math.max(sideProfile(t), 0.001);
    const hz = Math.max(topProfile(t),  0.001);
    for (let j = 0; j <= rings; j++) {
      const a = (j / rings) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      positions.push(x, ca * hy, sa * hz);
      // Surface normal of an ellipse parameterised by a:
      // n = (cos(a)/hy, sin(a)/hz) then normalized
      const ny = ca / hy, nz = sa / hz;
      const nlen = Math.hypot(ny, nz) || 1;
      normals.push(0, ny / nlen, nz / nlen);
    }
  }
  const stride = rings + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < rings; j++) {
      const a = i * stride + j;
      indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }
  return { positions, normals, indices };
}

// Common profile shape — torpedo: rounded nose → max width 30%–60% → tapered peduncle.
function torpedoSide(maxR, peak = 0.4, pedunclePct = 0.18) {
  return (t) => {
    if (t < peak) return Math.sin((t / peak) * (Math.PI / 2)) * maxR;
    return maxR * (1 - (1 - pedunclePct) * Math.pow((t - peak) / (1 - peak), 1.2));
  };
}

// Tall, thin profile for angelfish-style bodies.
function discProfile(maxR, peak = 0.45) {
  return (t) => {
    const s = Math.sin(t * Math.PI);
    if (t < peak) return Math.pow(s, 0.55) * maxR;
    return Math.pow(s, 0.85) * maxR * (1 - (t - peak) * 0.3);
  };
}

// Spherical-ish profile for round fish (goldfish).
function roundProfile(maxR) {
  return (t) => Math.sin(t * Math.PI) * maxR;
}

// Elongated, eel-like profile.
function eelProfile(maxR, peak = 0.3) {
  return (t) => {
    if (t < peak) return Math.sin((t / peak) * (Math.PI / 2)) * maxR;
    return maxR * (1 - 0.92 * Math.pow((t - peak) / (1 - peak), 0.9));
  };
}

// ---------------------------------------------------------------------------
// Caudal (tail) fin — forked shape, lies in the X/Y plane at the peduncle.
// Base at +X (attaches to body), forks at -X. Double-sided.
// ---------------------------------------------------------------------------
function caudalFin({ spread, height, fork = 0.35, baseWidth = 0.12 }) {
  const outline = [
    [0,                       baseWidth],
    [-spread * 0.35,          height * 0.75],
    [-spread,                 height],
    [-spread * (1 - fork),    0],
    [-spread,                -height],
    [-spread * 0.35,         -height * 0.75],
    [0,                      -baseWidth],
  ];
  const positions = [];
  const normals = [];
  const indices = [];
  // hub at origin
  positions.push(0, 0, 0);
  normals.push(0, 0, 1);
  outline.forEach(([x, y]) => {
    positions.push(x, y, 0);
    normals.push(0, 0, 1);
  });
  for (let i = 1; i < outline.length; i++) {
    indices.push(0, i, i + 1);
    indices.push(0, i + 1, i); // back
  }
  return { positions, normals, indices };
}

// Single-lobe rounded fan tail (for goldfish-style double tails or carp-like).
function fanTail({ spread, height }) {
  const segs = 10;
  const positions = [0, 0, 0];
  const normals = [0, 0, 1];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const angle = (t - 0.5) * Math.PI * 1.1;
    const x = -spread * (0.5 + 0.5 * Math.cos(angle));
    const y = Math.sin(angle) * height;
    positions.push(x, y, 0);
    normals.push(0, 0, 1);
  }
  const indices = [];
  for (let i = 1; i <= segs; i++) {
    indices.push(0, i, i + 1, 0, i + 1, i);
  }
  return { positions, normals, indices };
}

// ---------------------------------------------------------------------------
// Dorsal/anal fin — sail-shaped, in X/Y plane. Base at y=0 along X axis,
// arched top edge peaking at y=+height. Use rotZ(±π) to flip for anal fin.
// ---------------------------------------------------------------------------
function sailFin({ length, height, peakPos = 0.55, frontSlope = 0.4 }) {
  const segs = 12;
  const positions = [];
  const normals = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = length * (t - 0.5);
    positions.push(x, 0, 0);
    normals.push(0, 0, 1);
    // Top edge: gentle arc with peak at peakPos
    let y;
    if (t < peakPos) {
      const u = t / peakPos;
      y = height * Math.pow(u, frontSlope);
    } else {
      const u = (t - peakPos) / (1 - peakPos);
      y = height * (1 - Math.pow(u, 1.3));
    }
    positions.push(x, y, 0);
    normals.push(0, 0, 1);
  }
  const indices = [];
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = c + 1;
    indices.push(a, c, b, b, c, d);
    indices.push(a, b, c, b, d, c); // back
  }
  return { positions, normals, indices };
}

// ---------------------------------------------------------------------------
// Pectoral fin — teardrop in X/Y plane. Attached at +X, sweeps back to -X.
// ---------------------------------------------------------------------------
function pectoralFin({ width, length, droop = 0 }) {
  const segs = 10;
  const positions = [0, 0, 0];
  const normals = [0, 0, 1];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const angle = (t - 0.5) * Math.PI;
    const r = Math.cos(angle * 0.85);
    const x = -length * (1 - r);
    const y = Math.sin(angle) * width - droop * (1 - Math.abs(2 * t - 1));
    positions.push(x, y, 0);
    normals.push(0, 0, 1);
  }
  const indices = [];
  for (let i = 1; i <= segs; i++) {
    indices.push(0, i, i + 1, 0, i + 1, i);
  }
  return { positions, normals, indices };
}

// ---------------------------------------------------------------------------
// Sphere helper for eyes, stripes, accents
// ---------------------------------------------------------------------------
function sphere(rx, ry, rz, latSeg = 10, lonSeg = 14) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i <= latSeg; i++) {
    const v = i / latSeg;
    const phi = v * Math.PI;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let j = 0; j <= lonSeg; j++) {
      const u = j / lonSeg;
      const th = u * Math.PI * 2;
      const st = Math.sin(th), ct = Math.cos(th);
      positions.push(rx * sp * ct, ry * cp, rz * sp * st);
      const nx = (sp * ct) / rx, ny = cp / ry, nz = (sp * st) / rz;
      const len = Math.hypot(nx, ny, nz) || 1;
      normals.push(nx / len, ny / len, nz / len);
    }
  }
  const stride = lonSeg + 1;
  for (let i = 0; i < latSeg; i++) {
    for (let j = 0; j < lonSeg; j++) {
      const a = i * stride + j;
      indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }
  return { positions, normals, indices };
}

// White-sclera + black-pupil eye pair. `pos` = center of eye on body surface.
// `side` = +1 (right side, +Z) or -1 (left side, -Z); pupil pokes outward.
function eyeParts(pos, size, side) {
  const [x, y, z] = pos;
  return [
    { name: 'eyewhite', color: WHITE,
      geom: transformGeom(sphere(size, size, size * 0.45, 8, 12),
        M.translate(x, y, z)) },
    { name: 'pupil', color: BLACK,
      geom: transformGeom(sphere(size * 0.55, size * 0.55, size * 0.30, 8, 12),
        M.translate(x, y, z + side * size * 0.25)) },
  ];
}

// Small dark mouth bump at nose.
function mouthPart(noseX, color = BLACK) {
  return { name: 'mouth', color,
    geom: transformGeom(sphere(0.025, 0.012, 0.04, 6, 10),
      M.translate(noseX - 0.01, -0.02, 0)) };
}

// ---------------------------------------------------------------------------
// Generic fish builder — composes body + fins + eyes from per-fish preset.
// ---------------------------------------------------------------------------
function buildGenericFish(preset) {
  const parts = [];
  const len = preset.length;
  const bodyColor = hex(preset.bodyColor);
  const finColor = hex(preset.finColor || preset.bodyColor);
  const bellyColor = preset.bellyColor ? hex(preset.bellyColor) : bodyColor;

  // body
  parts.push({ name: 'body', color: bodyColor,
    geom: fishBody({
      length: len,
      sideProfile: preset.sideProfile,
      topProfile: preset.topProfile,
    }) });

  // belly highlight — thin lower ellipsoid for two-tone effect
  if (preset.belly) {
    const b = preset.belly;
    parts.push({ name: 'belly', color: bellyColor,
      geom: transformGeom(sphere(b.length, b.height, b.width, 10, 16),
        M.translate(b.x ?? 0, b.y ?? -preset.maxHeight * 0.5, 0)) });
  }

  // stripes (vertical bands wrapping body)
  (preset.stripes || []).forEach((s, i) => {
    parts.push({ name: `stripe${i}`, color: hex(s.color),
      geom: transformGeom(sphere(s.thickness, s.heightR ?? preset.maxHeight * 1.02, s.widthR ?? preset.maxWidth * 1.02, 6, 14),
        M.translate(s.x, 0, 0)) });
  });

  // spots
  (preset.spots || []).forEach((s, i) => {
    [+1, -1].forEach((side) => {
      parts.push({ name: `spot${i}_${side}`, color: hex(s.color),
        geom: transformGeom(sphere(s.size, s.size * 0.8, s.size * 0.15, 6, 10),
          M.translate(s.x, s.y, side * preset.maxWidth * 0.98)) });
    });
  });

  // free-form ellipsoid accents — horizontal stripes, back patches, barbels 등
  // 세로 밴드(stripes)/측면 스팟(spots)으로 표현 못 하는 장식용
  (preset.ellipses || []).forEach((e, i) => {
    parts.push({ name: `ellipse${i}`, color: hex(e.color),
      geom: transformGeom(sphere(e.length, e.height, e.width, 10, 16),
        M.translate(e.x, e.y, e.z ?? 0)) });
  });

  // dorsal fin (top)
  if (preset.dorsal) {
    const d = preset.dorsal;
    const dorsalFin = sailFin({ length: d.length, height: d.height, peakPos: d.peakPos ?? 0.55 });
    parts.push({ name: 'dorsal', color: finColor,
      geom: transformGeom(dorsalFin,
        M.chain(M.translate(d.x ?? 0, d.attach ?? preset.maxHeight * 0.95, 0))) });
  }

  // second dorsal (some species)
  if (preset.dorsal2) {
    const d = preset.dorsal2;
    parts.push({ name: 'dorsal2', color: finColor,
      geom: transformGeom(sailFin({ length: d.length, height: d.height, peakPos: d.peakPos ?? 0.55 }),
        M.translate(d.x, d.attach ?? preset.maxHeight * 0.95, 0)) });
  }

  // anal fin (bottom) — flipped sail
  if (preset.anal) {
    const a = preset.anal;
    parts.push({ name: 'anal', color: finColor,
      geom: transformGeom(sailFin({ length: a.length, height: a.height, peakPos: a.peakPos ?? 0.5 }),
        M.chain(M.translate(a.x ?? 0, a.attach ?? -preset.maxHeight * 0.9, 0), M.rotZ(Math.PI))) });
  }

  // tail
  if (preset.tail) {
    const t = preset.tail;
    const tailGeom = t.style === 'fan' ? fanTail(t) : caudalFin(t);
    parts.push({ name: 'tail', color: finColor,
      geom: transformGeom(tailGeom, M.translate(-len * 0.5, t.y ?? 0, 0)) });
  }
  // double tail (goldfish)
  if (preset.tailDouble) {
    [[+1, 0.3], [-1, -0.3]].forEach(([sign, yOff], i) => {
      parts.push({ name: `tail${i}`, color: finColor,
        geom: transformGeom(fanTail(preset.tailDouble),
          M.chain(M.translate(-len * 0.5, yOff * preset.maxHeight, 0), M.rotZ(sign * 0.3))) });
    });
  }

  // pectoral fins (paired, sides)
  if (preset.pectoral) {
    const p = preset.pectoral;
    [+1, -1].forEach((side) => {
      parts.push({ name: `pec_${side}`, color: finColor,
        geom: transformGeom(pectoralFin({ width: p.width, length: p.length, droop: p.droop }),
          M.chain(
            M.translate(p.x, p.y, side * preset.maxWidth * 0.85),
            M.rotY(side * (p.flare ?? Math.PI / 3)),
            M.rotZ(p.tilt ?? -0.3),
          )) });
    });
  }

  // pelvic fins (smaller, below)
  if (preset.pelvic) {
    const p = preset.pelvic;
    [+1, -1].forEach((side) => {
      parts.push({ name: `pelv_${side}`, color: finColor,
        geom: transformGeom(pectoralFin({ width: p.width, length: p.length }),
          M.chain(
            M.translate(p.x, p.y, side * preset.maxWidth * 0.5),
            M.rotY(side * (p.flare ?? Math.PI / 4)),
            M.rotZ(-Math.PI / 2 - 0.2),
          )) });
    });
  }

  // eyes
  if (preset.eye) {
    const e = preset.eye;
    [+1, -1].forEach((side) => {
      eyeParts([e.x, e.y, side * (e.z ?? preset.maxWidth * 0.85)], e.size, side)
        .forEach(p => parts.push(p));
    });
  }

  // mouth
  if (preset.mouth !== false) {
    parts.push(mouthPart(len * 0.5, BLACK));
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Per-species presets
// ---------------------------------------------------------------------------

const PRESETS = {
  clownfish: {
    length: 1.2, maxHeight: 0.36, maxWidth: 0.24,
    bodyColor: '#ff7733', finColor: '#1a1a1a',
    sideProfile: torpedoSide(0.36, 0.35),
    topProfile:  torpedoSide(0.24, 0.40),
    stripes: [
      { x: 0.34,  thickness: 0.06, color: '#f5f5f5' },
      { x: 0.05,  thickness: 0.08, color: '#f5f5f5' },
      { x: -0.30, thickness: 0.06, color: '#f5f5f5' },
    ],
    dorsal:   { length: 0.7, height: 0.20, peakPos: 0.45, x: -0.05, attach: 0.30 },
    anal:     { length: 0.30, height: 0.12, x: -0.15, attach: -0.28 },
    tail:     { spread: 0.30, height: 0.32, fork: 0.20, baseWidth: 0.08 },
    pectoral: { x: 0.18, y: -0.05, width: 0.14, length: 0.22 },
    eye:      { x: 0.42, y: 0.08, size: 0.06 },
  },

  guppy: {
    length: 0.95, maxHeight: 0.18, maxWidth: 0.13,
    bodyColor: '#7ec8e3', finColor: '#c25aff',
    sideProfile: torpedoSide(0.18, 0.30, 0.10),
    topProfile:  torpedoSide(0.13, 0.30, 0.10),
    spots: [
      { x: -0.10, y: 0.02, size: 0.06, color: '#ffd166' },
      { x: -0.22, y: -0.02, size: 0.05, color: '#ff6b9d' },
    ],
    dorsal:   { length: 0.30, height: 0.15, x: -0.10, attach: 0.17 },
    anal:     { length: 0.20, height: 0.10, x: -0.15, attach: -0.15 },
    tail:     { spread: 0.55, height: 0.45, fork: 0.05, baseWidth: 0.05 }, // big veil
    pectoral: { x: 0.15, y: -0.02, width: 0.09, length: 0.16 },
    eye:      { x: 0.36, y: 0.04, size: 0.045 },
  },

  goldfish: {
    length: 1.0, maxHeight: 0.46, maxWidth: 0.36,
    bodyColor: '#ffb300', finColor: '#ff8a00',
    sideProfile: roundProfile(0.46),
    topProfile:  roundProfile(0.36),
    bellyColor: '#fff0a8',
    belly: { length: 0.30, height: 0.10, width: 0.30, x: 0.0, y: -0.32 },
    dorsal:   { length: 0.42, height: 0.28, peakPos: 0.50, x: 0.0, attach: 0.42 },
    anal:     { length: 0.22, height: 0.16, x: -0.20, attach: -0.40 },
    tailDouble: { spread: 0.40, height: 0.32 },
    pectoral: { x: 0.20, y: -0.05, width: 0.18, length: 0.22 },
    eye:      { x: 0.34, y: 0.10, size: 0.07, z: 0.35 },
  },

  seahorse: {
    // Built separately — vertical S-curve. Skip generic builder for body.
    custom: true,
  },

  zebrafish: {
    length: 0.95, maxHeight: 0.14, maxWidth: 0.11,
    bodyColor: '#f0e9c8', finColor: '#a5a5a5',
    sideProfile: torpedoSide(0.14, 0.35),
    topProfile:  torpedoSide(0.11, 0.35),
    stripes: [
      { x: 0.35,  thickness: 0.04, color: '#2a5fa8', heightR: 0.15, widthR: 0.12 },
      { x: 0.20,  thickness: 0.04, color: '#2a5fa8', heightR: 0.15, widthR: 0.12 },
      { x: 0.05,  thickness: 0.04, color: '#2a5fa8', heightR: 0.15, widthR: 0.12 },
      { x: -0.10, thickness: 0.04, color: '#2a5fa8', heightR: 0.15, widthR: 0.12 },
      { x: -0.25, thickness: 0.04, color: '#2a5fa8', heightR: 0.12, widthR: 0.10 },
    ],
    dorsal:   { length: 0.25, height: 0.10, x: -0.15, attach: 0.13 },
    anal:     { length: 0.18, height: 0.07, x: -0.18, attach: -0.12 },
    tail:     { spread: 0.28, height: 0.18, fork: 0.30, baseWidth: 0.04 },
    pectoral: { x: 0.20, y: -0.04, width: 0.08, length: 0.14 },
    eye:      { x: 0.36, y: 0.04, size: 0.04 },
  },

  betta: {
    length: 0.95, maxHeight: 0.22, maxWidth: 0.18,
    bodyColor: '#c92a2a', finColor: '#7a0d3a',
    sideProfile: torpedoSide(0.22, 0.30),
    topProfile:  torpedoSide(0.18, 0.30),
    dorsal:   { length: 0.60, height: 0.32, peakPos: 0.70, x: -0.10, attach: 0.20 },
    anal:     { length: 0.55, height: 0.30, peakPos: 0.50, x: -0.10, attach: -0.20 },
    tail:     { spread: 0.65, height: 0.55, fork: 0.05, baseWidth: 0.06 },
    pectoral: { x: 0.18, y: -0.03, width: 0.18, length: 0.32, droop: 0.10, flare: Math.PI / 2.5 },
    eye:      { x: 0.36, y: 0.07, size: 0.05 },
  },

  angelfish: {
    length: 0.85, maxHeight: 0.58, maxWidth: 0.10,
    bodyColor: '#d8d8e0', finColor: '#1a1a1a',
    sideProfile: discProfile(0.58, 0.45),
    topProfile:  discProfile(0.10, 0.45),
    stripes: [
      { x: 0.22,  thickness: 0.025, color: '#1a1a1a', heightR: 0.58, widthR: 0.105 },
      { x: 0.02,  thickness: 0.030, color: '#1a1a1a', heightR: 0.58, widthR: 0.105 },
      { x: -0.20, thickness: 0.025, color: '#1a1a1a', heightR: 0.50, widthR: 0.10 },
    ],
    dorsal:   { length: 0.55, height: 0.65, peakPos: 0.55, x: -0.05, attach: 0.55 },
    anal:     { length: 0.55, height: 0.55, peakPos: 0.55, x: -0.10, attach: -0.55 },
    tail:     { spread: 0.55, height: 0.50, fork: 0.10, baseWidth: 0.10 },
    pectoral: { x: 0.10, y: -0.10, width: 0.08, length: 0.40, droop: 0.30 },
    eye:      { x: 0.30, y: 0.18, size: 0.05, z: 0.10 },
  },

  mandarin: {
    length: 0.90, maxHeight: 0.22, maxWidth: 0.16,
    bodyColor: '#1670c4', finColor: '#ff7a1a',
    sideProfile: torpedoSide(0.22, 0.40),
    topProfile:  torpedoSide(0.16, 0.40),
    spots: [
      { x: 0.20, y: 0.08, size: 0.07, color: '#ff7a1a' },
      { x: 0.05, y: -0.04, size: 0.06, color: '#27c46b' },
      { x: -0.10, y: 0.06, size: 0.07, color: '#ffd166' },
      { x: -0.22, y: -0.03, size: 0.05, color: '#ff7a1a' },
    ],
    dorsal:   { length: 0.55, height: 0.20, peakPos: 0.55, x: -0.05, attach: 0.22 },
    anal:     { length: 0.30, height: 0.13, x: -0.18, attach: -0.20 },
    tail:     { spread: 0.32, height: 0.25, fork: 0.05, baseWidth: 0.07 },
    pectoral: { x: 0.18, y: -0.04, width: 0.13, length: 0.20 },
    eye:      { x: 0.34, y: 0.08, size: 0.05 },
  },

  sea_dragon: {
    length: 1.4, maxHeight: 0.16, maxWidth: 0.13,
    bodyColor: '#7fb069', finColor: '#4f7a45',
    sideProfile: eelProfile(0.16, 0.25),
    topProfile:  eelProfile(0.13, 0.25),
    // leafy appendages added below via custom branch
    eye:      { x: 0.55, y: 0.05, size: 0.04, z: 0.10 },
    mouth:    false,
  },

  coelacanth: {
    length: 1.5, maxHeight: 0.38, maxWidth: 0.33,
    bodyColor: '#3d4a78', finColor: '#2a3358',
    sideProfile: torpedoSide(0.38, 0.42, 0.30),
    topProfile:  torpedoSide(0.33, 0.42, 0.30),
    spots: [
      { x: 0.25, y: 0.05, size: 0.08, color: '#a8b8e0' },
      { x: 0.05, y: -0.10, size: 0.07, color: '#a8b8e0' },
      { x: -0.20, y: 0.08, size: 0.07, color: '#a8b8e0' },
      { x: -0.40, y: -0.05, size: 0.06, color: '#a8b8e0' },
    ],
    dorsal:   { length: 0.30, height: 0.20, peakPos: 0.40, x: 0.10, attach: 0.36 },
    dorsal2:  { length: 0.22, height: 0.18, peakPos: 0.50, x: -0.30, attach: 0.32 },
    anal:     { length: 0.25, height: 0.16, x: -0.30, attach: -0.32 },
    tail:     { spread: 0.45, height: 0.40, fork: 0.45, baseWidth: 0.10 },
    pectoral: { x: 0.25, y: -0.12, width: 0.18, length: 0.30, flare: Math.PI / 2.2 },
    pelvic:   { x: -0.05, y: -0.30, width: 0.12, length: 0.22 },
    eye:      { x: 0.50, y: 0.10, size: 0.07, z: 0.28 },
  },

  // ==================== v1.1.0 신규 10종 ====================

  neon_tetra: {
    length: 0.85, maxHeight: 0.16, maxWidth: 0.11,
    bodyColor: '#c9d6e0', finColor: '#b8c4cf',
    sideProfile: torpedoSide(0.16, 0.35),
    topProfile:  torpedoSide(0.11, 0.35),
    // 시그니처: 네온 블루 가로 스트라이프 + 꼬리쪽 빨간 스트라이프
    // 몸을 관통하는 큰 타원 대신 표면에 밀착하는 좌우 한 쌍 — 법선이 카메라를 향해 조명을 제대로 받는다
    ellipses: [
      { x: 0.02,  y: 0.04,  z: 0.105,  length: 0.22, height: 0.035, width: 0.02,  color: '#00c3ff' },
      { x: 0.02,  y: 0.04,  z: -0.105, length: 0.22, height: 0.035, width: 0.02,  color: '#00c3ff' },
      { x: -0.26, y: -0.02, z: 0.048,  length: 0.16, height: 0.045, width: 0.015, color: '#ff2e4d' },
      { x: -0.26, y: -0.02, z: -0.048, length: 0.16, height: 0.045, width: 0.015, color: '#ff2e4d' },
    ],
    dorsal:   { length: 0.20, height: 0.09, x: -0.08, attach: 0.15 },
    anal:     { length: 0.16, height: 0.07, x: -0.16, attach: -0.13 },
    tail:     { spread: 0.24, height: 0.16, fork: 0.30, baseWidth: 0.04 },
    pectoral: { x: 0.16, y: -0.03, width: 0.07, length: 0.12 },
    eye:      { x: 0.32, y: 0.03, size: 0.045 },
  },

  butterflyfish: {
    length: 0.85, maxHeight: 0.46, maxWidth: 0.10,
    bodyColor: '#ffd23f', finColor: '#ffb703',
    sideProfile: discProfile(0.46, 0.45),
    topProfile:  discProfile(0.10, 0.45),
    stripes: [
      // 눈을 가로지르는 검은 세로띠
      { x: 0.26, thickness: 0.035, color: '#1a1a1a', heightR: 0.40, widthR: 0.105 },
    ],
    spots: [
      // 꼬리쪽 아이스팟(가짜 눈)
      { x: -0.24, y: 0.16, size: 0.07, color: '#1a1a1a' },
    ],
    dorsal:   { length: 0.50, height: 0.30, peakPos: 0.55, x: -0.05, attach: 0.42 },
    anal:     { length: 0.40, height: 0.24, x: -0.08, attach: -0.42 },
    tail:     { spread: 0.30, height: 0.28, fork: 0.10, baseWidth: 0.08 },
    pectoral: { x: 0.12, y: -0.06, width: 0.09, length: 0.20 },
    eye:      { x: 0.28, y: 0.12, size: 0.05, z: 0.10 },
  },

  pufferfish: {
    length: 0.95, maxHeight: 0.42, maxWidth: 0.38,
    bodyColor: '#d9c26b', finColor: '#c4a94f',
    sideProfile: roundProfile(0.42),
    topProfile:  roundProfile(0.38),
    bellyColor: '#f7f0d8',
    belly: { length: 0.34, height: 0.14, width: 0.30, x: 0.02, y: -0.28 },
    spots: [
      { x: 0.18,  y: 0.14,  size: 0.06, color: '#6b5423' },
      { x: -0.02, y: 0.22,  size: 0.055, color: '#6b5423' },
      { x: -0.20, y: 0.10,  size: 0.06, color: '#6b5423' },
      { x: 0.02,  y: 0.02,  size: 0.05, color: '#6b5423' },
      { x: -0.24, y: -0.06, size: 0.045, color: '#6b5423' },
    ],
    dorsal:   { length: 0.18, height: 0.10, x: -0.18, attach: 0.38 },
    anal:     { length: 0.14, height: 0.09, x: -0.20, attach: -0.36 },
    tail:     { style: 'fan', spread: 0.26, height: 0.20 },
    pectoral: { x: 0.10, y: 0.0, width: 0.12, length: 0.16 },
    eye:      { x: 0.30, y: 0.16, size: 0.075, z: 0.28 },
  },

  blue_tang: {
    length: 1.0, maxHeight: 0.34, maxWidth: 0.12,
    bodyColor: '#1565e8', finColor: '#ffd400',
    sideProfile: discProfile(0.34, 0.40),
    topProfile:  discProfile(0.12, 0.40),
    // 등쪽 검은 팔레트 무늬 — 표면에 밀착하는 스팟으로 표현해야 조명을 정면으로 받는다
    spots: [
      { x: -0.02, y: 0.10, size: 0.11, color: '#0a1a3a' },
      { x: 0.14,  y: 0.02, size: 0.08, color: '#0a1a3a' },
      { x: -0.18, y: 0.06, size: 0.08, color: '#0a1a3a' },
    ],
    dorsal:   { length: 0.60, height: 0.16, peakPos: 0.50, x: -0.05, attach: 0.30 },
    anal:     { length: 0.45, height: 0.13, x: -0.10, attach: -0.28 },
    tail:     { spread: 0.30, height: 0.28, fork: 0.25, baseWidth: 0.08 },
    pectoral: { x: 0.16, y: -0.05, width: 0.11, length: 0.20 },
    eye:      { x: 0.36, y: 0.10, size: 0.05, z: 0.11 },
  },

  discus: {
    length: 0.80, maxHeight: 0.52, maxWidth: 0.11,
    bodyColor: '#c75b39', finColor: '#a34428',
    sideProfile: discProfile(0.52, 0.48),
    topProfile:  discProfile(0.11, 0.48),
    stripes: [
      // 청록 세로 워터마크 줄무늬 — 실루엣 위아래로 살짝 삐져나와야 측면에서도 보인다(엔젤피시 방식)
      { x: 0.22,  thickness: 0.022, color: '#5aa9d6', heightR: 0.46, widthR: 0.13 },
      { x: 0.06,  thickness: 0.025, color: '#5aa9d6', heightR: 0.55, widthR: 0.13 },
      { x: -0.10, thickness: 0.025, color: '#5aa9d6', heightR: 0.54, widthR: 0.13 },
      { x: -0.26, thickness: 0.022, color: '#5aa9d6', heightR: 0.47, widthR: 0.125 },
    ],
    dorsal:   { length: 0.58, height: 0.26, peakPos: 0.60, x: -0.04, attach: 0.44 },
    anal:     { length: 0.55, height: 0.24, peakPos: 0.55, x: -0.06, attach: -0.44 },
    tail:     { style: 'fan', spread: 0.28, height: 0.24 },
    pectoral: { x: 0.12, y: -0.08, width: 0.09, length: 0.22 },
    eye:      { x: 0.28, y: 0.12, size: 0.05, z: 0.11 },
  },

  koi: {
    length: 1.3, maxHeight: 0.30, maxWidth: 0.24,
    bodyColor: '#f2f2f2', finColor: '#e8e8e8',
    sideProfile: torpedoSide(0.30, 0.38, 0.22),
    topProfile:  torpedoSide(0.24, 0.38, 0.22),
    // 코이 특유의 홍백+먹 패치
    spots: [
      { x: 0.28,  y: 0.08,  size: 0.13, color: '#ff7f27' },
      { x: -0.12, y: 0.04,  size: 0.12, color: '#ff7f27' },
      { x: 0.06,  y: -0.04, size: 0.07, color: '#1a1a1a' },
    ],
    ellipses: [
      // 등 위 주황 패치
      { x: 0.10, y: 0.24, length: 0.20, height: 0.07, width: 0.18, color: '#ff7f27' },
    ],
    dorsal:   { length: 0.45, height: 0.14, peakPos: 0.45, x: -0.10, attach: 0.27 },
    anal:     { length: 0.20, height: 0.10, x: -0.30, attach: -0.24 },
    tail:     { style: 'fan', spread: 0.36, height: 0.30 },
    pectoral: { x: 0.30, y: -0.08, width: 0.14, length: 0.24 },
    eye:      { x: 0.52, y: 0.06, size: 0.055, z: 0.20 },
  },

  lionfish: {
    length: 1.0, maxHeight: 0.28, maxWidth: 0.20,
    bodyColor: '#c0392b', finColor: '#d95f4b',
    sideProfile: torpedoSide(0.28, 0.35),
    topProfile:  torpedoSide(0.20, 0.35),
    stripes: [
      { x: 0.30,  thickness: 0.035, color: '#f4e9dd', heightR: 0.29, widthR: 0.22 },
      { x: 0.14,  thickness: 0.040, color: '#f4e9dd', heightR: 0.31, widthR: 0.225 },
      { x: -0.03, thickness: 0.040, color: '#f4e9dd', heightR: 0.31, widthR: 0.225 },
      { x: -0.20, thickness: 0.035, color: '#f4e9dd', heightR: 0.28, widthR: 0.215 },
      { x: -0.35, thickness: 0.030, color: '#f4e9dd', heightR: 0.22, widthR: 0.18 },
    ],
    anal:     { length: 0.28, height: 0.14, x: -0.20, attach: -0.25 },
    tail:     { style: 'fan', spread: 0.30, height: 0.26 },
    eye:      { x: 0.38, y: 0.10, size: 0.05 },
    // 독가시 등지느러미·부채 가슴지느러미는 커스텀 빌더에서 추가
  },

  anglerfish: {
    length: 0.95, maxHeight: 0.38, maxWidth: 0.30,
    bodyColor: '#2b2233', finColor: '#1e1826',
    sideProfile: roundProfile(0.38),
    topProfile:  roundProfile(0.30),
    dorsal:   { length: 0.22, height: 0.12, x: -0.22, attach: 0.30 },
    anal:     { length: 0.18, height: 0.10, x: -0.24, attach: -0.28 },
    tail:     { style: 'fan', spread: 0.28, height: 0.24 },
    pectoral: { x: 0.05, y: -0.06, width: 0.12, length: 0.18 },
    eye:      { x: 0.30, y: 0.16, size: 0.06, z: 0.22 },
    // 발광 루어·이빨은 커스텀 빌더에서 추가
  },

  arowana: {
    length: 1.6, maxHeight: 0.26, maxWidth: 0.16,
    bodyColor: '#e8b84b', finColor: '#c93c3c',
    sideProfile: torpedoSide(0.26, 0.35, 0.35),
    topProfile:  torpedoSide(0.16, 0.35, 0.35),
    // 큼직한 금빛 비늘 하이라이트
    spots: [
      { x: 0.40,  y: 0.04,  size: 0.075, color: '#f7df8f' },
      { x: 0.18,  y: -0.03, size: 0.08,  color: '#f7df8f' },
      { x: -0.04, y: 0.05,  size: 0.08,  color: '#f7df8f' },
      { x: -0.26, y: -0.02, size: 0.075, color: '#f7df8f' },
      { x: -0.46, y: 0.03,  size: 0.065, color: '#f7df8f' },
    ],
    ellipses: [
      // 턱 수염 한 쌍 — 용을 닮은 시그니처
      { x: 0.82, y: -0.10, z: 0.03,  length: 0.10, height: 0.015, width: 0.015, color: '#e8b84b' },
      { x: 0.82, y: -0.10, z: -0.03, length: 0.10, height: 0.015, width: 0.015, color: '#e8b84b' },
    ],
    // 등·뒷지느러미가 몸 뒤쪽에 몰려 있는 실루엣
    dorsal:   { length: 0.50, height: 0.13, peakPos: 0.60, x: -0.42, attach: 0.20 },
    anal:     { length: 0.55, height: 0.13, peakPos: 0.55, x: -0.40, attach: -0.18 },
    tail:     { style: 'fan', spread: 0.26, height: 0.22 },
    pectoral: { x: 0.55, y: -0.08, width: 0.10, length: 0.22 },
    eye:      { x: 0.68, y: 0.06, size: 0.055, z: 0.13 },
  },

  oarfish: {
    length: 2.2, maxHeight: 0.16, maxWidth: 0.08,
    bodyColor: '#cdd6e0', finColor: '#e63946',
    sideProfile: eelProfile(0.16, 0.2),
    topProfile:  eelProfile(0.08, 0.2),
    // 몸 전체를 따라 흐르는 붉은 등지느러미
    dorsal:   { length: 1.9, height: 0.11, peakPos: 0.12, x: -0.05, attach: 0.10 },
    tail:     { spread: 0.14, height: 0.10, fork: 0.20, baseWidth: 0.03 },
    pectoral: { x: 0.85, y: -0.04, width: 0.05, length: 0.10 },
    eye:      { x: 0.98, y: 0.03, size: 0.045, z: 0.06 },
    // 머리 위 붉은 관(冠) 장식과 긴 배지느러미 스트리머는 커스텀 빌더에서 추가
  },
};

// ---------------------------------------------------------------------------
// Custom builders for fish that don't fit the generic profile (seahorse, sea_dragon)
// ---------------------------------------------------------------------------

function buildSeahorse() {
  const BODY = hex('#f5b042');
  const ACCENT = hex('#d4831a');
  const parts = [];
  // Vertical S-curve body — 9 stacked spheres tapering down. Head at +Y, tail at -Y curled forward (+X then -X).
  const segs = 9;
  const pts = [];
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const y = 0.70 - t * 1.5;
    // S-curve: x oscillates
    let x;
    if (t < 0.5) x = Math.sin(t * Math.PI * 0.9) * 0.18;
    else x = Math.sin(0.5 * Math.PI * 0.9) * 0.18 + Math.sin((t - 0.5) * Math.PI * 1.4) * -0.30;
    // Tip curls forward
    if (t > 0.85) x += (t - 0.85) * 0.6;
    const r = 0.20 * (1 - t * 0.65);
    pts.push({ x, y, r });
  }
  pts.forEach((p, i) => {
    parts.push({ name: `seg${i}`, color: i === 0 ? BODY : (i % 2 === 0 ? BODY : ACCENT),
      geom: transformGeom(sphere(p.r * 0.95, p.r, p.r * 0.85, 12, 16),
        M.translate(p.x, p.y, 0)) });
  });
  // Head — slightly bigger sphere at top with snout
  const head = pts[0];
  parts.push({ name: 'head', color: BODY,
    geom: transformGeom(sphere(0.20, 0.18, 0.16, 12, 16),
      M.translate(head.x + 0.05, head.y + 0.05, 0)) });
  // Snout — pointed forward
  parts.push({ name: 'snout', color: BODY,
    geom: transformGeom(sphere(0.16, 0.05, 0.05, 8, 12),
      M.translate(head.x + 0.22, head.y - 0.03, 0)) });
  // Crown ridge on top of head
  parts.push({ name: 'crown', color: ACCENT,
    geom: transformGeom(sailFin({ length: 0.12, height: 0.10, peakPos: 0.5 }),
      M.chain(M.translate(head.x + 0.04, head.y + 0.20, 0))) });
  // Dorsal fin — small fan on the back of the curve (mid body)
  const mid = pts[Math.floor(segs / 2)];
  parts.push({ name: 'dorsal', color: ACCENT,
    geom: transformGeom(sailFin({ length: 0.25, height: 0.08, peakPos: 0.5 }),
      M.chain(M.translate(mid.x - 0.18, mid.y, 0), M.rotZ(Math.PI / 2))) });
  // Eyes
  [+1, -1].forEach((side) => {
    eyeParts([head.x + 0.14, head.y + 0.05, side * 0.12], 0.035, side)
      .forEach(p => parts.push(p));
  });
  return parts;
}

function buildSeaDragon() {
  const preset = PRESETS.sea_dragon;
  const parts = buildGenericFish(preset);
  // Add leafy appendages — flat triangular fronds sticking out
  const LEAF = hex('#4f7a45');
  const LEAF_LIGHT = hex('#7fb069');
  const leafSpecs = [
    // [x, y, rotZ, scale, side]
    [0.55, 0.16, 0.4, 1.0, 0],
    [0.55, -0.16, -0.4, 1.0, 0],
    [0.30, 0.20, 0.8, 1.1, 0],
    [0.30, -0.20, -0.8, 1.1, 0],
    [0.05, 0.22, 1.0, 1.2, 0],
    [0.05, -0.22, -1.0, 1.2, 0],
    [-0.20, 0.20, 1.1, 1.0, 0],
    [-0.20, -0.20, -1.1, 1.0, 0],
    [-0.45, 0.18, 1.2, 0.9, 0],
    [-0.45, -0.18, -1.2, 0.9, 0],
  ];
  leafSpecs.forEach(([x, y, rot, scale, _s], i) => {
    const leaf = sailFin({ length: 0.18 * scale, height: 0.20 * scale, peakPos: 0.5 });
    parts.push({ name: `leaf${i}`, color: i % 2 === 0 ? LEAF : LEAF_LIGHT,
      geom: transformGeom(leaf,
        M.chain(M.translate(x, y, 0), M.rotZ(rot))) });
  });
  // Side leaves (sticking sideways from body)
  const sideLeafSpecs = [
    [0.40, 0.05], [0.10, 0.08], [-0.20, 0.0], [-0.45, -0.05],
  ];
  sideLeafSpecs.forEach(([x, y], i) => {
    [+1, -1].forEach((side) => {
      parts.push({ name: `sideleaf${i}_${side}`, color: LEAF_LIGHT,
        geom: transformGeom(sailFin({ length: 0.14, height: 0.16, peakPos: 0.5 }),
          M.chain(M.translate(x, y, side * 0.12), M.rotY(side * Math.PI / 2), M.rotZ(0.5))) });
    });
  });
  // Long thin snout
  parts.push({ name: 'snout', color: hex(preset.bodyColor),
    geom: transformGeom(sphere(0.12, 0.04, 0.04, 8, 12),
      M.translate(preset.length * 0.5 + 0.08, 0, 0)) });
  return parts;
}

function buildLionfish() {
  const preset = PRESETS.lionfish;
  const parts = buildGenericFish(preset);
  const SPINE = hex('#d95f4b');
  const SPINE_PALE = hex('#f4e9dd');
  // 등을 따라 늘어선 독가시 — 가늘고 뾰족한 sail 을 부챗살처럼 세운다
  const spineCount = 7;
  for (let i = 0; i < spineCount; i++) {
    const t = i / (spineCount - 1);
    const x = 0.32 - t * 0.62;
    const tilt = 0.55 - t * 0.75; // 앞쪽은 앞으로, 뒤쪽은 뒤로 기울기
    parts.push({ name: `spine${i}`, color: i % 2 === 0 ? SPINE : SPINE_PALE,
      geom: transformGeom(sailFin({ length: 0.05, height: 0.30 - Math.abs(t - 0.4) * 0.18, peakPos: 0.5 }),
        M.chain(M.translate(x, 0.24, 0), M.rotZ(tilt * 0.5))) });
  }
  // 부채처럼 활짝 펼친 가슴지느러미 — 양쪽 3장씩 각도를 달리해 겹친다
  [+1, -1].forEach((side) => {
    [-0.5, 0, 0.5].forEach((roll, i) => {
      parts.push({ name: `fan${i}_${side}`, color: i % 2 === 0 ? SPINE : SPINE_PALE,
        geom: transformGeom(pectoralFin({ width: 0.16, length: 0.45, droop: 0.05 }),
          M.chain(
            M.translate(0.15, -0.02, side * preset.maxWidth * 0.85),
            M.rotY(side * Math.PI / 2.6),
            M.rotX(side * roll),
            M.rotZ(-0.2),
          )) });
    });
  });
  return parts;
}

function buildAnglerfish() {
  const preset = PRESETS.anglerfish;
  const parts = buildGenericFish(preset);
  const BODY = hex(preset.bodyColor);
  const GLOW = hex('#aef6ff');
  // 이마에서 앞으로 굽는 루어 줄기 — 구를 촘촘히 이어붙여 끊김 없는 아치를 만든다
  const stalkPts = [
    [0.26, 0.34], [0.32, 0.40], [0.38, 0.45], [0.45, 0.48],
    [0.52, 0.49], [0.58, 0.47], [0.63, 0.44],
  ];
  stalkPts.forEach(([x, y], i) => {
    parts.push({ name: `stalk${i}`, color: BODY,
      geom: transformGeom(sphere(0.045, 0.055, 0.035, 6, 10), M.translate(x, y, 0)) });
  });
  // 발광 미끼 — emissive 로 빛나게
  parts.push({ name: 'lure', color: GLOW, emissive: [0.55, 0.95, 1.0],
    geom: transformGeom(sphere(0.055, 0.055, 0.055, 10, 14), M.translate(0.66, 0.42, 0)) });
  // 아래턱 삐죽 이빨
  const TOOTH = hex('#f4f4f4');
  [-0.10, -0.02, 0.06, 0.14].forEach((z, i) => {
    parts.push({ name: `tooth${i}`, color: TOOTH,
      geom: transformGeom(sphere(0.014, 0.05, 0.014, 5, 8),
        M.translate(0.44, -0.10, z)) });
  });
  return parts;
}

function buildOarfish() {
  const preset = PRESETS.oarfish;
  const parts = buildGenericFish(preset);
  const CREST = hex('#e63946');
  // 머리 위로 길게 뻗는 관(冠) 장식 — 뒤로 눕힌 가는 sail 3장
  [[1.0, 0.55, 0.9], [0.92, 0.65, 1.1], [0.84, 0.60, 1.3]].forEach(([x, h, rot], i) => {
    parts.push({ name: `crest${i}`, color: CREST,
      geom: transformGeom(sailFin({ length: 0.04, height: h, peakPos: 0.5 }),
        M.chain(M.translate(x, 0.12, 0), M.rotZ(rot - 1.0))) });
  });
  // 노처럼 늘어진 배지느러미 스트리머 한 쌍
  [+1, -1].forEach((side) => {
    parts.push({ name: `streamer_${side}`, color: CREST,
      geom: transformGeom(sphere(0.02, 0.45, 0.02, 6, 10),
        M.chain(M.translate(0.78, -0.42, side * 0.05), M.rotZ(0.25))) });
    // 스트리머 끝 노깃
    parts.push({ name: `paddle_${side}`, color: CREST,
      geom: transformGeom(sphere(0.05, 0.08, 0.02, 6, 10),
        M.translate(0.66, -0.82, side * 0.05)) });
  });
  return parts;
}

// ---------------------------------------------------------------------------
// glTF assembly
// ---------------------------------------------------------------------------
async function writeFishGlb(id, parts) {
  const doc = new Document();
  doc.createBuffer();
  const mesh = doc.createMesh(id);

  for (const part of parts) {
    const prim = doc.createPrimitive();
    prim.setAttribute('POSITION',
      doc.createAccessor().setType('VEC3').setArray(new Float32Array(part.geom.positions)));
    prim.setAttribute('NORMAL',
      doc.createAccessor().setType('VEC3').setArray(new Float32Array(part.geom.normals)));
    prim.setIndices(
      doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(part.geom.indices)));
    const mat = doc.createMaterial(`${id}_${part.name}`)
      .setBaseColorFactor([...part.color, 1])
      .setRoughnessFactor(0.55)
      .setMetallicFactor(0.0);
    if (part.emissive) mat.setEmissiveFactor(part.emissive);
    prim.setMaterial(mat);
    mesh.addPrimitive(prim);
  }

  const node = doc.createNode(id).setMesh(mesh);
  const scene = doc.createScene(id).addChild(node);
  doc.getRoot().setDefaultScene(scene);

  const io = new NodeIO();
  const outPath = resolve(OUT_DIR, `${id}.glb`);
  await io.write(outPath, doc);
  return outPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const BUILDERS = [
  ['clownfish',  () => buildGenericFish(PRESETS.clownfish)],
  ['guppy',      () => buildGenericFish(PRESETS.guppy)],
  ['goldfish',   () => buildGenericFish(PRESETS.goldfish)],
  ['seahorse',   () => buildSeahorse()],
  ['zebrafish',  () => buildGenericFish(PRESETS.zebrafish)],
  ['betta',      () => buildGenericFish(PRESETS.betta)],
  ['angelfish',  () => buildGenericFish(PRESETS.angelfish)],
  ['mandarin',   () => buildGenericFish(PRESETS.mandarin)],
  ['sea_dragon', () => buildSeaDragon()],
  ['coelacanth', () => buildGenericFish(PRESETS.coelacanth)],
  // v1.1.0 신규 10종
  ['neon_tetra',    () => buildGenericFish(PRESETS.neon_tetra)],
  ['butterflyfish', () => buildGenericFish(PRESETS.butterflyfish)],
  ['pufferfish',    () => buildGenericFish(PRESETS.pufferfish)],
  ['blue_tang',     () => buildGenericFish(PRESETS.blue_tang)],
  ['discus',        () => buildGenericFish(PRESETS.discus)],
  ['koi',           () => buildGenericFish(PRESETS.koi)],
  ['lionfish',      () => buildLionfish()],
  ['anglerfish',    () => buildAnglerfish()],
  ['arowana',       () => buildGenericFish(PRESETS.arowana)],
  ['oarfish',       () => buildOarfish()],
];

const written = [];
for (const [id, builder] of BUILDERS) {
  const out = await writeFishGlb(id, builder());
  written.push(out);
  console.log(`✓ ${id.padEnd(12)} → ${out}`);
}
console.log(`\nGenerated ${written.length} fish GLBs in ${OUT_DIR}`);
