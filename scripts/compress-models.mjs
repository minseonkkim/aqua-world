// Compresses all GLBs under public/models/ in place using KHR_draco_mesh_compression.
// Typically shrinks meshes 70~90%. Decode is done at runtime via three.js DRACOLoader.
//
// Run:  npm run gen:models:compress
//       (also runs automatically as part of gen:fish / gen:decoration)
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = resolve(__dirname, '..', 'public', 'models');

function walkGlbs(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkGlbs(p));
    else if (extname(name).toLowerCase() === '.glb') out.push(p);
  }
  return out;
}

async function main() {
  const files = walkGlbs(MODELS_DIR);
  if (files.length === 0) {
    console.log('[compress-models] no GLBs under', MODELS_DIR);
    return;
  }

  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of files) {
    const rel = file.slice(MODELS_DIR.length + 1);
    const before = statSync(file).size;

    const doc = await io.read(file);

    // Skip if already Draco-compressed (idempotent re-runs)
    const alreadyDraco = doc
      .getRoot()
      .listExtensionsUsed()
      .some((e) => e.extensionName === 'KHR_draco_mesh_compression');
    if (alreadyDraco) {
      console.log(`  skip  ${rel} (already Draco)`);
      totalBefore += before;
      totalAfter += before;
      continue;
    }

    await doc.transform(
      draco({
        method: 'edgebreaker',
        // 11~14 is a good range. Higher = smaller file, tiny quality loss.
        quantizePosition: 14,
        quantizeNormal: 10,
        quantizeTexcoord: 12,
        quantizeColor: 8,
        quantizeGeneric: 12,
      }),
    );

    await io.write(file, doc);
    const after = statSync(file).size;
    totalBefore += before;
    totalAfter += after;
    const pct = ((1 - after / before) * 100).toFixed(1);
    console.log(`  draco ${rel.padEnd(40)} ${(before / 1024).toFixed(1).padStart(7)}KB → ${(after / 1024).toFixed(1).padStart(7)}KB  (-${pct}%)`);
  }

  const totalPct = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
  console.log(
    `\n[compress-models] ${files.length} files  ${(totalBefore / 1024).toFixed(1)}KB → ${(totalAfter / 1024).toFixed(1)}KB  (-${totalPct}%)`,
  );
}

main().catch((err) => {
  console.error('[compress-models] failed:', err);
  process.exit(1);
});
