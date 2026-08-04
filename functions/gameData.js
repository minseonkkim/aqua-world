/**
 * 서버 권위 게임 데이터. 클라이언트의 src/constants 와 값이 일치해야 한다.
 * (작은 프로젝트라 의도적으로 중복 — 변경 시 양쪽을 함께 수정할 것)
 */

// ─── 신규 유저 시작 재화 ───
const START_PEARL = 500;
const START_STAR_CORAL = 50;

// ─── 수조 수용량(마릿수 상한) ───
// capacityLevel(0~3) → 한 수조에 배치 가능한 최대 물고기 수 (클라 src/constants 와 일치)
const TANK_CAPACITY_BY_LEVEL = [8, 12, 16, 20];
const TANK_MAX_CAPACITY_LEVEL = TANK_CAPACITY_BY_LEVEL.length - 1;
// 수조 확장 비용(Pearl): 레벨 0→1, 1→2, 2→3 (클라 src/constants 와 일치)
const TANK_EXPAND_COST_PEARL = [300, 600, 1200];
// 수조 청소 비용(Pearl) (클라 src/utils/mood 와 일치)
const CLEAN_TANK_COST_PEARL = 50;

/** capacityLevel(미지정 시 0)에 해당하는 마릿수 상한 반환 */
function getTankCapacity(capacityLevel) {
  const lvl = Math.max(0, Math.min(TANK_MAX_CAPACITY_LEVEL, capacityLevel || 0));
  return TANK_CAPACITY_BY_LEVEL[lvl];
}

// ─── 물고기 종 (id → 메타) ───
// gen 1: 출시 10종 (도감 1페이지), gen 2: v1.1.0 신규 10종 (도감 2페이지).
// 2세대는 1세대 도감을 전부 모아야 해금 — 해금 전에는 가챠·번식 풀에서 제외.
const SPECIES = {
  clownfish: { name: "클라운피시", rarity: "common", gen: 1 },
  guppy: { name: "구피", rarity: "common", gen: 1 },
  goldfish: { name: "금붕어", rarity: "common", gen: 1 },
  seahorse: { name: "해마", rarity: "common", gen: 1 },
  zebrafish: { name: "제브라피시", rarity: "common", gen: 1 },
  betta: { name: "베타", rarity: "rare", gen: 1 },
  angelfish: { name: "엔젤피시", rarity: "rare", gen: 1 },
  mandarin_fish: { name: "만다린피시", rarity: "rare", gen: 1 },
  leafy_sea_dragon: { name: "바다용", rarity: "epic", gen: 1 },
  coelacanth: { name: "실러캔스", rarity: "legendary", gen: 1 },
  neon_tetra: { name: "네온테트라", rarity: "common", gen: 2 },
  butterflyfish: { name: "나비고기", rarity: "common", gen: 2 },
  pufferfish: { name: "복어", rarity: "common", gen: 2 },
  blue_tang: { name: "블루탱", rarity: "rare", gen: 2 },
  discus: { name: "디스커스", rarity: "rare", gen: 2 },
  koi: { name: "코이", rarity: "rare", gen: 2 },
  lionfish: { name: "라이언피시", rarity: "epic", gen: 2 },
  anglerfish: { name: "초롱아귀", rarity: "epic", gen: 2 },
  arowana: { name: "아로와나", rarity: "legendary", gen: 2 },
  oarfish: { name: "산갈치", rarity: "legendary", gen: 2 },
};
const SPECIES_COUNT = Object.keys(SPECIES).length; // 도감 총 종 수 (20)

// ─── 가챠: 알 등급별 희귀도 풀 ───
const RARITY_BY_EGG = {
  basic: ["common", "common", "common", "common", "common", "common", "common", "rare", "rare", "rare"],
  rare: ["rare", "rare", "rare", "rare", "rare", "rare", "epic", "epic", "epic", "legendary"],
  legendary: ["epic", "epic", "epic", "epic", "epic", "legendary", "legendary", "legendary", "legendary", "legendary"],
};

function speciesIdsBy(rarity, gen) {
  return Object.keys(SPECIES).filter(
    (id) => SPECIES[id].rarity === rarity && (gen === undefined || SPECIES[id].gen === gen),
  );
}

// 1세대 전용 풀(해금 전) / 전체 풀(해금 후)
const GEN1_SPECIES_BY_RARITY = {
  common: speciesIdsBy("common", 1),
  rare: speciesIdsBy("rare", 1),
  epic: speciesIdsBy("epic", 1),
  legendary: speciesIdsBy("legendary", 1),
};
const SPECIES_BY_RARITY = {
  common: speciesIdsBy("common"),
  rare: speciesIdsBy("rare"),
  epic: speciesIdsBy("epic"),
  legendary: speciesIdsBy("legendary"),
};
const GEN1_SPECIES_IDS = Object.keys(SPECIES).filter((id) => SPECIES[id].gen === 1);
const GEN2_SPECIES_IDS = Object.keys(SPECIES).filter((id) => SPECIES[id].gen === 2);

