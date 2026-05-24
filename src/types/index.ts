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
  collectedSpecies: string[]; // species IDs
  feedCountToday: number;
  lastFeedResetAt: number;
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
