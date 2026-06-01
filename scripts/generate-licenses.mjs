#!/usr/bin/env node
/**
 * 프로덕션 의존성의 라이선스 정보를 추출하여 src/assets/licenses.json 생성.
 * - 빌드 시 자동 실행 (npm run build → gen:licenses 먼저)
 * - 결과는 LicensesPage가 import해서 렌더
 *
 * 각 항목 구조:
 *   { name, version, license, publisher?, repository?, licenseText }
 */
import { init } from 'license-checker-rseidelsohn';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outPath = resolve(root, 'src/assets/licenses.json');

init(
  {
    start: root,
    production: true,        // dev 의존성 제외
    excludePrivatePackages: true,
    customFormat: {
      name: '',
      version: '',
      licenses: '',
      publisher: '',
      repository: '',
      licenseFile: '',
    },
  },
  (err, packages) => {
    if (err) {
      console.error('[gen:licenses] failed:', err);
      process.exit(1);
    }

    const entries = Object.entries(packages)
      // 자기 자신(aquaworld@x) 제외
      .filter(([key]) => !key.startsWith('aquaworld@'))
      .map(([key, info]) => {
        const atIdx = key.lastIndexOf('@');
        const name = key.slice(0, atIdx);
        const version = key.slice(atIdx + 1);
        let licenseText = '';
        if (info.licenseFile) {
          try {
            const raw = readFileSync(info.licenseFile, 'utf8');
            // 모노레포 서브 패키지는 LICENSE 대신 README가 잡히는 경우가 있다.
            // 라이선스 본문에 흔히 등장하는 키워드로 휴리스틱 검증.
            const looksLikeLicense =
              /copyright|permission is hereby granted|apache license|mit license|bsd license|isc license|mozilla public license|gnu general public|the unlicense/i.test(raw);
            if (looksLikeLicense) licenseText = raw;
          } catch {
            // 파일이 사라졌거나 권한 문제 — 본문 없이 메타만
          }
        }
        return {
          name,
          version,
          license: info.licenses || 'UNKNOWN',
          publisher: info.publisher || undefined,
          repository: info.repository || undefined,
          licenseText: licenseText || undefined,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(entries, null, 2) + '\n', 'utf8');
    console.log(`[gen:licenses] wrote ${entries.length} packages → ${outPath}`);
  },
);
