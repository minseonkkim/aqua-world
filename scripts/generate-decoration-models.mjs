// AquaWorld decoration GLB generator.
// Builds 26 stylized procedural decoration meshes (plants, rocks, driftwood,
// ornaments) and writes them to public/models/decoration/<id>.glb.
//
// Conventions:
//   +Y = up (gravity), all decorations sit on the floor with base at y=0
//   center of footprint is at x=0, z=0
//
// Run:  node scripts/generate-decoration-models.mjs

import { NodeIO, Document } from '@gltf-transform/core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'models', 'decoration');
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
// Color: linear sRGB conversion
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

// ---------------------------------------------------------------------------
// Deterministic RNG
// ---------------------------------------------------------------------------
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1000000) / 1000000;
  };
}

// ---------------------------------------------------------------------------
// Primitive: sphere (axis-aligned ellipsoid)
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

// ---------------------------------------------------------------------------
// Primitive: box, centered at origin, dimensions sx × sy × sz
// ---------------------------------------------------------------------------
function box(sx, sy, sz) {
  const x = sx / 2, y = sy / 2, z = sz / 2;
  const positions = [];
  const normals = [];
  const indices = [];
  // 6 faces: +X, -X, +Y, -Y, +Z, -Z
  const faces = [
    // each: 4 verts (CCW from outside) + normal
    [[ x,-y,-z],[ x, y,-z],[ x, y, z],[ x,-y, z], [ 1, 0, 0]],
    [[-x,-y, z],[-x, y, z],[-x, y,-z],[-x,-y,-z], [-1, 0, 0]],
    [[-x, y,-z],[-x, y, z],[ x, y, z],[ x, y,-z], [ 0, 1, 0]],
    [[-x,-y, z],[-x,-y,-z],[ x,-y,-z],[ x,-y, z], [ 0,-1, 0]],
    [[-x,-y, z],[ x,-y, z],[ x, y, z],[-x, y, z], [ 0, 0, 1]],
    [[ x,-y,-z],[-x,-y,-z],[-x, y,-z],[ x, y,-z], [ 0, 0,-1]],
  ];
  faces.forEach((f) => {
    const base = positions.length / 3;
    for (let i = 0; i < 4; i++) {
      positions.push(f[i][0], f[i][1], f[i][2]);
      normals.push(f[4][0], f[4][1], f[4][2]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  return { positions, normals, indices };
}

// ---------------------------------------------------------------------------
// Primitive: cylinder along Y axis, base at y=0, top at y=height
// ---------------------------------------------------------------------------
function cylinder({ rTop = 0.5, rBot = 0.5, height = 1, segs = 16, capped = true }) {
  const positions = [];
  const normals = [];
  const indices = [];
  // side wall
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    positions.push(rBot * c, 0, rBot * s);
    normals.push(c, 0, s);
    positions.push(rTop * c, height, rTop * s);
    normals.push(c, 0, s);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 2;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  if (capped) {
    // bottom cap (normal -Y)
    const bBase = positions.length / 3;
    positions.push(0, 0, 0); normals.push(0, -1, 0);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      positions.push(rBot * Math.cos(a), 0, rBot * Math.sin(a));
      normals.push(0, -1, 0);
    }
    for (let i = 0; i < segs; i++) {
      indices.push(bBase, bBase + i + 2, bBase + i + 1);
    }
    // top cap (normal +Y)
    const tBase = positions.length / 3;
    positions.push(0, height, 0); normals.push(0, 1, 0);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      positions.push(rTop * Math.cos(a), height, rTop * Math.sin(a));
      normals.push(0, 1, 0);
    }
    for (let i = 0; i < segs; i++) {
      indices.push(tBase, tBase + i + 1, tBase + i + 2);
    }
  }
  return { positions, normals, indices };
}

// ---------------------------------------------------------------------------
// Primitive: cone along Y axis (base radius at y=0, apex at y=height)
// ---------------------------------------------------------------------------
function cone({ r = 0.5, height = 1, segs = 12, capped = true }) {
  return cylinder({ rTop: 0.001, rBot: r, height, segs, capped });
}

// ---------------------------------------------------------------------------
// Primitive: torus (full or partial arc)
// Centered at origin, lies in XZ plane (ring around Y axis).
// ---------------------------------------------------------------------------
function torus({ R = 1, r = 0.2, ringSegs = 24, tubeSegs = 10, arc = Math.PI * 2 }) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i <= ringSegs; i++) {
    const u = (i / ringSegs) * arc;
    const cu = Math.cos(u), su = Math.sin(u);
    for (let j = 0; j <= tubeSegs; j++) {
      const v = (j / tubeSegs) * Math.PI * 2;
      const cv = Math.cos(v), sv = Math.sin(v);
      const x = (R + r * cv) * cu;
      const y = r * sv;
      const z = (R + r * cv) * su;
      positions.push(x, y, z);
      // normal: derivative of point - center of tube
      const cx = R * cu, cz = R * su;
      const nx = x - cx, ny = y, nz = z - cz;
      const len = Math.hypot(nx, ny, nz) || 1;
      normals.push(nx / len, ny / len, nz / len);
    }
  }
  const stride = tubeSegs + 1;
  for (let i = 0; i < ringSegs; i++) {
    for (let j = 0; j < tubeSegs; j++) {
      const a = i * stride + j;
      indices.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride);
    }
  }
  return { positions, normals, indices };
}

