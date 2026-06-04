// AquaWorld native (Android/iOS) source-asset generator.
// 출력: resources/icon.png (1024x1024), resources/splash.png (2732x2732)
// 이후 `npx capacitor-assets generate --android` 가 안드로이드 mipmap/스플래시 전 사이즈를 자동 생성한다.
//
// Run:  node scripts/generate-native-assets.mjs

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'resources');
mkdirSync(OUT_DIR, { recursive: true });

// 동일한 fish + ocean gradient 디자인 (generate-icons.mjs 와 톤 일치).
// safeZone: 0~1, 캔버스 대비 fish 가 차지하는 비율. 작을수록 여백 큼.
const buildSvg = ({ size, safeZone = 1.0, withBg = true }) => {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const inner = s * safeZone;
  const fishScale = inner / 512;

  const defs = `
    <defs>
      <radialGradient id="bg" cx="50%" cy="35%" r="75%">
        <stop offset="0%" stop-color="#1e4a7a"/>
        <stop offset="55%" stop-color="#0e2a4a"/>
        <stop offset="100%" stop-color="#0a1628"/>
      </radialGradient>
      <linearGradient id="fish" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffd76a"/>
        <stop offset="60%" stop-color="#ff9b3d"/>
        <stop offset="100%" stop-color="#e85a2a"/>
      </linearGradient>
      <linearGradient id="finStripe" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.05"/>
      </linearGradient>
    </defs>`;

  const bg = withBg ? `<rect width="${s}" height="${s}" fill="url(#bg)"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  ${defs}
  ${bg}
  <g transform="translate(${cx} ${cy}) scale(${fishScale}) translate(-256 -256)">
    <g opacity="0.85">
      <circle cx="120" cy="120" r="14" fill="#ffffff" opacity="0.5"/>
      <circle cx="380" cy="170" r="9"  fill="#ffffff" opacity="0.4"/>
      <circle cx="160" cy="380" r="11" fill="#ffffff" opacity="0.35"/>
      <circle cx="400" cy="380" r="7"  fill="#ffffff" opacity="0.4"/>
      <circle cx="90"  cy="260" r="6"  fill="#ffffff" opacity="0.35"/>
    </g>
    <g transform="translate(256 256)">
      <path d="M -150 -10 L -210 -90 L -210 90 L -150 10 Z"
            fill="url(#fish)" opacity="0.95"/>
      <path d="M -150 -10 L -210 -90 L -210 90 L -150 10 Z"
            fill="url(#finStripe)"/>
      <ellipse cx="0" cy="0" rx="170" ry="95" fill="url(#fish)"/>
      <path d="M -30 -85 Q 10 -135 80 -90 L 30 -45 Z"
            fill="url(#fish)" opacity="0.9"/>
      <path d="M -30 -85 Q 10 -135 80 -90 L 30 -45 Z"
            fill="url(#finStripe)"/>
      <path d="M -20 80 Q 30 130 90 90 L 40 50 Z"
            fill="url(#fish)" opacity="0.9"/>
      <circle cx="110" cy="-20" r="22" fill="#ffffff"/>
      <circle cx="116" cy="-20" r="13" fill="#0a1628"/>
      <circle cx="120" cy="-24" r="5"  fill="#ffffff"/>
      <path d="M 145 -8 Q 168 0 145 8" stroke="#0a1628" stroke-width="4"
            fill="none" stroke-linecap="round" opacity="0.75"/>
    </g>
  </g>
</svg>`;
};

const render = async (filename, { size, safeZone, withBg }) => {
  const svg = Buffer.from(buildSvg({ size, safeZone, withBg }));
  const out = resolve(OUT_DIR, filename);
  await sharp(svg).png({ compressionLevel: 9 }).toFile(out);
  console.log(`  wrote ${filename} (${size}x${size})`);
};

console.log('Generating native source assets...');

// 1) icon.png — Android 런처 아이콘 원본. safeZone 0.92 = 사방 4% 여백.
await render('icon.png', { size: 1024, safeZone: 0.92, withBg: true });

// 2) icon-foreground.png — adaptive icon 의 전경 (배경 투명, 더 큰 여백으로 마스킹 안전).
await render('icon-foreground.png', { size: 1024, safeZone: 0.62, withBg: false });

// 3) splash.png — 스플래시. 캔버스 대비 fish 약 1/3, 나머지는 ocean gradient.
await render('splash.png', { size: 2732, safeZone: 0.35, withBg: true });

console.log('Done.');
