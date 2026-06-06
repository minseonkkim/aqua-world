// AquaWorld Android 알림(상태바) 아이콘 생성기.
// 산출물: android/app/src/main/res/drawable-{density}/ic_stat_notify.png
//
// Android 알림 small icon 규격:
//  - 흰색 단색 실루엣 + 투명 배경 (시스템이 알파 채널만 사용해 테마색으로 틴트한다)
//  - 24dp 기준, 밀도별 px: mdpi 24 / hdpi 36 / xhdpi 48 / xxhdpi 72 / xxxhdpi 96
//  - 그래픽은 약 22dp 안에 배치(사방 1dp 여백)해 잘림 방지
//
// AndroidManifest 에 아래 메타데이터로 연결:
//  com.google.firebase.messaging.default_notification_icon -> @drawable/ic_stat_notify
//
// Run:  node scripts/generate-notification-icon.mjs

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RES_DIR = resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// 밀도별 출력 픽셀 (24dp 기준)
const DENSITIES = [
  { dir: 'drawable-mdpi', size: 24 },
  { dir: 'drawable-hdpi', size: 36 },
  { dir: 'drawable-xhdpi', size: 48 },
  { dir: 'drawable-xxhdpi', size: 72 },
  { dir: 'drawable-xxxhdpi', size: 96 },
];

// 24x24 viewBox 기준 물고기 실루엣. 그래픽은 약 2~22 영역에 배치.
// mask 로 눈(eye)을 투명하게 뚫어 형태 인식성을 높인다.
function buildSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  <defs>
    <mask id="fishMask">
      <rect width="24" height="24" fill="black"/>
      <g fill="white">
        <!-- 꼬리지느러미 -->
        <path d="M 5.2 12 L 2.2 8.4 L 2.2 15.6 Z"/>
        <!-- 몸통 -->
        <ellipse cx="13" cy="12" rx="7.6" ry="4.4"/>
        <!-- 등지느러미 -->
        <path d="M 11 7.8 Q 13 4.6 16.4 7.4 L 13.6 9 Z"/>
        <!-- 배지느러미 -->
        <path d="M 11.4 16.2 Q 13.4 19 16 16.6 L 13.6 15 Z"/>
      </g>
      <!-- 눈: 투명하게 뚫기 -->
      <circle cx="17.4" cy="10.8" r="1.1" fill="black"/>
    </mask>
  </defs>
  <rect width="24" height="24" fill="white" mask="url(#fishMask)"/>
</svg>`;
}

console.log('Generating Android notification icon (ic_stat_notify)...');

for (const { dir, size } of DENSITIES) {
  const outDir = resolve(RES_DIR, dir);
  mkdirSync(outDir, { recursive: true });
  const svg = Buffer.from(buildSvg(size));
  const out = resolve(outDir, 'ic_stat_notify.png');
  // density 폴더의 표시 px = 24dp 환산이므로 SVG 를 해당 px 로 래스터화
  await sharp(svg, { density: Math.round((size / 24) * 96) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  wrote ${dir}/ic_stat_notify.png (${size}x${size})`);
}

console.log('Done.');
