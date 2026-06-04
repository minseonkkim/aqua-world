import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createGLTFLoader } from './gltfLoader';

// modelId → GLB basename in /public/models/decoration/
const MODEL_IDS = [
  // plants
  'seagrass', 'kelp', 'coral_branch', 'coral_brain', 'anemone',
  'bamboo_water', 'fern_aquatic', 'moss_ball',
  // rocks
  'pebble_pile', 'boulder_dark', 'lava_rock', 'slate_flat',
  'crystal_blue', 'geode_purple',
  // driftwood
  'branch_straight', 'root_twisted', 'log_hollow', 'stick_small',
  // ornaments
  'treasure_chest', 'pirate_ship', 'clay_pot', 'ship_wheel',
  'pearl_shell', 'roman_pillar', 'arch_ring', 'bubble_chimney',
] as const;

export interface LoadedDecorationModel {
  scene: THREE.Group;
  /** 카탈로그 표시용 footprint 직경 (월드 단위). 배치 시 충돌/스냅에 활용 가능 */
  baseFootprint: number;
}

const cache = new Map<string, LoadedDecorationModel>();
let loadPromise: Promise<Map<string, LoadedDecorationModel>> | null = null;

function loadOne(loader: GLTFLoader, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    loader.load(
      `${import.meta.env.BASE_URL}models/decoration/${id}.glb`,
      (gltf) => {
        const scene = gltf.scene;
        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const baseFootprint = Math.max(size.x, size.z) || 0.5;
        scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
          }
        });
        cache.set(id, { scene, baseFootprint });
        resolve();
      },
      undefined,
      (err) => reject(err),
    );
  });
}

export function preloadDecorationModels(): Promise<Map<string, LoadedDecorationModel>> {
  if (loadPromise) return loadPromise;
  const loader = createGLTFLoader();
  loadPromise = Promise.all(MODEL_IDS.map((id) => loadOne(loader, id)))
    .then(() => cache)
    .catch((err) => {
      console.error('[decorationModelLoader] preload failed', err);
      loadPromise = null;
      return cache;
    });
  return loadPromise;
}

export function getDecorationModel(modelId: string): LoadedDecorationModel | undefined {
  return cache.get(modelId);
}

/** 새 clone(); 캐시에 없으면 null */
export function cloneDecorationModel(modelId: string): THREE.Group | null {
  const m = cache.get(modelId);
  if (!m) return null;
  return m.scene.clone(true);
}
