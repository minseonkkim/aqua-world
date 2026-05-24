import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Species ID → GLB file basename in /public/models/fish/
const SPECIES_TO_MODEL: Record<string, string> = {
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

const MODEL_IDS = Array.from(new Set(Object.values(SPECIES_TO_MODEL)));

export interface LoadedFishModel {
  scene: THREE.Group;   // pre-rotated so swim direction (+X→+Z) aligns with atan2(vx,vz)
  baseScale: number;    // normalized so max world dimension ≈ TARGET_LENGTH before stage scaling
}

const TARGET_LENGTH = 0.7;
const cache = new Map<string, LoadedFishModel>();
let loadPromise: Promise<Map<string, LoadedFishModel>> | null = null;

function loadOne(loader: GLTFLoader, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    loader.load(
      `${import.meta.env.BASE_URL}models/fish/${id}.glb`,
      (gltf) => {
        const scene = gltf.scene;
        // Compute bounding box before any rotation
        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const baseScale = TARGET_LENGTH / maxDim;
        // GLBs are built facing +X. The TankScene animation uses
        // rotation.y = atan2(vel.x, vel.z), which assumes the model
        // forward is +Z. Bake a -π/2 Y rotation so the inner model
        // forward becomes +Z and the wrapping group can drive heading.
        scene.rotation.y = -Math.PI / 2;
        scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
          }
        });
        cache.set(id, { scene, baseScale });
        resolve();
      },
      undefined,
      (err) => reject(err),
    );
  });
}

export function preloadFishModels(): Promise<Map<string, LoadedFishModel>> {
  if (loadPromise) return loadPromise;
  const loader = new GLTFLoader();
  loadPromise = Promise.all(MODEL_IDS.map((id) => loadOne(loader, id)))
    .then(() => cache)
    .catch((err) => {
      console.error('[fishModelLoader] preload failed', err);
      loadPromise = null;
      return cache;
    });
  return loadPromise;
}

export function getFishModel(speciesId: string): LoadedFishModel | undefined {
  const modelId = SPECIES_TO_MODEL[speciesId];
  if (!modelId) return undefined;
  return cache.get(modelId);
}

// Returns a fresh clone of the cached model's scene ready to be added to a parent.
// The clone keeps the pre-baked -π/2 rotation. Returns null if not loaded yet.
export function cloneFishModel(speciesId: string): THREE.Group | null {
  const model = getFishModel(speciesId);
  if (!model) return null;
  return model.scene.clone(true);
}
