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
const EYE_IRIS   = hex('#1c1622'); // warm near-black charcoal (not pure black → friendly, not beady)
const CATCHLIGHT = hex('#ffffff'); // pure white glossy dot — the #1 kawaii signal
const MOUTH      = hex('#a24a4a'); // soft warm maroon — reads as lips, never a black void
const BLUSH      = hex('#ff8a8a'); // rosy cheek accent

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
  // End caps — close the (possibly blunt/open) nose and tail rings with a fan to a
  // center point nudged slightly along the axis, so you can't see into the hollow body.
  // Blunt noses (cuteBody/eelProfile) leave an open ring here; without this it looks pierced.
  const capEnd = (i, dir) => {
    const t = i / segments;
    const x = length * (0.5 - t);
    const hy = Math.max(sideProfile(t), 0.001);
    const hz = Math.max(topProfile(t),  0.001);
    const c = positions.length / 3;
    positions.push(x + dir * Math.min(hy, hz) * 0.5, 0, 0); // gentle rounded blunt face
    normals.push(dir, 0, 0);
    const base = i * stride;
    for (let j = 0; j < rings; j++) {
      const p0 = base + j, p1 = base + j + 1;
      indices.push(c, p0, p1, c, p1, p0); // both windings → always solid from outside
    }
  };
  capEnd(0, +1);        // nose
  capEnd(segments, -1); // tail
  return { positions, normals, indices };
}

// Common profile shape — torpedo: rounded nose → max width 30%–60% → tapered peduncle.
function torpedoSide(maxR, peak = 0.4, pedunclePct = 0.18) {
  return (t) => {
    if (t < peak) return Math.sin((t / peak) * (Math.PI / 2)) * maxR;
    return maxR * (1 - (1 - pedunclePct) * Math.pow((t - peak) / (1 - peak), 1.2));
  };
}

// Cute chibi body: BLUNT rounded nose (never a point), FULL belly, FAT peduncle,
// optional head-swell in the front third. The de-scary workhorse for "safe" species.
//   maxR      — max half-extent (height or width)
//   peak      — t of widest point (push forward → bigger head); 0.30–0.36
//   noseR     — half-extent AT nose as fraction of maxR (0.40–0.46 = blunt muzzle)
//   peduncle  — tail-base half-extent as fraction of maxR (fatter = friendlier)
//   belly     — mid-body fullness exponent (<1 bulges outward)
//   headBoost — localized front-third girth bump (0.10–0.16 small fish, 0 round fish)
function cuteBody(maxR, { peak = 0.34, noseR = 0.42, peduncle = 0.34, belly = 0.72, headBoost = 0 } = {}) {
  return (t) => {
    let r;
    if (t < peak) {
      const u = t / peak;
      const ease = 0.5 - 0.5 * Math.cos(u * Math.PI);            // smooth shoulder, flat at both ends
      r = maxR * (noseR + (1 - noseR) * Math.pow(ease, belly));  // starts blunt at noseR·maxR
      if (headBoost) r *= 1 + headBoost * Math.exp(-Math.pow((t - peak * 0.5) / (peak * 0.5), 2) * 2.5);
    } else {
      const u = (t - peak) / (1 - peak);
      r = maxR * (1 - (1 - peduncle) * Math.pow(u, 1.4));        // gentle taper to a fat peduncle
    }
    return r;
  };
}

// Tall, thin profile for angelfish-style bodies. noseR floors the nose/tail so it's not a razor.
function discProfile(maxR, peak = 0.45, noseR = 0.22) {
  return (t) => {
    const s = Math.sin(t * Math.PI);
    const base = (t < peak) ? Math.pow(s, 0.72) * maxR                    // 0.55→0.72 = rounder front
                            : Math.pow(s, 0.85) * maxR * (1 - (t - peak) * 0.3);
    return Math.max(base, maxR * noseR * Math.sin(Math.min(t, 1 - t) * Math.PI)); // blunt nose/tail floor
  };
}

// Spherical-ish profile for round fish (goldfish). floor keeps the tail base from pinching to a point.
function roundProfile(maxR, floor = 0.16) {
  return (t) => Math.max(Math.sin(t * Math.PI) * maxR, (t > 0.5 ? maxR * floor : 0));
}

