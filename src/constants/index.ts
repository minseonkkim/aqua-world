import { FishRarity, FishGrowthStage, EggTier, TankEnvironment } from '../types';

// ==================== 가챠 확률 ====================

export const GACHA_RATES: Record<FishRarity, number> = {
  common: 0.6,
  rare: 0.3,
  epic: 0.08,
  legendary: 0.02,
};

// ==================== 성장 시간 (초) ====================

export const GROWTH_TIME_SECONDS: Record<string, number> = {
  egg_to_fry: 300,       // 5분 (알 부화로 처리)
  fry_to_juvenile: 1800, // 30분
  juvenile_to_adult: 7200, // 2시간
  adult_to_large: 86400, // 24시간
};

// 단계 → 다음 단계 진입까지 필요한 초
export const STAGE_DURATION_SECONDS: Record<FishGrowthStage, number | null> = {
  egg: 300,
  fry: 1800,
  juvenile: 7200,
  adult: 86400,
  large: null, // 최종 단계
};

export const NEXT_STAGE: Record<FishGrowthStage, FishGrowthStage | null> = {
  egg: 'fry',
  fry: 'juvenile',
  juvenile: 'adult',
  adult: 'large',
  large: null,
};

// 먹이 한 번이 성장을 가속하는 시간 (초) — 5분
export const FEED_GROWTH_BOOST_SECONDS = 300;

// ==================== 먹이 한도 ====================
// 하루 무료 먹이 횟수는 보유 수조 규모에 비례한다(모든 수조 합산).
//   기본 3회 + 추가 수조 1개당 +2회 + 수조 확장 레벨 1당 +1회
export const FEED_BASE_PER_DAY = 3;
export const FEED_EXTRA_TANK_BONUS = 2;
export const FEED_MAX_CAP = 20; // 과도한 누적 방지 상한

/** 보유 수조들로부터 하루 무료 먹이 횟수를 계산 (클라/서버 공통 규칙) */
export function computeFeedMaxPerDay(tanks: { capacityLevel?: number }[]): number {
  if (!tanks.length) return FEED_BASE_PER_DAY;
  const sumLevel = tanks.reduce(
    (s, t) => s + Math.max(0, Math.min(TANK_MAX_CAPACITY_LEVEL, t.capacityLevel ?? 0)),
    0,
  );
  const extraTanks = Math.max(0, tanks.length - 1);
  return Math.min(FEED_MAX_CAP, FEED_BASE_PER_DAY + extraTanks * FEED_EXTRA_TANK_BONUS + sumLevel);
}

// 먹이 티켓 — 무료 횟수 소진 후 1회씩 소비하는 소모성 아이템 (코인 구매)
export const FEED_TICKET_PACKAGES = [
  { id: 'feed_ticket_1', amount: 1, price: 30 },
  { id: 'feed_ticket_5', amount: 5, price: 135 },
  { id: 'feed_ticket_15', amount: 15, price: 360 },
] as const;

