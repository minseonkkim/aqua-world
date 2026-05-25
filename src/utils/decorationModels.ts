import * as THREE from 'three';
import { TankDecoration } from '@/types';
import { cloneDecorationModel } from './decorationModelLoader';

export type DecorationType = TankDecoration['type'];

export interface DecorationMeta {
  modelId: string;
  type: DecorationType;
  name: string;
  emoji: string;
  price: number;
  defaultScale: number;
}

export const DECORATION_CATALOG: DecorationMeta[] = [
  // 수초 8
  { modelId: 'seagrass',        type: 'plant',     name: '바다 잔디',   emoji: '🌱', price: 30,  defaultScale: 1.0 },
  { modelId: 'kelp',            type: 'plant',     name: '다시마',      emoji: '🌿', price: 40,  defaultScale: 1.0 },
  { modelId: 'coral_branch',    type: 'plant',     name: '가지 산호',   emoji: '🪸', price: 60,  defaultScale: 1.0 },
  { modelId: 'coral_brain',     type: 'plant',     name: '뇌 산호',     emoji: '🧠', price: 80,  defaultScale: 1.0 },
  { modelId: 'anemone',         type: 'plant',     name: '말미잘',      emoji: '🌸', price: 70,  defaultScale: 1.0 },
  { modelId: 'bamboo_water',    type: 'plant',     name: '수중 대나무', emoji: '🎋', price: 90,  defaultScale: 1.0 },
  { modelId: 'fern_aquatic',    type: 'plant',     name: '수중 양치',   emoji: '🌿', price: 50,  defaultScale: 1.0 },
  { modelId: 'moss_ball',       type: 'plant',     name: '모스볼',      emoji: '🟢', price: 40,  defaultScale: 1.0 },
  // 바위 6
  { modelId: 'pebble_pile',     type: 'rock',      name: '자갈 더미',   emoji: '🪨', price: 20,  defaultScale: 1.0 },
  { modelId: 'boulder_dark',    type: 'rock',      name: '검은 바위',   emoji: '⬛', price: 50,  defaultScale: 1.0 },
  { modelId: 'lava_rock',       type: 'rock',      name: '용암석',      emoji: '🌋', price: 120, defaultScale: 1.0 },
  { modelId: 'slate_flat',      type: 'rock',      name: '슬레이트',    emoji: '🟫', price: 40,  defaultScale: 1.0 },
  { modelId: 'crystal_blue',    type: 'rock',      name: '청수정',      emoji: '💎', price: 150, defaultScale: 1.0 },
  { modelId: 'geode_purple',    type: 'rock',      name: '자수정 정동', emoji: '🟣', price: 180, defaultScale: 1.0 },
  // 유목 4
  { modelId: 'branch_straight', type: 'driftwood', name: '곧은 가지',   emoji: '🪵', price: 30,  defaultScale: 1.0 },
  { modelId: 'root_twisted',    type: 'driftwood', name: '뒤틀린 뿌리', emoji: '🌳', price: 70,  defaultScale: 1.0 },
  { modelId: 'log_hollow',      type: 'driftwood', name: '빈 통나무',   emoji: '🪵', price: 90,  defaultScale: 1.0 },
  { modelId: 'stick_small',     type: 'driftwood', name: '작은 막대',   emoji: '🥢', price: 15,  defaultScale: 1.0 },
  // 장식 8
  { modelId: 'treasure_chest',  type: 'ornament',  name: '보물상자',    emoji: '🎁', price: 200, defaultScale: 1.0 },
  { modelId: 'pirate_ship',     type: 'ornament',  name: '난파선',      emoji: '🚢', price: 300, defaultScale: 1.0 },
  { modelId: 'clay_pot',        type: 'ornament',  name: '도자기 항아리', emoji: '🏺', price: 80, defaultScale: 1.0 },
  { modelId: 'ship_wheel',      type: 'ornament',  name: '배 키',       emoji: '⚓', price: 110, defaultScale: 1.0 },
  { modelId: 'pearl_shell',     type: 'ornament',  name: '진주 조개',   emoji: '🦪', price: 130, defaultScale: 1.0 },
  { modelId: 'roman_pillar',    type: 'ornament',  name: '로마 기둥',   emoji: '🏛️', price: 160, defaultScale: 1.0 },
  { modelId: 'arch_ring',       type: 'ornament',  name: '아치',        emoji: '🌉', price: 140, defaultScale: 1.0 },
  { modelId: 'bubble_chimney',  type: 'ornament',  name: '거품 굴뚝',   emoji: '💨', price: 100, defaultScale: 1.0 },
];

const META_BY_ID = new Map(DECORATION_CATALOG.map(m => [m.modelId, m]));

export function getDecorationMeta(modelId: string): DecorationMeta | undefined {
  return META_BY_ID.get(modelId);
}

/** GLB 로드 전이거나 modelId 미존재 시 fallback 플레이스홀더 (회색 큐브) */
function buildPlaceholder(): THREE.Group {
  const g = new THREE.Group();
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.7 }),
  );
  cube.position.y = 0.15;
  g.add(cube);
  return g;
}

/**
 * modelId로 데코 메시 생성. GLB가 로드돼있으면 clone, 아니면 회색 플레이스홀더.
 * 데코는 base가 y=0에 위치하도록 생성됨 (Group origin = 바닥 접점).
 */
export function buildDecorationMesh(modelId: string): THREE.Group {
  const cloned = cloneDecorationModel(modelId);
  if (cloned) return cloned;
  return buildPlaceholder();
}

export function listDecorationsByType(type: DecorationType): DecorationMeta[] {
  return DECORATION_CATALOG.filter(d => d.type === type);
}