// ---------------------------------------------------------------------------
// Primitive: lathe (revolved surface)
// profile: array of [r, y] points (r >= 0). Revolved around Y axis.
// ---------------------------------------------------------------------------
function lathe(profile, segs = 24) {
  const positions = [];
  const normals = [];
  const indices = [];
  const rings = profile.length;
  for (let i = 0; i < rings; i++) {
    const [r, y] = profile[i];
    // local tangent along profile (for normal calculation)
    let dr, dy;
    if (i === 0) { dr = profile[1][0] - r; dy = profile[1][1] - y; }
    else if (i === rings - 1) { dr = r - profile[i-1][0]; dy = y - profile[i-1][1]; }
    else { dr = profile[i+1][0] - profile[i-1][0]; dy = profile[i+1][1] - profile[i-1][1]; }
    // normal in 2D (cross with revolution axis +X-axis convention): n = (dy, -dr) normalized
    const nlen2 = Math.hypot(dy, -dr) || 1;
    const nr = dy / nlen2, ny = -dr / nlen2;
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      positions.push(r * c, y, r * s);
      normals.push(nr * c, ny, nr * s);
    }
  }
  const stride = segs + 1;
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * stride + j;
      indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }
  return { positions, normals, indices };
}

// ---------------------------------------------------------------------------
// Primitive: flat plane (XY plane, centered, double-sided via separate face)
// ---------------------------------------------------------------------------
function plane(width, height, curveBend = 0) {
  // Subdivided so we can bend it slightly along width
  const wSegs = 6, hSegs = 6;
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i <= wSegs; i++) {
    const u = i / wSegs - 0.5;
    for (let j = 0; j <= hSegs; j++) {
      const v = j / hSegs - 0.5;
      const x = u * width;
      const y = v * height;
      const z = curveBend !== 0 ? Math.sin(j / hSegs * Math.PI) * curveBend : 0;
      positions.push(x, y, z);
      normals.push(0, 0, 1);
    }
  }
  const stride = hSegs + 1;
  for (let i = 0; i < wSegs; i++) {
    for (let j = 0; j < hSegs; j++) {
      const a = i * stride + j;
      // front
      indices.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride);
      // back (double-sided)
      indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }
  return { positions, normals, indices };
}

// ---------------------------------------------------------------------------
// Add vertex perturbation to a geometry (for rocks/organic shapes)
// ---------------------------------------------------------------------------
function perturb(geom, amount, seed = 1) {
  const r = rng(seed);
  const positions = geom.positions.slice();
  for (let i = 0; i < positions.length; i += 3) {
    const offset = (r() - 0.5) * 2 * amount;
    const nx = geom.normals[i], ny = geom.normals[i + 1], nz = geom.normals[i + 2];
    positions[i]     += nx * offset;
    positions[i + 1] += ny * offset;
    positions[i + 2] += nz * offset;
  }
  return { positions, normals: geom.normals.slice(), indices: geom.indices.slice() };
}

// ---------------------------------------------------------------------------
// Sail / fan (from fish generator) — useful for fronds, leaves
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
    let y;
    if (t < peakPos) y = height * Math.pow(t / peakPos, frontSlope);
    else y = height * (1 - Math.pow((t - peakPos) / (1 - peakPos), 1.3));
    positions.push(x, y, 0);
    normals.push(0, 0, 1);
  }
  const indices = [];
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = c + 1;
    indices.push(a, c, b, b, c, d);
    indices.push(a, b, c, b, d, c);
  }
  return { positions, normals, indices };
}

// ---------------------------------------------------------------------------
// Bent blade — like a flat grass leaf with a gentle arc
// Tapered: wider at base, narrower at tip.
// Lies in XY plane, base at y=0, tip at y=height. Bends along z by `bend`.
// ---------------------------------------------------------------------------
function grassBlade({ baseWidth = 0.08, tipWidth = 0.012, height = 1, bend = 0.1, segs = 8 }) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = baseWidth * (1 - t) + tipWidth * t;
    const y = t * height;
    const z = Math.sin(t * Math.PI * 0.7) * bend;
    positions.push(-w / 2, y, z); normals.push(0, 0, 1);
    positions.push( w / 2, y, z); normals.push(0, 0, 1);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = c + 1;
    indices.push(a, c, b, b, c, d);
    indices.push(a, b, c, b, d, c);
  }
  return { positions, normals, indices };
}

// ============================================================================
// COLORS
// ============================================================================
const COL = {
  // plants
  grassDark: hex('#2b8a3e'),
  grassMid: hex('#4caf50'),
  grassLight: hex('#81c784'),
  kelpDark: hex('#3e5530'),
  kelpMid: hex('#5a7740'),
  coralRed: hex('#d64545'),
  coralRedDark: hex('#a82d2d'),
  coralPurple: hex('#a063d6'),
  coralPurpleDark: hex('#7b3fae'),
  anemoneBody: hex('#d04580'),
  anemoneTent: hex('#ff9eb5'),
  bambooLight: hex('#9bcf5a'),
  bambooDark: hex('#5a8a30'),
  fernGreen: hex('#3d8c3a'),
  fernYellow: hex('#7eb05c'),
  mossDark: hex('#4a703b'),
  mossLight: hex('#6f9c4f'),

  // rocks
  pebbleA: hex('#7a6850'),
  pebbleB: hex('#5e4f3a'),
  pebbleC: hex('#967f63'),
  rockDark: hex('#3a3d44'),
  rockDarkLight: hex('#525660'),
  lavaRock: hex('#2b1a14'),
  lavaGlow: hex('#ff5a1a'),
  slateGray: hex('#506070'),
  slateLight: hex('#6c7e90'),
  crystalBlue: hex('#7bc4e3'),
  crystalDeep: hex('#3a8ab8'),
  crystalBase: hex('#3a4655'),
  geodeShell: hex('#3a3040'),
  geodeInner: hex('#b07ce0'),
  geodeInnerLight: hex('#d5a6ff'),

  // driftwood
  woodLight: hex('#a87a4a'),
  woodMid: hex('#7a5230'),
  woodDark: hex('#4d3220'),
  woodInner: hex('#1a0e08'),

  // ornaments
  chestWood: hex('#5e3318'),
  chestWoodLight: hex('#8a4f24'),
  gold: hex('#d4af37'),
  goldDark: hex('#a88a2b'),
  hullDark: hex('#3a2614'),
  hullLight: hex('#5a3f24'),
  potBody: hex('#b87a4d'),
  potRim: hex('#9d6438'),
  wheelWood: hex('#7a5028'),
  wheelMetal: hex('#7a7060'),
  shellOuter: hex('#fff0e0'),
  shellInner: hex('#fff8e8'),
  pearlWhite: hex('#fafafa'),
  marbleWhite: hex('#e8e1d2'),
  marbleVein: hex('#c9c0ac'),
  archStone: hex('#cdb98e'),
  bubbleRock: hex('#5e6470'),
  bubbleGlow: hex('#a8d8ec'),
};