/** 2세대 해금 여부 — 1세대(출시 10종) 도감을 전부 모았는가 */
function isGen2Unlocked(collectedSpecies) {
  const collected = collectedSpecies || [];
  return GEN1_SPECIES_IDS.every((id) => collected.includes(id));
}

/** 가챠 추첨 풀: 2세대 해금 전에는 1세대만 나온다 (클라 src/constants getGachaPool 과 일치) */
function getGachaPool(rarity, collectedSpecies) {
  return isGen2Unlocked(collectedSpecies) ? SPECIES_BY_RARITY[rarity] : GEN1_SPECIES_BY_RARITY[rarity];
}

// ─── 번식(짝짓기) ───
// 같은 종 성어 2마리로 번식 알을 얻는다. 부모는 사라지지 않고 각자 쿨다운에 들어간다.
// 클라 src/constants (BREED_*) 와 값이 일치해야 한다.
const BREEDABLE_STAGES = ["adult", "large"];
const BREED_COST_PEARL = 200;
const BREED_COOLDOWN_SECONDS = 12 * 3600; // 12시간
const BREED_UPGRADE_RATE = 0.08; // 한 단계 상위 등급으로 부화할 확률
const NEXT_RARITY = { common: "rare", rare: "epic", epic: "legendary", legendary: null };
const BREED_EGG_TIER_BY_RARITY = { common: "basic", rare: "rare", epic: "legendary", legendary: "legendary" };

// ─── 알 ───
const EGG_HATCH_TIME = { basic: 300, rare: 1800, legendary: 7200 };
const EGG_PRICES = {
  basic: { currency: "pearl", price: 100 },
  rare: { currency: "star_coral", price: 50 },
  legendary: { currency: "star_coral", price: 150 },
};

// ─── 성장 ───
const STAGE_DURATION_SECONDS = {
  egg: 300,
  fry: 1800,
  juvenile: 7200,
  adult: 86400,
  large: null,
};
const NEXT_STAGE = {
  egg: "fry",
  fry: "juvenile",
  juvenile: "adult",
  adult: "large",
  large: null,
};
const FEED_GROWTH_BOOST_SECONDS = 300;

// ─── 먹이 ───
// 하루 무료 먹이 횟수는 보유 수조 규모에 비례(클라 src/constants 의 computeFeedMaxPerDay 와 일치).
//   기본 3회 + 추가 수조 1개당 +2회 + 수조 확장 레벨 1당 +1회 (상한 20)
const FEED_MAX_PER_DAY = 3; // 기본값(수조 0개 폴백)
const FEED_BASE_PER_DAY = 3;
const FEED_EXTRA_TANK_BONUS = 2;
const FEED_MAX_CAP = 20;
const FEED_PEARL_REWARD = 10;
// 먹이 1회당 수조 오염량(청결도 감소). 클라 src/utils/mood.ts 의 CLEANLINESS_PER_FEED 와 일치.
const CLEANLINESS_PER_FEED = 1.5;

/** 수조 capacityLevel 배열로부터 하루 무료 먹이 횟수 계산 */
function computeFeedMaxPerDay(capacityLevels) {
  if (!capacityLevels || capacityLevels.length === 0) return FEED_BASE_PER_DAY;
  const sumLevel = capacityLevels.reduce(
    (s, lv) => s + Math.max(0, Math.min(TANK_MAX_CAPACITY_LEVEL, lv || 0)),
    0,
  );
  const extraTanks = Math.max(0, capacityLevels.length - 1);
  return Math.min(FEED_MAX_CAP, FEED_BASE_PER_DAY + extraTanks * FEED_EXTRA_TANK_BONUS + sumLevel);
}

// 먹이 티켓 — 무료 소진 후 1장씩 소비(코인 구매). 클라 src/constants FEED_TICKET_PACKAGES 와 일치.
const FEED_TICKET_PACKAGES = {
  feed_ticket_1: { amount: 1, price: 30 },
  feed_ticket_5: { amount: 5, price: 135 },
  feed_ticket_15: { amount: 15, price: 360 },
};

// ─── 일일 로그인 보상 (7일 주기) ───
const DAILY_LOGIN_REWARDS = [
  { day: 1, type: "pearl", amount: 50 },
  { day: 2, type: "pearl", amount: 100 },
  { day: 3, type: "egg", tier: "basic" },
  { day: 4, type: "pearl", amount: 150 },
  { day: 5, type: "star_coral", amount: 10 },
  { day: 6, type: "egg", tier: "rare" },
  { day: 7, type: "star_coral", amount: 30 },
];