// Elongated, eel-like profile. De-snaked: blunt nose (noseR) + fat peduncle (tailFrac).
function eelProfile(maxR, peak = 0.3, tailFrac = 0.30, noseR = 0.38) {
  return (t) => {
    if (t < peak) {
      const u = t / peak;
      return maxR * (noseR + (1 - noseR) * (0.5 - 0.5 * Math.cos(u * Math.PI)));
    }
    const u = (t - peak) / (1 - peak);
    return maxR * (1 - (1 - tailFrac) * u);   // keeps ~tailFrac girth at tail (was ~8%)
  };
}

// ---------------------------------------------------------------------------
// Caudal (tail) fin — forked shape, lies in the X/Y plane at the peduncle.
// Base at +X (attaches to body), forks at -X. Double-sided.
// ---------------------------------------------------------------------------
function caudalFin({ spread, height, fork = 0.20, baseWidth = 0.14, round = 0.85 }) {
  const tip = spread * round;
  const outline = [
    [0,                      baseWidth],
    [-spread * 0.30,         height * 0.60],
    [-tip,                   height * 0.92],   // rounded upper lobe (was sharp [-spread, height])
    [-spread * 0.92,         height * 0.55],   // extra vertex softens the corner
    [-spread * (1 - fork),   0],               // shallower notch
    [-spread * 0.92,        -height * 0.55],
    [-tip,                  -height * 0.92],
    [-spread * 0.30,        -height * 0.60],
    [0,                     -baseWidth],
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
    // Top edge: symmetric rounded dome (zero-slope tips, no sharp trailing point).
    const u = (t - 0.5) * 2;                                   // -1..1 across the fin
    const y = height * Math.pow(Math.max(0, 1 - u * u), 0.65); // rounded dome
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
    const r = 0.15 + 0.85 * Math.cos(angle * 0.72); // never reaches 0 → rounded paddle tip
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
  // Shallow dome (rz 0.50, was 0.85) so the eye sits flush with the head instead of
  // bulging like a googly ball — but the LARGE dark iris still faces forward and reads
  // as a big friendly pupil, with a glossy catchlight on top.
  return [
    // 1) Eyeball white — gentle dome; mostly covered by the iris, shows as a thin rim.
    { name: 'eyewhite', color: WHITE, roughness: 0.30,
      geom: transformGeom(sphere(size * 1.00, size * 1.00, size * 0.50, 10, 14),
        M.translate(x, y, z)) },
    // 2) Iris/pupil — BIG (0.84 wide) and forward so the dark dominates the front face.
    { name: 'pupil', color: EYE_IRIS, roughness: 0.20,
      geom: transformGeom(sphere(size * 0.84, size * 0.84, size * 0.40, 10, 14),
        M.translate(x + size * 0.06, y - size * 0.05, z + side * size * 0.12)) },
    // 3) Catchlight — small glossy dot on the upper-outer of the iris, toward the key light.
    { name: 'catchlight', color: CATCHLIGHT, roughness: 0.15, emissive: [0.85, 0.85, 0.85],
      geom: transformGeom(sphere(size * 0.20, size * 0.20, size * 0.20, 8, 10),
        M.translate(x + size * 0.26, y + size * 0.24, z + side * size * 0.32)) },
  ];
}

// Tiny upturned smile: three small squashed spheres in a shallow upward "u".
// Corners sit HIGHER than the center = smile. Returns an ARRAY of parts.
function mouthPart(noseX, color = MOUTH, scale = 1) {
  const x = noseX - 0.015;
  const beads = [
    // [dx,     dy,      dz,     rx,    ry,    rz  ]
    [ 0.000,  -0.028,   0.000,  0.022, 0.012, 0.026], // center (lowest)
    [-0.004,  -0.020,   0.030,  0.016, 0.010, 0.016], // right corner (lifted)
    [-0.004,  -0.020,  -0.030,  0.016, 0.010, 0.016], // left corner (lifted)
  ];
  return beads.map(([dx, dy, dz, rx, ry, rz], i) => ({
    name: `mouth${i}`, color, roughness: 0.6,
    geom: transformGeom(sphere(rx * scale, ry * scale, rz * scale, 6, 10),
      M.translate(x + dx * scale, dy * scale, dz * scale)),
  }));
}

// Rosy cheek blush — a pair of flattened decal spheres on the cheeks.
function blushParts(x, y, zSide, size = 0.05) {
  return [+1, -1].map((side) => ({
    name: `blush_${side}`, color: BLUSH, roughness: 0.72,
    geom: transformGeom(sphere(size, size * 0.7, size * 0.18, 6, 10),
      M.translate(x, y, side * zSide)),
  }));
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
  parts.push({ name: 'body', color: bodyColor, emissive: preset.emissive,
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

  // cheek blush (opt-in per species)
  if (preset.blush) {
    const bl = preset.blush;
    blushParts(bl.x, bl.y, bl.z ?? (preset.eye?.z ?? preset.maxWidth * 0.9), bl.size)
      .forEach(p => parts.push(p));
  }

  // mouth — friendly smile (array of beads)
  if (preset.mouth !== false) {
    mouthPart(len * 0.5, hex(preset.mouthColor ?? '#a24a4a'), preset.mouthScale ?? 1)
      .forEach(p => parts.push(p));
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Per-species presets
// ---------------------------------------------------------------------------

const PRESETS = {
  clownfish: {
    length: 1.05, maxHeight: 0.40, maxWidth: 0.27,
    bodyColor: '#ff9a52', finColor: '#3a2a24',
    emissive: [0.10, 0.055, 0.028],
    sideProfile: cuteBody(0.40, { peak: 0.34, noseR: 0.45, peduncle: 0.36, belly: 0.70, headBoost: 0.12 }),
    topProfile:  cuteBody(0.27, { peak: 0.34, noseR: 0.45, peduncle: 0.36, belly: 0.70, headBoost: 0.12 }),
    bellyColor: '#ffd9b0',
    belly: { length: 0.42, height: 0.12, width: 0.22, x: 0.02, y: -0.20 },
    stripes: [
      { x: 0.34,  thickness: 0.06, color: '#fff6ec' },
      { x: 0.05,  thickness: 0.08, color: '#fff6ec' },
      { x: -0.30, thickness: 0.06, color: '#fff6ec' },
    ],
    dorsal:   { length: 0.7, height: 0.20, peakPos: 0.45, x: -0.05, attach: 0.30 },
    anal:     { length: 0.30, height: 0.12, x: -0.15, attach: -0.28 },
    tail:     { spread: 0.30, height: 0.32, fork: 0.15, baseWidth: 0.10 },
    pectoral: { x: 0.18, y: -0.05, width: 0.14, length: 0.22 },
    mouthColor: '#c85a44', mouthScale: 1.15,
    eye:      { x: 0.44, y: 0.02, size: 0.085, z: 0.20 },
    blush:    { x: 0.30, y: -0.06, z: 0.21, size: 0.055 },
  },

  guppy: {
    length: 0.80, maxHeight: 0.22, maxWidth: 0.16,
    bodyColor: '#a6ddef', finColor: '#c98cf0',
    emissive: [0.055, 0.086, 0.098],
    sideProfile: cuteBody(0.22, { peak: 0.30, noseR: 0.40, peduncle: 0.30, belly: 0.72, headBoost: 0.15 }),
    topProfile:  cuteBody(0.16, { peak: 0.32, noseR: 0.40, peduncle: 0.30, belly: 0.72, headBoost: 0.15 }),
    bellyColor: '#eaf7fd',
    belly: { length: 0.34, height: 0.07, width: 0.12, x: 0.0, y: -0.10 },
    spots: [
      { x: -0.10, y: 0.02, size: 0.06, color: '#ffdf8f' },
      { x: -0.22, y: -0.02, size: 0.05, color: '#ff9dbd' },
    ],
    dorsal:   { length: 0.30, height: 0.15, x: -0.10, attach: 0.17 },
    anal:     { length: 0.20, height: 0.10, x: -0.15, attach: -0.15 },
    tail:     { spread: 0.55, height: 0.45, fork: 0.05, baseWidth: 0.05 }, // big veil
    pectoral: { x: 0.15, y: -0.02, width: 0.09, length: 0.16 },
    mouthColor: '#8f7ec0', mouthScale: 0.75,
    eye:      { x: 0.38, y: 0.00, size: 0.065 },
    blush:    { x: 0.28, y: -0.05, z: 0.115, size: 0.040 },
  },

  goldfish: {
    length: 1.0, maxHeight: 0.48, maxWidth: 0.36,
    bodyColor: '#ffc64d', finColor: '#ffab47',
    emissive: [0.11, 0.078, 0.03],
    sideProfile: roundProfile(0.48, 0.16),
    topProfile:  roundProfile(0.36, 0.16),
    bellyColor: '#fffbe6',
    belly: { length: 0.34, height: 0.12, width: 0.32, x: 0.0, y: -0.28 },
    dorsal:   { length: 0.42, height: 0.28, peakPos: 0.50, x: 0.0, attach: 0.42 },
    anal:     { length: 0.22, height: 0.16, x: -0.20, attach: -0.40 },
    tailDouble: { spread: 0.40, height: 0.32 },
    pectoral: { x: 0.20, y: -0.05, width: 0.18, length: 0.22 },
    mouthColor: '#e07a3a', mouthScale: 1.15,
    eye:      { x: 0.36, y: 0.04, size: 0.10, z: 0.34 },
    blush:    { x: 0.26, y: -0.05, z: 0.34, size: 0.065 },
  },

  seahorse: {
    // Built separately — vertical S-curve. Skip generic builder for body.
    custom: true,
  },

  zebrafish: {
    length: 0.78, maxHeight: 0.18, maxWidth: 0.14,
    bodyColor: '#f7f1d8', finColor: '#c9c2d6',
    emissive: [0.09, 0.086, 0.07],
    sideProfile: cuteBody(0.18, { peak: 0.32, noseR: 0.42, peduncle: 0.32, belly: 0.72, headBoost: 0.12 }),
    topProfile:  cuteBody(0.14, { peak: 0.34, noseR: 0.42, peduncle: 0.32, belly: 0.72, headBoost: 0.12 }),
    stripes: [
      { x: 0.35,  thickness: 0.04, color: '#5a86c9', heightR: 0.19, widthR: 0.15 },
      { x: 0.20,  thickness: 0.04, color: '#5a86c9', heightR: 0.19, widthR: 0.15 },
      { x: 0.05,  thickness: 0.04, color: '#5a86c9', heightR: 0.19, widthR: 0.15 },
      { x: -0.10, thickness: 0.04, color: '#5a86c9', heightR: 0.19, widthR: 0.15 },
      { x: -0.25, thickness: 0.04, color: '#5a86c9', heightR: 0.15, widthR: 0.12 },
    ],
    dorsal:   { length: 0.25, height: 0.10, x: -0.15, attach: 0.13 },
    anal:     { length: 0.18, height: 0.07, x: -0.18, attach: -0.12 },
    tail:     { spread: 0.28, height: 0.18, fork: 0.30, baseWidth: 0.04 },
    pectoral: { x: 0.20, y: -0.04, width: 0.08, length: 0.14 },
    mouthColor: '#8a7fb0', mouthScale: 0.75,
    eye:      { x: 0.38, y: 0.00, size: 0.060 },
  },

  betta: {
    length: 0.80, maxHeight: 0.27, maxWidth: 0.21,
    bodyColor: '#e2564f', finColor: '#b23a63',
    emissive: [0.13, 0.048, 0.043],
    sideProfile: cuteBody(0.27, { peak: 0.30, noseR: 0.44, peduncle: 0.34, belly: 0.70, headBoost: 0.12 }),
    topProfile:  cuteBody(0.21, { peak: 0.32, noseR: 0.44, peduncle: 0.34, belly: 0.70, headBoost: 0.12 }),
    bellyColor: '#ffb3a8',
    belly: { length: 0.34, height: 0.09, width: 0.16, x: 0.02, y: -0.11 },
    dorsal:   { length: 0.60, height: 0.24, peakPos: 0.70, x: -0.10, attach: 0.20 },
    anal:     { length: 0.55, height: 0.22, peakPos: 0.50, x: -0.10, attach: -0.20 },
    tail:     { spread: 0.65, height: 0.42, fork: 0.10, baseWidth: 0.08 },
    pectoral: { x: 0.18, y: -0.03, width: 0.18, length: 0.32, droop: 0.10, flare: Math.PI / 2.5 },
    mouthColor: '#c4485a',
    eye:      { x: 0.38, y: 0.02, size: 0.072 },
    blush:    { x: 0.28, y: -0.05, z: 0.17, size: 0.045 },
  },

  angelfish: {
    length: 0.85, maxHeight: 0.58, maxWidth: 0.13,
    bodyColor: '#eef0f7', finColor: '#4a4a5a',
    emissive: [0.10, 0.10, 0.11],
    sideProfile: discProfile(0.58, 0.45, 0.22),
    topProfile:  discProfile(0.13, 0.45, 0.22),
    stripes: [
      { x: 0.22,  thickness: 0.025, color: '#5a5a6e', heightR: 0.58, widthR: 0.135 },
      { x: 0.02,  thickness: 0.030, color: '#5a5a6e', heightR: 0.58, widthR: 0.135 },
      { x: -0.20, thickness: 0.025, color: '#5a5a6e', heightR: 0.50, widthR: 0.13 },
    ],
    dorsal:   { length: 0.55, height: 0.52, peakPos: 0.55, x: -0.05, attach: 0.55 },
    anal:     { length: 0.55, height: 0.44, peakPos: 0.55, x: -0.10, attach: -0.55 },
    tail:     { spread: 0.55, height: 0.50, fork: 0.10, baseWidth: 0.10 },
    pectoral: { x: 0.10, y: -0.10, width: 0.08, length: 0.28, droop: 0.18 },
    mouthColor: '#9a8fb0',
    eye:      { x: 0.33, y: 0.13, size: 0.105, z: 0.12 },
    blush:    { x: 0.24, y: 0.02, z: 0.115, size: 0.05 },
  },

  mandarin: {
    length: 0.78, maxHeight: 0.25, maxWidth: 0.19,
    bodyColor: '#3f8fd6', finColor: '#ff9a47',
    emissive: [0.03, 0.10, 0.15],
    sideProfile: cuteBody(0.25, { peak: 0.32, noseR: 0.44, peduncle: 0.34, belly: 0.70, headBoost: 0.10 }),
    topProfile:  cuteBody(0.19, { peak: 0.34, noseR: 0.44, peduncle: 0.34, belly: 0.70, headBoost: 0.10 }),
    bellyColor: '#bfe0f5',
    belly: { length: 0.36, height: 0.09, width: 0.15, x: 0.0, y: -0.11 },
    spots: [
      { x: 0.20, y: 0.08, size: 0.07, color: '#ff9a47' },
      { x: 0.05, y: -0.04, size: 0.06, color: '#5cd493' },
      { x: -0.10, y: 0.06, size: 0.07, color: '#ffdf8f' },
      { x: -0.22, y: -0.03, size: 0.05, color: '#ff9a47' },
    ],
    dorsal:   { length: 0.55, height: 0.20, peakPos: 0.55, x: -0.05, attach: 0.22 },
    anal:     { length: 0.30, height: 0.13, x: -0.18, attach: -0.20 },
    tail:     { spread: 0.32, height: 0.25, fork: 0.05, baseWidth: 0.07 },
    pectoral: { x: 0.18, y: -0.04, width: 0.13, length: 0.20 },
    mouthColor: '#e07a3a',
    eye:      { x: 0.36, y: 0.02, size: 0.072 },
    blush:    { x: 0.26, y: -0.05, z: 0.15, size: 0.045 },
  },

  sea_dragon: {
    length: 1.05, maxHeight: 0.20, maxWidth: 0.16,
    bodyColor: '#a7d98a', finColor: '#79b06a',
    emissive: [0.078, 0.11, 0.062],
    sideProfile: eelProfile(0.20, 0.28, 0.32, 0.38),
    topProfile:  eelProfile(0.16, 0.28, 0.32, 0.38),
    // leafy appendages added below via custom branch
    eye:      { x: 0.55, y: 0.02, size: 0.055, z: 0.11 },
    mouth:    false,
  },

  coelacanth: {
    length: 1.15, maxHeight: 0.44, maxWidth: 0.37,
    bodyColor: '#7b86bf', finColor: '#5a659e',
    emissive: [0.055, 0.062, 0.11],
    sideProfile: cuteBody(0.44, { peak: 0.36, noseR: 0.42, peduncle: 0.40, belly: 0.68, headBoost: 0.10 }),
    topProfile:  cuteBody(0.37, { peak: 0.36, noseR: 0.42, peduncle: 0.40, belly: 0.68, headBoost: 0.10 }),
    bellyColor: '#cfd6f2',
    belly: { length: 0.55, height: 0.16, width: 0.30, x: 0.05, y: -0.24 },
    spots: [
      { x: 0.25, y: 0.05, size: 0.08, color: '#e8ecff' },
      { x: 0.05, y: -0.10, size: 0.07, color: '#e8ecff' },
      { x: -0.20, y: 0.08, size: 0.07, color: '#e8ecff' },
      { x: -0.40, y: -0.05, size: 0.06, color: '#e8ecff' },
    ],
    dorsal:   { length: 0.30, height: 0.20, peakPos: 0.40, x: 0.10, attach: 0.36 },
    dorsal2:  { length: 0.22, height: 0.18, peakPos: 0.50, x: -0.30, attach: 0.32 },
    anal:     { length: 0.25, height: 0.16, x: -0.30, attach: -0.32 },
    tail:     { spread: 0.45, height: 0.40, fork: 0.25, baseWidth: 0.12 },
    pectoral: { x: 0.25, y: -0.12, width: 0.18, length: 0.30, flare: Math.PI / 2.2 },
    pelvic:   { x: -0.05, y: -0.30, width: 0.12, length: 0.22 },
    mouthColor: '#8f7ec0',
    eye:      { x: 0.52, y: 0.04, size: 0.095, z: 0.27 },
  },
};

// ---------------------------------------------------------------------------
// Custom builders for fish that don't fit the generic profile (seahorse, sea_dragon)
// ---------------------------------------------------------------------------

function buildSeahorse() {
  const BODY = hex('#ffc159');
  const ACCENT = hex('#f0a63f');
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
    geom: transformGeom(sphere(0.24, 0.23, 0.20, 12, 16),
      M.translate(head.x + 0.05, head.y + 0.05, 0)) });
  // Snout — stubby muzzle (was a long spear)
  parts.push({ name: 'snout', color: BODY,
    geom: transformGeom(sphere(0.11, 0.06, 0.06, 8, 12),
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
    eyeParts([head.x + 0.14, head.y + 0.02, side * 0.12], 0.06, side)
      .forEach(p => parts.push(p));
  });
  return parts;
}

function buildSeaDragon() {
  const preset = PRESETS.sea_dragon;
  const parts = buildGenericFish(preset);
  // Add leafy appendages — flat triangular fronds sticking out
  const LEAF = hex('#7fbf7a');
  const LEAF_LIGHT = hex('#c3e6a6');
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
  // Short stubby snout (was a long spear)
  parts.push({ name: 'snout', color: hex(preset.bodyColor),
    geom: transformGeom(sphere(0.07, 0.05, 0.05, 8, 12),
      M.translate(preset.length * 0.5 + 0.05, 0, 0)) });
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
      .setRoughnessFactor(part.roughness ?? 0.72)   // was 0.55 → softer plush/vinyl finish
      .setMetallicFactor(part.metallic ?? 0.0);
    if (part.emissive) {
      mat.setEmissiveFactor(part.emissive);          // explicit glow (catchlight, deep-sea lift)
    } else {
      mat.setEmissiveFactor(part.color.map((c) => c * 0.06)); // 6% self-fill vs. dark ambient/fog
    }
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
];

const written = [];
for (const [id, builder] of BUILDERS) {
  const out = await writeFishGlb(id, builder());
  written.push(out);
  console.log(`✓ ${id.padEnd(12)} → ${out}`);
}
console.log(`\nGenerated ${written.length} fish GLBs in ${OUT_DIR}`);