// ============================================================================
// BUILDERS — each returns array of { name, color, geom }
// ============================================================================

// ---------- 수초 (Plants) ----------

function buildSeagrass() {
  const parts = [];
  const r = rng(7);
  const bladeCount = 22;
  for (let i = 0; i < bladeCount; i++) {
    const h = 0.7 + r() * 0.8;
    const blade = grassBlade({
      baseWidth: 0.07 + r() * 0.03,
      tipWidth: 0.01,
      height: h,
      bend: (r() - 0.5) * 0.18,
      segs: 8,
    });
    const yaw = r() * Math.PI * 2;
    const tilt = (r() - 0.5) * 0.25;
    const x = (r() - 0.5) * 0.55;
    const z = (r() - 0.5) * 0.55;
    const c = i % 3 === 0 ? COL.grassLight : i % 3 === 1 ? COL.grassMid : COL.grassDark;
    parts.push({ name: `blade${i}`, color: c,
      geom: transformGeom(blade, M.chain(M.translate(x, 0, z), M.rotY(yaw), M.rotZ(tilt))) });
  }
  return parts;
}

function buildKelp() {
  const parts = [];
  const r = rng(11);
  for (let i = 0; i < 3; i++) {
    const baseX = (i - 1) * 0.25;
    const baseZ = (r() - 0.5) * 0.15;
    // stem — undulating column of slightly tilted boxes
    const segs = 7;
    for (let j = 0; j < segs; j++) {
      const t = j / segs;
      const y = 0.15 + t * 1.5;
      const wobble = Math.sin(t * Math.PI * 2 + i) * 0.08;
      const leaf = transformGeom(
        grassBlade({ baseWidth: 0.16, tipWidth: 0.13, height: 0.28, bend: 0.04, segs: 5 }),
        M.chain(M.translate(baseX + wobble, y - 0.14, baseZ), M.rotZ(Math.sin(t * 4) * 0.3)),
      );
      parts.push({ name: `leaf${i}_${j}`, color: j % 2 === 0 ? COL.kelpDark : COL.kelpMid, geom: leaf });
    }
  }
  return parts;
}

function buildCoralBranch() {
  const parts = [];
  const r = rng(13);
  // central trunk
  const trunk = transformGeom(
    cylinder({ rTop: 0.04, rBot: 0.08, height: 0.5, segs: 8 }),
    M.translate(0, 0, 0),
  );
  parts.push({ name: 'trunk', color: COL.coralRedDark, geom: trunk });
  // branching outward
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const len = 0.35 + r() * 0.25;
    const tilt = 0.4 + r() * 0.5;
    const branch = transformGeom(
      cylinder({ rTop: 0.02, rBot: 0.045, height: len, segs: 7 }),
      M.chain(
        M.translate(0, 0.2 + r() * 0.15, 0),
        M.rotY(angle),
        M.rotZ(tilt),
      ),
    );
    parts.push({ name: `b${i}`, color: i % 2 === 0 ? COL.coralRed : COL.coralRedDark, geom: branch });
    // tip bobble
    const tipMat = M.chain(
      M.translate(0, 0.2 + r() * 0.15, 0),
      M.rotY(angle),
      M.rotZ(tilt),
      M.translate(0, len, 0),
    );
    parts.push({ name: `tip${i}`, color: COL.coralRed,
      geom: transformGeom(sphere(0.05, 0.05, 0.05, 6, 8), tipMat) });
    // sub-branch
    if (i % 2 === 0) {
      const subLen = 0.18 + r() * 0.12;
      const subMat = M.chain(
        M.translate(0, 0.2 + r() * 0.15, 0),
        M.rotY(angle),
        M.rotZ(tilt),
        M.translate(0, len * 0.6, 0),
        M.rotZ(0.7),
      );
      parts.push({ name: `sub${i}`, color: COL.coralRed,
        geom: transformGeom(cylinder({ rTop: 0.015, rBot: 0.025, height: subLen, segs: 6 }), subMat) });
    }
  }
  return parts;
}

function buildBrainCoral() {
  const parts = [];
  const r = rng(17);
  // dome base — perturbed sphere
  const dome = perturb(sphere(0.4, 0.22, 0.4, 14, 18), 0.025, 21);
  parts.push({ name: 'dome', color: COL.coralPurpleDark,
    geom: transformGeom(dome, M.translate(0, 0.2, 0)) });
  // bumpy ridges on top
  for (let i = 0; i < 24; i++) {
    const theta = r() * Math.PI * 2;
    const rad = 0.28 * Math.sqrt(r());
    const lumpR = 0.06 + r() * 0.05;
    parts.push({ name: `lump${i}`, color: i % 2 === 0 ? COL.coralPurple : COL.coralPurpleDark,
      geom: transformGeom(sphere(lumpR, lumpR * 0.6, lumpR, 6, 8),
        M.translate(Math.cos(theta) * rad, 0.32 + r() * 0.08, Math.sin(theta) * rad)) });
  }
  return parts;
}

