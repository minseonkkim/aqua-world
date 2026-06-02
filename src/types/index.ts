// ==================== Fish ====================

export type FishRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type FishGrowthStage = 'egg' | 'fry' | 'juvenile' | 'adult' | 'large';
export type FishMood = 'happy' | 'normal' | 'bored';

export interface FishSpecies {
  id: string;
  name: string;
  scientificName: string;
  rarity: FishRarity;
  habitat: string;
  description: string;
  modelPath: string;
  thumbnailPath: string;
  baseGrowthTime: number; // seconds per stage
}

export interface Fish {
  id: string;
  speciesId: string;
  name: string;
  growthStage: FishGrowthStage;
  growthProgress: number; // 0-100 (last computed snapshot)
  mood: FishMood;
  feedCount: number; // total feeds received
  lastFedAt: number; // unix timestamp
  acquiredAt: number;
  stageStartedAt: number; // 현재 단계 진입 시각 (unix ms)
  growthBoostSeconds: number; // 먹이로 누적된 성장 가속 (초). 단계 승급 시 0으로 초기화
  position: { x: number; y: number; z: number };
  color?: string; // optional color override
}

// ==================== Egg ====================

export type EggTier = 'basic' | 'rare' | 'legendary';

export interface Egg {
  id: string;
  tier: EggTier;
  hatchDuration: number; // seconds
  startedAt: number; // unix timestamp, 0 if not started
  isHatching: boolean;
}

// ==================== Tank ====================

export type TankEnvironment = 'coral_reef' | 'deep_sea' | 'korean_river' | 'amazon' | 'space';

export interface TankDecoration {
  id: string;
  type: 'plant' | 'rock' | 'driftwood' | 'ornament';
  modelId: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
}

export interface DecorationPreset {
  slot: number; // 0, 1, 2
  decorations: TankDecoration[];
  savedAt: number;
}

export interface Tank {
  id: string;
  name: string;
  environment: TankEnvironment;
  fish: Fish[];
  decorations: TankDecoration[];
  cleanliness: number; // 0-100
  lightMode: 'auto' | 'day' | 'night' | 'sunset';
  createdAt: number;
  updatedAt: number;
  decorationPresets?: DecorationPreset[];
  /** 마지막 청결도 감쇠 계산 시각(unix ms). 없으면 updatedAt fallback */
  lastCleanlinessTickAt?: number;
  /** 수조 수용량 레벨(0~3) → 마릿수 상한(8/12/16/20). 없으면 0 */
  capacityLevel?: number;
}

// ==================== User ====================

export interface User {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  pearl: number;
  starCoral: number;
  level: number;
  experience: number;
  loginStreak: number;
  lastLoginAt: number;
  createdAt: number;
  tanks: string[]; // tank IDs
  inventory: Egg[];
  /** 보관함(아쿠아 박스): 어느 수조에도 배치되지 않은 물고기 */
  fishInventory?: Fish[];
  collectedSpecies: string[]; // species IDs
  feedCountToday: number;
  lastFeedResetAt: number;
  /** 튜토리얼 진행도: 0=시작 전, 1~5=진행 중, -1=완료/스킵 */
  tutorialStep?: number;
  /** 데코 인벤토리: modelId → 보유 수량 */
  decorationInventory?: Record<string, number>;
  /** 청구 완료한 도감 마일스톤(%) 목록 */
  claimedCompendiumMilestones?: number[];
}

// ==================== Shop ====================

export type ShopItemType = 'egg' | 'decoration' | 'star_coral_package' | 'subscription';

export interface ShopItem {
  id: string;
  type: ShopItemType;
  name: string;
  description: string;
  thumbnailPath: string;
  price: {
    currency: 'pearl' | 'star_coral' | 'krw';
    amount: number;
  };
  bonusAmount?: number;
  isLimitedTime?: boolean;
  expiresAt?: number;
}

// ==================== Navigation ====================

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Tank: undefined;
  Compendium: undefined;
  Shop: undefined;
  Friends: undefined;
  Settings: undefined;
};

export type TankStackParamList = {
  TankMain: undefined;
  Decoration: undefined;
  PhotoMode: undefined;
  FishDetail: { fishId: string };
};