// 성장 스테이지별 메시 스케일
export const STAGE_SCALE: Record<FishGrowthStage, number> = {
  egg: 0.3,
  fry: 0.5,
  juvenile: 0.75,
  adult: 1.0,
  large: 1.4,
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

  // 광고 보고 Star Coral 받기 — 서버 AD_REWARD_LIMITS.ad_star_coral / AD_STAR_CORAL_AMOUNT 와 일치시킬 것.
  AD_STAR_CORAL_AMOUNT: 10, // 광고 1회당 지급
  AD_STAR_CORAL_MAX_PER_DAY: 5, // 하루 최대 시청 횟수 (10 × 5 = 하루 50)

  // playProductId 는 Google Play Console 의 인앱 상품 ID 와 정확히 일치해야 한다(가이드 참조).
  // 현재는 패키지 id 와 동일하게 둔다.
  STAR_CORAL_PACKAGES: [
    { id: 'sc_60', playProductId: 'sc_60', name: '작은 산호', amount: 60, bonus: 0, priceKRW: 1200 },
    { id: 'sc_300', playProductId: 'sc_300', name: '평범한 산호', amount: 300, bonus: 30, priceKRW: 5500 },
    { id: 'sc_600', playProductId: 'sc_600', name: '아름다운 산호', amount: 600, bonus: 90, priceKRW: 11000 },
    { id: 'sc_1200', playProductId: 'sc_1200', name: '화려한 산호', amount: 1200, bonus: 240, priceKRW: 22000 },
    { id: 'sc_3000', playProductId: 'sc_3000', name: '전설의 산호', amount: 3000, bonus: 900, priceKRW: 55000 },
  ],

  // Star Coral → Pearl 환전 패키지 (큰 패키지일수록 환율이 좋아짐)
  PEARL_PACKAGES: [
    { id: 'pearl_500', name: '동전 한 줌', pearl: 500, bonus: 0, starCoral: 5 },
    { id: 'pearl_1200', name: '동전 주머니', pearl: 1200, bonus: 100, starCoral: 10 },
    { id: 'pearl_3000', name: '동전 상자', pearl: 3000, bonus: 400, starCoral: 20 },
    { id: 'pearl_8000', name: '동전 금고', pearl: 8000, bonus: 1500, starCoral: 50 },
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

// ==================== 수조 수용량(마릿수 상한) ====================
// capacityLevel(0~3) → 한 수조에 배치 가능한 최대 물고기 수
export const TANK_CAPACITY_BY_LEVEL = [8, 12, 16, 20] as const;
export const TANK_MAX_CAPACITY_LEVEL = TANK_CAPACITY_BY_LEVEL.length - 1;
// 수조 확장 비용(Pearl): 레벨 0→1, 1→2, 2→3
export const TANK_EXPAND_COST_PEARL = [300, 600, 1200] as const;

/** capacityLevel(미지정 시 0)에 해당하는 마릿수 상한 반환 */
export function getTankCapacity(capacityLevel?: number): number {
  const lvl = Math.max(0, Math.min(TANK_MAX_CAPACITY_LEVEL, capacityLevel ?? 0));
  return TANK_CAPACITY_BY_LEVEL[lvl];
}

// 확장 레벨 → 3D 수조 가로·세로(바닥 면적) 시각 배율. 높이는 고정.
export const TANK_SCALE_BY_LEVEL = [1, 1.12, 1.24, 1.36] as const;

/** capacityLevel(미지정 시 0)에 해당하는 수조 시각 배율 반환 */
export function getTankScale(capacityLevel?: number): number {
  const lvl = Math.max(0, Math.min(TANK_MAX_CAPACITY_LEVEL, capacityLevel ?? 0));
  return TANK_SCALE_BY_LEVEL[lvl];
}

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

export const COMPENDIUM_MILESTONES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

export type CompendiumReward =
  | { type: 'pearl'; amount: number }
  | { type: 'star_coral'; amount: number }
  | { type: 'egg'; tier: EggTier };

export const COMPENDIUM_REWARDS: Record<number, CompendiumReward> = {
  10: { type: 'pearl', amount: 100 },
  20: { type: 'egg', tier: 'basic' },
  30: { type: 'pearl', amount: 200 },
  40: { type: 'star_coral', amount: 20 },
  50: { type: 'egg', tier: 'rare' },
  60: { type: 'pearl', amount: 300 },
  70: { type: 'star_coral', amount: 50 },
  80: { type: 'egg', tier: 'rare' },
  90: { type: 'pearl', amount: 500 },
  100: { type: 'egg', tier: 'legendary' },
};

// ==================== 가챠: 알 등급별 희귀도 풀 ====================

export const RARITY_BY_EGG: Record<EggTier, FishRarity[]> = {
  basic:     ['common','common','common','common','common','common','common','rare','rare','rare'],
  rare:      ['rare','rare','rare','rare','rare','rare','epic','epic','epic','legendary'],
  legendary: ['epic','epic','epic','epic','epic','legendary','legendary','legendary','legendary','legendary'],
};

export const SPECIES_BY_RARITY: Record<FishRarity, string[]> = {
  common:    ['clownfish', 'guppy', 'goldfish', 'seahorse', 'zebrafish', 'pufferfish', 'starfish', 'crab'],
  rare:      ['betta', 'angelfish', 'mandarin_fish', 'jellyfish', 'octopus', 'sea_turtle'],
  epic:      ['leafy_sea_dragon', 'axolotl', 'manta_ray', 'penguin'],
  legendary: ['coelacanth', 'narwhal'],
};

// ==================== 플레이어 레벨 ====================

export const LEVEL_EXP_TABLE = Array.from({ length: 100 }, (_, i) => ({
  level: i + 1,
  requiredExp: Math.floor(100 * Math.pow(1.2, i)),
}));