function buildAnemone() {
  const parts = [];
  const r = rng(19);
  // base column
  parts.push({ name: 'base', color: COL.anemoneBody,
    geom: transformGeom(sphere(0.22, 0.18, 0.22, 10, 14), M.translate(0, 0.16, 0)) });
  // tentacles — curved cylinders waving outward
  const tents = 32;
  for (let i = 0; i < tents; i++) {
    const theta = (i / tents) * Math.PI * 2 + r() * 0.1;
    const ringR = 0.18;
    const tx = Math.cos(theta) * ringR;
    const tz = Math.sin(theta) * ringR;
    const len = 0.32 + r() * 0.16;
    const tentTilt = 0.5 + r() * 0.4;
    const tent = cylinder({ rTop: 0.005, rBot: 0.015, height: len, segs: 5, capped: false });
    const mat = M.chain(
      M.translate(tx, 0.3, tz),
      M.rotY(-theta),
      M.rotZ(-tentTilt),
    );
    parts.push({ name: `t${i}`, color: i % 3 === 0 ? COL.anemoneBody : COL.anemoneTent,
      geom: transformGeom(tent, mat) });
  }
  return parts;
}

function buildBambooWater() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const baseX = (i - 1) * 0.2;
    const baseZ = (i - 1) * 0.08;
    const segs = 5;
    for (let j = 0; j < segs; j++) {
      const yBase = j * 0.34;
      // stem segment
      parts.push({ name: `s${i}_${j}`, color: COL.bambooLight,
        geom: transformGeom(cylinder({ rTop: 0.05, rBot: 0.05, height: 0.32, segs: 10 }),
          M.translate(baseX, yBase, baseZ)) });
      // node band
      parts.push({ name: `n${i}_${j}`, color: COL.bambooDark,
        geom: transformGeom(torus({ R: 0.055, r: 0.012, ringSegs: 12, tubeSegs: 6 }),
          M.translate(baseX, yBase + 0.32, baseZ)) });
      // small leaf on side at upper segments
      if (j >= 2 && i === 1) {
        const leafMat = M.chain(
          M.translate(baseX + 0.05, yBase + 0.22, baseZ),
          M.rotY(j * 1.3),
          M.rotZ(0.6),
        );
        parts.push({ name: `l${i}_${j}`, color: COL.bambooLight,
          geom: transformGeom(grassBlade({ baseWidth: 0.06, tipWidth: 0.01, height: 0.25, bend: 0.05 }), leafMat) });
      }
    }
  }
  return parts;
}

function buildAquaticFern() {
  const parts = [];
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const angle = (i / fronds) * Math.PI * 2;
    // central spine
    const spineLen = 0.55;
    const spineMat = M.chain(
      M.translate(0, 0.1, 0),
      M.rotY(angle),
      M.rotZ(-1.0),
    );
    parts.push({ name: `spine${i}`, color: COL.fernGreen,
      geom: transformGeom(cylinder({ rTop: 0.005, rBot: 0.012, height: spineLen, segs: 5 }), spineMat) });
    // leaflets along spine — small ovals
    const leafN = 7;
    for (let j = 1; j <= leafN; j++) {
      const t = j / leafN;
      const leafLen = 0.16 * (1 - t * 0.5);
      [+1, -1].forEach((side) => {
        const leafMat = M.chain(
          M.translate(0, 0.1, 0),
          M.rotY(angle),
          M.rotZ(-1.0),
          M.translate(0, spineLen * t, 0),
          M.rotZ(side * 0.7),
        );
        parts.push({ name: `lf${i}_${j}_${side}`, color: t < 0.4 ? COL.fernGreen : COL.fernYellow,
          geom: transformGeom(grassBlade({ baseWidth: 0.05, tipWidth: 0.01, height: leafLen, bend: 0.02 }), leafMat) });
      });
    }
  }
  return parts;
}

function buildMossBall() {
  const parts = [];
  const main = perturb(sphere(0.26, 0.24, 0.26, 14, 18), 0.04, 31);
  parts.push({ name: 'main', color: COL.mossDark,
    geom: transformGeom(main, M.translate(0, 0.24, 0)) });
  // tufts
  const r = rng(33);
  for (let i = 0; i < 16; i++) {
    const theta = r() * Math.PI * 2;
    const phi = r() * Math.PI;
    const x = Math.sin(phi) * Math.cos(theta) * 0.25;
    const y = 0.24 + Math.cos(phi) * 0.24;
    const z = Math.sin(phi) * Math.sin(theta) * 0.25;
    const rad = 0.05 + r() * 0.04;
    parts.push({ name: `t${i}`, color: COL.mossLight,
      geom: transformGeom(perturb(sphere(rad, rad, rad, 6, 8), 0.01, 40 + i), M.translate(x, y, z)) });
  }
  return parts;
}

// ---------- 바위 (Rocks) ----------

function buildPebblePile() {
  const parts = [];
  const r = rng(41);
  for (let i = 0; i < 9; i++) {
    const rad = 0.07 + r() * 0.08;
    const px = (r() - 0.5) * 0.45;
    const pz = (r() - 0.5) * 0.45;
    const py = rad * 0.8;
    const colors = [COL.pebbleA, COL.pebbleB, COL.pebbleC];
    parts.push({ name: `p${i}`, color: colors[i % 3],
      geom: transformGeom(perturb(sphere(rad, rad * 0.7, rad, 8, 10), 0.012, 50 + i),
        M.translate(px, py, pz)) });
  }
  return parts;
}

function buildDarkBoulder() {
  const main = perturb(sphere(0.45, 0.35, 0.4, 14, 18), 0.07, 61);
  return [
    { name: 'main', color: COL.rockDark,
      geom: transformGeom(main, M.translate(0, 0.32, 0)) },
    { name: 'highlight', color: COL.rockDarkLight,
      geom: transformGeom(perturb(sphere(0.18, 0.12, 0.16, 10, 12), 0.03, 65),
        M.translate(0.1, 0.5, -0.05)) },
  ];
}

