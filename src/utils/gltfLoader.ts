import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Shared DRACOLoader — wasm decoder is fetched/instantiated once and reused
// across fish + decoration GLBs. Files are served from public/draco/.
let sharedDraco: DRACOLoader | null = null;

function getDracoLoader(): DRACOLoader {
  if (sharedDraco) return sharedDraco;
  const d = new DRACOLoader();
  d.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  // wasm decoder (draco_wasm_wrapper.js + draco_decoder.wasm) — js fallback 미포함
  d.setDecoderConfig({ type: 'wasm' });
  sharedDraco = d;
  return d;
}

export function createGLTFLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(getDracoLoader());
  return loader;
}
