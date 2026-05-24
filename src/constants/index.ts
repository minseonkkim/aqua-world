import { FishRarity, EggTier, TankEnvironment } from '../types';

// ==================== 가챠 확률 ====================

export const GACHA_RATES: Record<FishRarity, number> = {
  common: 0.6,
  rare: 0.3,
  epic: 0.08,
  legendary: 0.02,
};

// ==================== 성장 시간 (초) ====================

export const GROWTH_TIME_SECONDS: Record<string, number> = {
  egg_to_fry: 300,       // 5분
  fry_to_juvenile: 1800, // 30분
  juvenile_to_adult: 7200, // 2시간
  adult_to_large: 86400, // 24시간
};

// ==================== 알 부화 시간 (초) ====================

export const EGG_HATCH_TIME: Record<EggTier, number> = {
  basic: 300,      // 5분
  rare: 1800,      // 30분
  legendary: 7200, // 2시간
};

// ==================== 재화 ====================

export const CURRENCY = {
  DAILY_LOGIN_PEARL: 50,
  FEED_PEARL_REWARD: 10,
  AD_WATCH_PEARL: 30,
  FEED_MAX_PER_DAY: 3,
  AD_MAX_PER_DAY: 10,

  STAR_CORAL_PACKAGES: [
    { id: 'sc_60', name: '작은 산호', amount: 60, bonus: 0, priceKRW: 1200 },
    { id: 'sc_300', name: '평범한 산호', amount: 300, bonus: 30, priceKRW: 5500 },
    { id: 'sc_600', name: '아름다운 산호', amount: 600, bonus: 90, priceKRW: 11000 },
    { id: 'sc_1200', name: '화려한 산호', amount: 1200, bonus: 240, priceKRW: 22000 },
    { id: 'sc_3000', name: '전설의 산호', amount: 3000, bonus: 900, priceKRW: 55000 },
  ],
};

// ==================== 수조 환경 ====================

export const TANK_ENVIRONMENTS: Record<TankEnvironment, { name: string; unlockLevel: number }> = {
  coral_reef: { name: '산호초', unlockLevel: 1 },
  deep_sea: { name: '심해', unlockLevel: 5 },
  korean_river: { name: '한국 강', unlockLevel: 10 },
  amazon: { name: '아마존', unlockLevel: 15 },
  space: { name: '우주', unlockLevel: 20 },
};

// ==================== 일일 로그인 보상 (7일) ====================

export const DAILY_LOGIN_REWARDS = [
  { day: 1, type: 'pearl' as const, amount: 50 },
  { day: 2, type: 'pearl' as const, amount: 100 },
  { day: 3, type: 'egg' as const, tier: 'basic' as const },
  { day: 4, type: 'pearl' as const, amount: 150 },
  { day: 5, type: 'star_coral' as const, amount: 10 },
  { day: 6, type: 'egg' as const, tier: 'rare' as const },
  { day: 7, type: 'star_coral' as const, amount: 30 },
];

// ==================== 색상 ====================

export const COLORS = {
  primary: '#0066CC',
  primaryLight: '#4DA6FF',
  primaryDark: '#004499',

  secondary: '#00CCAA',
  secondaryLight: '#66FFE6',
  secondaryDark: '#009980',

  accent: '#FFD700',
  accentLight: '#FFE566',
  accentDark: '#CCA800',

  background: '#0A1628',
  backgroundLight: '#1A2A44',
  surface: '#1E3A5F',
  surfaceLight: '#2A4A6F',

  text: '#FFFFFF',
  textSecondary: '#B0C4DE',
  textDisabled: '#5A7A9A',

  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  pearl: '#E8D5B7',
  starCoral: '#FF6B9D',
  eventToken: '#9B59B6',

  rarityCommon: '#9E9E9E',
  rarityRare: '#2196F3',
  rarityEpic: '#9C27B0',
  rarityLegendary: '#FF8F00',
} as const;

// ==================== 간격 (8px 기반) ====================

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ==================== 도감 마일스톤 ====================

export const COMPENDIUM_MILESTONES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// ==================== 가챠: 알 등급별 희귀도 풀 ====================

import { FishRarity, EggTier } from '../types';

export const RARITY_BY_EGG: Record<EggTier, FishRarity[]> = {
  basic:     ['common','common','common','common','common','common','common','rare','rare','rare'],
  rare:      ['rare','rare','rare','rare','rare','rare','epic','epic','epic','legendary'],
  legendary: ['epic','epic','epic','epic','epic','legendary','legendary','legendary','legendary','legendary'],
};

export const SPECIES_BY_RARITY: Record<FishRarity, string[]> = {
  common:    ['clownfish', 'guppy', 'goldfish', 'seahorse', 'zebrafish'],
  rare:      ['betta', 'angelfish', 'mandarin_fish'],
  epic:      ['leafy_sea_dragon'],
  legendary: ['coelacanth'],
};

// ==================== 플레이어 레벨 ====================

export const LEVEL_EXP_TABLE = Array.from({ length: 100 }, (_, i) => ({
  level: i + 1,
  requiredExp: Math.floor(100 * Math.pow(1.2, i)),
}));