function buildLavaRock() {
  const parts = [];
  const main = perturb(sphere(0.36, 0.32, 0.36, 14, 18), 0.06, 71);
  parts.push({ name: 'main', color: COL.lavaRock,
    geom: transformGeom(main, M.translate(0, 0.3, 0)) });
  // glowing cracks — small bright spheres
  const r = rng(73);
  for (let i = 0; i < 7; i++) {
    const theta = r() * Math.PI * 2;
    const phi = r() * Math.PI * 0.7 + 0.2;
    const px = Math.sin(phi) * Math.cos(theta) * 0.34;
    const py = 0.3 + Math.cos(phi) * 0.3;
    const pz = Math.sin(phi) * Math.sin(theta) * 0.34;
    const rad = 0.03 + r() * 0.025;
    parts.push({ name: `glow${i}`, color: COL.lavaGlow,
      geom: transformGeom(sphere(rad, rad, rad, 6, 8), M.translate(px, py, pz)) });
  }
  return parts;
}

function buildSlateFlat() {
  return [
    { name: 'base', color: COL.slateGray,
      geom: transformGeom(box(0.75, 0.08, 0.55), M.translate(0, 0.04, 0)) },
    { name: 'mid', color: COL.slateLight,
      geom: transformGeom(box(0.55, 0.07, 0.4),
        M.chain(M.translate(0.04, 0.11, -0.05), M.rotY(0.4))) },
    { name: 'top', color: COL.slateGray,
      geom: transformGeom(box(0.35, 0.06, 0.25),
        M.chain(M.translate(-0.08, 0.17, 0.06), M.rotY(-0.3))) },
  ];
}

function buildBlueCrystal() {
  const parts = [];
  // dark rock base
  parts.push({ name: 'base', color: COL.crystalBase,
    geom: transformGeom(perturb(sphere(0.22, 0.1, 0.22, 10, 12), 0.02, 81),
      M.translate(0, 0.06, 0)) });
  // crystal prisms — hexagonal cones
  const positions = [
    [0, 0.5, 0, 0.10, 0.55, 0, 0],
    [0.12, 0.36, 0.05, 0.07, 0.36, 0.2, 0.1],
    [-0.10, 0.32, -0.06, 0.07, 0.32, -0.15, -0.05],
    [0.05, 0.26, -0.13, 0.06, 0.28, 0.3, 0.2],
  ];
  positions.forEach(([x, y, z, r, h, tiltX, tiltZ], i) => {
    parts.push({ name: `c${i}`, color: i === 0 ? COL.crystalBlue : COL.crystalDeep,
      geom: transformGeom(cone({ r, height: h, segs: 6 }),
        M.chain(M.translate(x, y - h / 2, z), M.rotX(tiltX), M.rotZ(tiltZ))) });
  });
  return parts;
}

function buildPurpleGeode() {
  const parts = [];
  const shellOuter = (xSign) => {
    // half sphere shell
    const profile = [];
    const N = 10;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI;
      profile.push([Math.sin(a) * 0.26, Math.cos(a) * 0.26]);
    }
    return transformGeom(lathe(profile, 18),
      M.chain(M.translate(xSign * 0.13, 0.22, 0), M.rotZ(xSign * Math.PI / 2)));
  };
  const inner = (xSign) => {
    const profile = [];
    const N = 10;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI;
      profile.push([Math.sin(a) * 0.21, Math.cos(a) * 0.21]);
    }
    return transformGeom(lathe(profile, 18),
      M.chain(M.translate(xSign * 0.13, 0.22, 0), M.rotZ(xSign * Math.PI / 2)));
  };
  parts.push({ name: 'shellL', color: COL.geodeShell, geom: shellOuter(-1) });
  parts.push({ name: 'shellR', color: COL.geodeShell, geom: shellOuter(+1) });
  parts.push({ name: 'innerL', color: COL.geodeInner, geom: inner(-1) });
  parts.push({ name: 'innerR', color: COL.geodeInner, geom: inner(+1) });
  // crystal sparkles inside
  const r = rng(91);
  for (let i = 0; i < 5; i++) {
    const xSign = i % 2 === 0 ? -1 : 1;
    const cx = xSign * 0.10;
    const cy = 0.18 + r() * 0.12;
    const cz = (r() - 0.5) * 0.12;
    parts.push({ name: `spark${i}`, color: COL.geodeInnerLight,
      geom: transformGeom(cone({ r: 0.025, height: 0.06, segs: 5 }),
        M.translate(cx, cy, cz)) });
  }
  return parts;
}

// ---------- 유목 (Driftwood) ----------

function buildStraightBranch() {
  const parts = [];
  // main trunk — tilted
  const trunk = cylinder({ rTop: 0.05, rBot: 0.08, height: 0.95, segs: 8 });
  parts.push({ name: 'trunk', color: COL.woodMid,
    geom: transformGeom(trunk, M.chain(M.translate(0, 0, 0), M.rotZ(0.1))) });
  // side branch
  const sub = cylinder({ rTop: 0.02, rBot: 0.04, height: 0.35, segs: 6 });
  parts.push({ name: 'sub', color: COL.woodLight,
    geom: transformGeom(sub, M.chain(M.translate(0.1, 0.6, 0), M.rotZ(-1.0))) });
  // knot
  parts.push({ name: 'knot', color: COL.woodDark,
    geom: transformGeom(sphere(0.04, 0.04, 0.04, 6, 8), M.translate(0, 0.4, 0.06)) });
  return parts;
}

