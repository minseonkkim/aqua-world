/**
 * 서버 권위 게임 데이터. 클라이언트의 src/constants 와 값이 일치해야 한다.
 * (작은 프로젝트라 의도적으로 중복 — 변경 시 양쪽을 함께 수정할 것)
 */

// ─── 신규 유저 시작 재화 ───
const START_PEARL = 200;
const START_STAR_CORAL = 20;

// ─── 물고기 종 (id → 메타) ───
const SPECIES = {
  clownfish: { name: "클라운피시", rarity: "common" },
  guppy: { name: "구피", rarity: "common" },
  goldfish: { name: "금붕어", rarity: "common" },
  seahorse: { name: "해마", rarity: "common" },
  zebrafish: { name: "제브라피시", rarity: "common" },
  betta: { name: "베타", rarity: "rare" },
  angelfish: { name: "엔젤피시", rarity: "rare" },
  mandarin_fish: { name: "만다린피시", rarity: "rare" },
  leafy_sea_dragon: { name: "바다용", rarity: "epic" },
  coelacanth: { name: "실러캔스", rarity: "legendary" },
};
const SPECIES_COUNT = Object.keys(SPECIES).length; // 도감 총 종 수 (10)

// ─── 가챠: 알 등급별 희귀도 풀 ───
const RARITY_BY_EGG = {
  basic: ["common", "common", "common", "common", "common", "common", "common", "rare", "rare", "rare"],
  rare: ["rare", "rare", "rare", "rare", "rare", "rare", "epic", "epic", "epic", "legendary"],
  legendary: ["epic", "epic", "epic", "epic", "epic", "legendary", "legendary", "legendary", "legendary", "legendary"],
};
const SPECIES_BY_RARITY = {
  common: ["clownfish", "guppy", "goldfish", "seahorse", "zebrafish"],
  rare: ["betta", "angelfish", "mandarin_fish"],
  epic: ["leafy_sea_dragon"],
  legendary: ["coelacanth"],
};

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
const FEED_MAX_PER_DAY = 3;
const FEED_PEARL_REWARD = 10;

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

// ─── Star Coral 패키지 (KRW 결제 — 실제 결제 검증은 추후 IAP에서) ───
const STAR_CORAL_PACKAGES = {
  sc_60: { amount: 60, bonus: 0 },
  sc_300: { amount: 300, bonus: 30 },
  sc_600: { amount: 600, bonus: 90 },
  sc_1200: { amount: 1200, bonus: 240 },
  sc_3000: { amount: 3000, bonus: 900 },
};

// ─── 도감 마일스톤 보상 ───
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
  SPECIES,
  SPECIES_COUNT,
  RARITY_BY_EGG,
  SPECIES_BY_RARITY,
  EGG_HATCH_TIME,
  EGG_PRICES,
  STAGE_DURATION_SECONDS,
  NEXT_STAGE,
  FEED_GROWTH_BOOST_SECONDS,
  FEED_MAX_PER_DAY,
  FEED_PEARL_REWARD,
  DAILY_LOGIN_REWARDS,
  PEARL_PACKAGES,
  STAR_CORAL_PACKAGES,
  COMPENDIUM_REWARDS,
  DECORATION_PRICES,
};