// ─── Star Coral → Pearl 환전 패키지 ───
const PEARL_PACKAGES = {
  pearl_500: { pearl: 500, bonus: 0, starCoral: 5 },
  pearl_1200: { pearl: 1200, bonus: 100, starCoral: 10 },
  pearl_3000: { pearl: 3000, bonus: 400, starCoral: 20 },
  pearl_8000: { pearl: 8000, bonus: 1500, starCoral: 50 },
};

// Star Coral 은 보상형 광고로만 지급된다(AD_STAR_CORAL_AMOUNT). 인앱결제 패키지 정의와
// 영수증 검증용 패키지명은 결제 경로를 걷어내면서 함께 제거했다.

// ─── 도감 마일스톤 보상 ───
// 페이지(바다)별 독립 트랙: COMPENDIUM_REWARDS = 1페이지(시작의 바다),
// COMPENDIUM_REWARDS_PAGE2 = 2페이지(미지의 바다, 후반 콘텐츠라 상향).
// 청구 기록도 페이지별 분리: claimedCompendiumMilestones / claimedCompendiumMilestones2.
const COMPENDIUM_REWARDS = {
  10: { type: "pearl", amount: 100 },
  20: { type: "egg", tier: "basic" },
  30: { type: "pearl", amount: 200 },
  40: { type: "star_coral", amount: 20 },
  50: { type: "egg", tier: "rare" },
  60: { type: "pearl", amount: 300 },
  70: { type: "star_coral", amount: 50 },
  80: { type: "egg", tier: "rare" },
  90: { type: "pearl", amount: 500 },
  100: { type: "egg", tier: "legendary" },
};
const COMPENDIUM_REWARDS_PAGE2 = {
  10: { type: "pearl", amount: 200 },
  20: { type: "egg", tier: "rare" },
  30: { type: "pearl", amount: 400 },
  40: { type: "star_coral", amount: 30 },
  50: { type: "egg", tier: "rare" },
  60: { type: "pearl", amount: 600 },
  70: { type: "star_coral", amount: 60 },
  80: { type: "egg", tier: "rare" },
  90: { type: "pearl", amount: 1000 },
  100: { type: "egg", tier: "legendary" },
};

// ─── 데코 가격 (구매만 서버 검증; 배치/소비는 Phase 2) ───
const DECORATION_PRICES = {
  seagrass: 30, kelp: 40, coral_branch: 60, coral_brain: 80, anemone: 70,
  bamboo_water: 90, fern_aquatic: 50, moss_ball: 40,
  pebble_pile: 20, boulder_dark: 50, lava_rock: 120, slate_flat: 40,
  crystal_blue: 150, geode_purple: 180,
  branch_straight: 30, root_twisted: 70, log_hollow: 90, stick_small: 15,
  treasure_chest: 200, pirate_ship: 300, clay_pot: 80, ship_wheel: 110,
  pearl_shell: 130, roman_pillar: 160, arch_ring: 140, bubble_chimney: 100,
};

module.exports = {
  START_PEARL,
  START_STAR_CORAL,
  TANK_CAPACITY_BY_LEVEL,
  TANK_MAX_CAPACITY_LEVEL,
  TANK_EXPAND_COST_PEARL,
  CLEAN_TANK_COST_PEARL,
  getTankCapacity,
  SPECIES,
  SPECIES_COUNT,
  RARITY_BY_EGG,
  SPECIES_BY_RARITY,
  GEN1_SPECIES_BY_RARITY,
  GEN1_SPECIES_IDS,
  GEN2_SPECIES_IDS,
  isGen2Unlocked,
  getGachaPool,
  BREEDABLE_STAGES,
  BREED_COST_PEARL,
  BREED_COOLDOWN_SECONDS,
  BREED_UPGRADE_RATE,
  NEXT_RARITY,
  BREED_EGG_TIER_BY_RARITY,
  EGG_HATCH_TIME,
  EGG_PRICES,
  STAGE_DURATION_SECONDS,
  NEXT_STAGE,
  FEED_GROWTH_BOOST_SECONDS,
  FEED_MAX_PER_DAY,
  FEED_BASE_PER_DAY,
  FEED_EXTRA_TANK_BONUS,
  FEED_MAX_CAP,
  computeFeedMaxPerDay,
  FEED_TICKET_PACKAGES,
  FEED_PEARL_REWARD,
  CLEANLINESS_PER_FEED,
  DAILY_LOGIN_REWARDS,
  PEARL_PACKAGES,
  COMPENDIUM_REWARDS,
  COMPENDIUM_REWARDS_PAGE2,
  DECORATION_PRICES,
};