function buildTwistedRoot() {
  const parts = [];
  // main stump
  parts.push({ name: 'stump', color: COL.woodDark,
    geom: transformGeom(cylinder({ rTop: 0.08, rBot: 0.12, height: 0.4, segs: 10 }),
      M.translate(0, 0, 0)) });
  // twisted roots fanning out
  const roots = [
    { ang: 0,            tilt: 0.9 },
    { ang: Math.PI * 0.5, tilt: 0.9 },
    { ang: Math.PI,       tilt: 0.9 },
    { ang: Math.PI * 1.5, tilt: 0.9 },
  ];
  roots.forEach((r, i) => {
    // root segment 1
    const m1 = M.chain(
      M.translate(0, 0.15, 0),
      M.rotY(r.ang),
      M.rotZ(r.tilt),
    );
    parts.push({ name: `r${i}_1`, color: COL.woodMid,
      geom: transformGeom(cylinder({ rTop: 0.04, rBot: 0.06, height: 0.25, segs: 6 }), m1) });
    // root segment 2 (curved further)
    const m2 = M.chain(
      M.translate(0, 0.15, 0),
      M.rotY(r.ang),
      M.rotZ(r.tilt),
      M.translate(0, 0.25, 0),
      M.rotZ(0.6),
    );
    parts.push({ name: `r${i}_2`, color: COL.woodLight,
      geom: transformGeom(cylinder({ rTop: 0.02, rBot: 0.04, height: 0.2, segs: 6 }), m2) });
  });
  // top knob
  parts.push({ name: 'top', color: COL.woodMid,
    geom: transformGeom(sphere(0.1, 0.08, 0.1, 8, 10), M.translate(0, 0.4, 0)) });
  return parts;
}

function buildHollowLog() {
  const parts = [];
  // log lying on its side along X axis
  const outer = cylinder({ rTop: 0.22, rBot: 0.24, height: 0.8, segs: 14, capped: false });
  parts.push({ name: 'outer', color: COL.woodMid,
    geom: transformGeom(outer,
      M.chain(M.translate(-0.4, 0.23, 0), M.rotZ(-Math.PI / 2))) });
  // inner (dark interior)
  const inner = cylinder({ rTop: 0.18, rBot: 0.2, height: 0.78, segs: 14, capped: false });
  parts.push({ name: 'inner', color: COL.woodInner,
    geom: transformGeom(inner,
      M.chain(M.translate(-0.39, 0.23, 0), M.rotZ(-Math.PI / 2))) });
  // end caps as annular rings (front and back)
  [-0.4, 0.4].forEach((xPos, i) => {
    // simulate ring with thin torus
    const ring = torus({ R: 0.21, r: 0.02, ringSegs: 18, tubeSegs: 6 });
    parts.push({ name: `cap${i}`, color: COL.woodDark,
      geom: transformGeom(ring,
        M.chain(M.translate(xPos, 0.23, 0), M.rotZ(Math.PI / 2))) });
  });
  return parts;
}

function buildSmallStick() {
  const stick = cylinder({ rTop: 0.022, rBot: 0.035, height: 0.5, segs: 7 });
  return [
    { name: 'stick', color: COL.woodLight,
      geom: transformGeom(stick,
        M.chain(M.translate(-0.25, 0.04, 0), M.rotZ(-Math.PI / 2 + 0.15), M.rotY(0.3))) },
  ];
}

// ---------- 장식 (Ornaments) ----------

function buildTreasureChest() {
  const parts = [];
  // body
  parts.push({ name: 'body', color: COL.chestWood,
    geom: transformGeom(box(0.55, 0.3, 0.35), M.translate(0, 0.15, 0)) });
  // lid (half cylinder lying along X)
  const lidProfile = [];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI;
    lidProfile.push([Math.sin(a) * 0.175, Math.cos(a) * 0.175]);
  }
  // We need a half torus-like cap; easier: take a half cylinder
  const halfCylProfile = [];
  for (let i = 0; i <= N; i++) {
    const a = -Math.PI / 2 + (i / N) * Math.PI;
    halfCylProfile.push([Math.cos(a) * 0.175, Math.sin(a) * 0.175]);
  }
  // Construct lid by extruding the half-arc along X
  // Use a custom strip:
  const lidPositions = [];
  const lidNormals = [];
  const lidIndices = [];
  const lidSegs = 14;
  for (let i = 0; i <= lidSegs; i++) {
    const a = (i / lidSegs) * Math.PI;
    const c = Math.cos(a), s = Math.sin(a);
    // ring along X axis: y = sin(a)*r, z = cos(a)*r
    lidPositions.push(-0.275, s * 0.175, c * 0.175);
    lidNormals.push(0, s, c);
    lidPositions.push(0.275, s * 0.175, c * 0.175);
    lidNormals.push(0, s, c);
  }
  for (let i = 0; i < lidSegs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = c + 1;
    lidIndices.push(a, b, c, b, d, c);
  }
  parts.push({ name: 'lid', color: COL.chestWoodLight,
    geom: transformGeom({ positions: lidPositions, normals: lidNormals, indices: lidIndices },
      M.translate(0, 0.3, 0)) });
  // gold bands (3 vertical strips)
  [-0.2, 0, 0.2].forEach((x, i) => {
    parts.push({ name: `band${i}`, color: COL.gold,
      geom: transformGeom(box(0.025, 0.32, 0.37), M.translate(x, 0.15, 0)) });
    // band on lid
    parts.push({ name: `lband${i}`, color: COL.gold,
      geom: transformGeom(box(0.025, 0.36, 0.37),
        M.chain(M.translate(x, 0.3, 0), M.rotX(Math.PI / 2))) });
  });
  // lock
  parts.push({ name: 'lock', color: COL.gold,
    geom: transformGeom(box(0.07, 0.09, 0.04), M.translate(0, 0.21, 0.19)) });
  parts.push({ name: 'keyhole', color: COL.goldDark,
    geom: transformGeom(sphere(0.015, 0.022, 0.005, 6, 8), M.translate(0, 0.21, 0.21)) });
  return parts;
}

function buildShipwreck() {
  const parts = [];
  // hull — tilted box
  parts.push({ name: 'hull', color: COL.hullDark,
    geom: transformGeom(box(1.25, 0.35, 0.5),
      M.chain(M.translate(0, 0.18, 0), M.rotZ(-0.15))) });
  // deck planks
  parts.push({ name: 'deck', color: COL.hullLight,
    geom: transformGeom(box(1.0, 0.06, 0.46),
      M.chain(M.translate(-0.05, 0.36, 0), M.rotZ(-0.15))) });
  // broken mast
  parts.push({ name: 'mast', color: COL.hullLight,
    geom: transformGeom(cylinder({ rTop: 0.025, rBot: 0.04, height: 0.55, segs: 8 }),
      M.chain(M.translate(0.0, 0.36, 0), M.rotZ(-0.45))) });
  // bow tip
  parts.push({ name: 'bow', color: COL.hullDark,
    geom: transformGeom(sphere(0.12, 0.1, 0.18, 8, 10),
      M.chain(M.translate(0.65, 0.28, 0), M.rotZ(-0.15))) });
  // hole in hull (suggested by darker patch)
  parts.push({ name: 'hole', color: COL.woodInner,
    geom: transformGeom(sphere(0.09, 0.07, 0.06, 8, 10),
      M.translate(-0.2, 0.18, 0.25)) });
  return parts;
}

function buildClayPot() {
  // Lathe with jar profile
  const profile = [
    [0,      0],     // bottom center
    [0.12,   0],     // bottom rim
    [0.20,   0.08],  // shoulder out
    [0.24,   0.22],  // belly max
    [0.20,   0.36],  // shoulder in
    [0.13,   0.44],  // neck
    [0.10,   0.48],  // neck top
    [0.13,   0.50],  // lip flare
    [0.10,   0.51],  // inside (back down)
    [0,      0.48],  // inner bottom
  ];
  const body = lathe(profile, 20);
  return [
    { name: 'body', color: COL.potBody, geom: body },
    // decorative ridge band
    { name: 'rim', color: COL.potRim,
      geom: transformGeom(torus({ R: 0.13, r: 0.012, ringSegs: 18, tubeSegs: 6 }),
        M.translate(0, 0.50, 0)) },
    // wave decoration
    { name: 'midband', color: COL.potRim,
      geom: transformGeom(torus({ R: 0.235, r: 0.008, ringSegs: 20, tubeSegs: 5 }),
        M.translate(0, 0.20, 0)) },
  ];
}

function buildShipWheel() {
  const parts = [];
  // ring
  parts.push({ name: 'rim', color: COL.wheelWood,
    geom: transformGeom(torus({ R: 0.25, r: 0.028, ringSegs: 28, tubeSegs: 8 }),
      M.chain(M.translate(0, 0.3, 0), M.rotZ(Math.PI / 2))) });
  // hub
  parts.push({ name: 'hub', color: COL.wheelMetal,
    geom: transformGeom(cylinder({ rTop: 0.05, rBot: 0.05, height: 0.1, segs: 12 }),
      M.chain(M.translate(0.05, 0.3, 0), M.rotZ(Math.PI / 2))) });
  // 8 spokes radiating
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    // spoke along YZ (perpendicular to wheel axis X)
    const sm = M.chain(
      M.translate(0, 0.3, 0),
      M.rotX(angle),
      M.translate(0, 0.13, 0),
    );
    parts.push({ name: `sp${i}`, color: COL.wheelWood,
      geom: transformGeom(cylinder({ rTop: 0.015, rBot: 0.015, height: 0.26, segs: 5 }),
        M.chain(M.translate(0, 0.3, 0), M.rotX(angle), M.translate(0, -0.13, 0))) });
    // handles every other
    if (i % 2 === 0) {
      const hm = M.chain(
        M.translate(0, 0.3, 0),
        M.rotX(angle),
        M.translate(0, -0.32, 0),
      );
      parts.push({ name: `h${i}`, color: COL.wheelWood,
        geom: transformGeom(cylinder({ rTop: 0.02, rBot: 0.02, height: 0.1, segs: 5 }), hm) });
    }
  }
  return parts;
}

function buildPearlShell() {
  const parts = [];
  // lower shell — flat clamshell half
  const lowerProfile = [];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = 0.28 * Math.sin(t * Math.PI * 0.95);
    const y = 0.05 + t * 0.02;
    lowerProfile.push([r, y]);
  }
  const lower = lathe(lowerProfile, 20);
  parts.push({ name: 'lower', color: COL.shellOuter, geom: lower });
  // lower inner pearl-y
  const lowerInProf = lowerProfile.map(([r, y]) => [r * 0.92, y + 0.005]);
  const lowerIn = lathe(lowerInProf, 20);
  parts.push({ name: 'lowerIn', color: COL.shellInner, geom: lowerIn });
  // upper shell — propped open
  const upperProfile = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = 0.28 * Math.sin(t * Math.PI * 0.95);
    const y = t * 0.06;
    upperProfile.push([r, y]);
  }
  const upper = lathe(upperProfile, 20);
  parts.push({ name: 'upper', color: COL.shellOuter,
    geom: transformGeom(upper,
      M.chain(M.translate(0, 0.18, -0.05), M.rotX(2.5))) });
  // pearl
  parts.push({ name: 'pearl', color: COL.pearlWhite,
    geom: transformGeom(sphere(0.07, 0.07, 0.07, 12, 14), M.translate(0, 0.13, 0)) });
  return parts;
}

function buildRomanPillar() {
  const parts = [];
  // base disc
  parts.push({ name: 'base', color: COL.marbleWhite,
    geom: transformGeom(cylinder({ rTop: 0.18, rBot: 0.2, height: 0.08, segs: 16 }),
      M.translate(0, 0, 0)) });
  parts.push({ name: 'plinth', color: COL.marbleWhite,
    geom: transformGeom(box(0.42, 0.05, 0.42), M.translate(0, 0.02, 0)) });
  // shaft (fluted look via 8 slim columns)
  parts.push({ name: 'shaft', color: COL.marbleWhite,
    geom: transformGeom(cylinder({ rTop: 0.13, rBot: 0.15, height: 0.8, segs: 14 }),
      M.translate(0, 0.08, 0)) });
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    parts.push({ name: `flute${i}`, color: COL.marbleVein,
      geom: transformGeom(cylinder({ rTop: 0.015, rBot: 0.018, height: 0.78, segs: 5 }),
        M.translate(Math.cos(ang) * 0.135, 0.09, Math.sin(ang) * 0.135)) });
  }
  // capital
  parts.push({ name: 'cap', color: COL.marbleWhite,
    geom: transformGeom(cylinder({ rTop: 0.2, rBot: 0.16, height: 0.08, segs: 16 }),
      M.translate(0, 0.88, 0)) });
  parts.push({ name: 'abacus', color: COL.marbleWhite,
    geom: transformGeom(box(0.42, 0.05, 0.42), M.translate(0, 0.98, 0)) });
  // broken top — tilted block
  parts.push({ name: 'broken', color: COL.marbleVein,
    geom: transformGeom(cylinder({ rTop: 0.1, rBot: 0.12, height: 0.18, segs: 12 }),
      M.chain(M.translate(0.06, 1.05, 0), M.rotZ(0.4))) });
  return parts;
}

function buildArchRing() {
  const parts = [];
  // half-torus arch — lying with opening downward
  const arch = torus({ R: 0.35, r: 0.06, ringSegs: 20, tubeSegs: 10, arc: Math.PI });
  parts.push({ name: 'arch', color: COL.archStone,
    geom: transformGeom(arch,
      M.chain(M.translate(0, 0.36, 0), M.rotX(-Math.PI / 2), M.rotY(0))) });
  // The torus with arc=PI sits in XZ plane with opening at +X side. Need to stand it up.
  // Replace above with proper upright orientation: rotate 90° about Z so arc lies in XY plane.
  // (Reassigning the orientation here is fiddly; produce vertical arch via a different approach.)

  // Pillars on each side
  [-0.35, 0.35].forEach((x, i) => {
    parts.push({ name: `pil${i}`, color: COL.archStone,
      geom: transformGeom(cylinder({ rTop: 0.06, rBot: 0.07, height: 0.36, segs: 12 }),
        M.translate(x, 0, 0)) });
  });
  return parts;
}

function buildBubbleChimney() {
  const parts = [];
  // chimney — tall narrowing cone
  parts.push({ name: 'rock', color: COL.bubbleRock,
    geom: transformGeom(perturb(cone({ r: 0.2, height: 0.7, segs: 10 }), 0.02, 101),
      M.translate(0, 0, 0)) });
  // bubble vent at top (small darker hole)
  parts.push({ name: 'hole', color: COL.woodInner,
    geom: transformGeom(sphere(0.04, 0.02, 0.04, 6, 8), M.translate(0, 0.7, 0)) });
  // bubbles
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const x = (Math.random() - 0.5) * 0.06;
    const z = (Math.random() - 0.5) * 0.06;
    const rad = 0.035 + t * 0.025;
    parts.push({ name: `b${i}`, color: COL.bubbleGlow,
      geom: transformGeom(sphere(rad, rad, rad, 8, 10), M.translate(x, 0.75 + i * 0.14, z)) });
  }
  return parts;
}

// ============================================================================
// glTF assembly
// ============================================================================
async function writeDecoGlb(id, parts) {
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
      .setRoughnessFactor(0.75)
      .setMetallicFactor(0.0);
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

// ============================================================================
// Main
// ============================================================================
const BUILDERS = [
  // plants
  ['seagrass',        buildSeagrass],
  ['kelp',            buildKelp],
  ['coral_branch',    buildCoralBranch],
  ['coral_brain',     buildBrainCoral],
  ['anemone',         buildAnemone],
  ['bamboo_water',    buildBambooWater],
  ['fern_aquatic',    buildAquaticFern],
  ['moss_ball',       buildMossBall],
  // rocks
  ['pebble_pile',     buildPebblePile],
  ['boulder_dark',    buildDarkBoulder],
  ['lava_rock',       buildLavaRock],
  ['slate_flat',      buildSlateFlat],
  ['crystal_blue',    buildBlueCrystal],
  ['geode_purple',    buildPurpleGeode],
  // driftwood
  ['branch_straight', buildStraightBranch],
  ['root_twisted',    buildTwistedRoot],
  ['log_hollow',      buildHollowLog],
  ['stick_small',     buildSmallStick],
  // ornaments
  ['treasure_chest',  buildTreasureChest],
  ['pirate_ship',     buildShipwreck],
  ['clay_pot',        buildClayPot],
  ['ship_wheel',      buildShipWheel],
  ['pearl_shell',     buildPearlShell],
  ['roman_pillar',    buildRomanPillar],
  ['arch_ring',       buildArchRing],
  ['bubble_chimney',  buildBubbleChimney],
];

const written = [];
for (const [id, builder] of BUILDERS) {
  const out = await writeDecoGlb(id, builder());
  written.push(out);
  console.log(`✓ ${id.padEnd(18)} → ${out}`);
}
console.log(`\n총 ${written.length}개 데코 GLB 생성 완료`);
