/**
 * AquaWorld 서버 권위 로직 (Cloud Functions v2, asia-northeast3).
 *
 * 원칙: 재화·아이템·뽑기 결과를 바꾸는 모든 연산은 여기(서버)에서만 실행한다.
 * 클라이언트는 요청만 보내고, Firestore 직접 쓰기는 보안 규칙으로 차단된다.
 * Admin SDK 는 보안 규칙을 우회하므로 실제 쓰기는 이 함수들만 가능하다.
 */
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");

// 카카오 REST API 키 — `firebase functions:secrets:set KAKAO_REST_API_KEY` 로 주입.
// 에뮬레이터에서는 functions/.env.local 의 KAKAO_REST_API_KEY 값을 사용한다.
const kakaoRestKey = defineSecret("KAKAO_REST_API_KEY");
// 카카오 콘솔 → 보안 → Client Secret 활성화 시 필수.
// `firebase functions:secrets:set KAKAO_CLIENT_SECRET` 로 주입.
const kakaoClientSecret = defineSecret("KAKAO_CLIENT_SECRET");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

const G = require("./gameData");
const { applyGrowthAdvance } = require("./growth");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

function requireAuth(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  return uid;
}

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isNewDay(lastMs, nowMs) {
  const a = new Date(lastMs);
  const b = new Date(nowMs);
  return (
    a.getDate() !== b.getDate() ||
    a.getMonth() !== b.getMonth() ||
    a.getFullYear() !== b.getFullYear()
  );
}

function makeEgg(tier) {
  return {
    id: genId("egg"),
    tier,
    hatchDuration: G.EGG_HATCH_TIME[tier],
    startedAt: 0,
    isHatching: false,
  };
}

function makeTutorialEgg() {
  return {
    id: genId("egg"),
    tier: "basic",
    hatchDuration: 10,
    startedAt: 0,
    isHatching: false,
  };
}

/**
 * 부화 중이고 아직 푸시를 보내지 않은 알들 중 가장 빠른 완료 시각(ms)을 반환.
 * 없으면 0. 스케줄러가 `nextHatchAt <= now` 로 효율적으로 조회하기 위한 인덱스 필드.
 */
function computeNextHatchAt(user) {
  let next = 0;
  for (const e of user.inventory || []) {
    if (!e.isHatching || e.hatchNotified) continue;
    const readyAt = e.startedAt + e.hatchDuration * 1000;
    if (next === 0 || readyAt < next) next = readyAt;
  }
  return next;
}

function rollSpecies(tier) {
  const rarityPool = G.RARITY_BY_EGG[tier];
  const rarity = rarityPool[Math.floor(Math.random() * rarityPool.length)];
  const pool = G.SPECIES_BY_RARITY[rarity];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 보상 1건을 user 객체(가변 복사본)에 적용 */
function applyReward(user, reward) {
  if (reward.type === "pearl") user.pearl += reward.amount;
  else if (reward.type === "star_coral") user.starCoral += reward.amount;
  else if (reward.type === "egg") user.inventory = [...user.inventory, makeEgg(reward.tier)];
}

const userRef = (uid) => db.doc(`users/${uid}`);
const tankRef = (tankId) => db.doc(`tanks/${tankId}`);

/** tank 문서를 읽고 소유권을 검증. ownerId 는 Tank 타입에 없는 Firestore 전용 필드. */
async function readOwnedTank(tx, uid, tankId) {
  const snap = await tx.get(tankRef(tankId));
  if (!snap.exists) throw new HttpsError("not-found", "수조를 찾을 수 없습니다.");
  const data = snap.data();
  if (data.ownerId !== uid) throw new HttpsError("permission-denied", "본인 수조가 아닙니다.");
  return data;
}

/** tank 에서 ownerId 제거(클라 Tank 타입과 일치) */
function stripTank(tankWithOwner) {
  const { ownerId, ...tank } = tankWithOwner;
  void ownerId;
  return tank;
}

// ─── 신규 유저 부트스트랩 ────────────────────────────────────────────────────

exports.bootstrapUser = onCall(async (request) => {
  const uid = requireAuth(request);
  const uRef = userRef(uid);
  const existing = await uRef.get();
  if (existing.exists) {
    const data = existing.data();
    // 튜토리얼 알 미발급 계정에는 한 번 지급 (idempotent — 기존 유저 호환)
    if (!data.tutorialEggGranted) {
      data.inventory = [...(data.inventory || []), makeTutorialEgg()];
      data.tutorialEggGranted = true;
      await uRef.set(data);
    }
    return { user: data, created: false };
  }

  const now = Date.now();
  const auth = request.auth.token || {};
  const user = {
    id: uid,
    displayName: auth.name || "AquaWorld 유저",
    email: auth.email || "",
    pearl: G.START_PEARL,
    starCoral: G.START_STAR_CORAL,
    level: 1,
    experience: 0,
    loginStreak: 0,
    lastLoginAt: 0,
    createdAt: now,
    tanks: [],
    inventory: [makeTutorialEgg()],
    tutorialEggGranted: true,
    collectedSpecies: [],
    feedCountToday: 0,
    lastFeedResetAt: now,
    tutorialStep: 0,
  };
  if (auth.picture) user.photoURL = auth.picture;
  const tankId = `tank_${uid}`;
  const tank = {
    id: tankId,
    name: "나의 수조",
    environment: "coral_reef",
    fish: [],
    decorations: [],
    cleanliness: 100,
    lightMode: "auto",
    createdAt: now,
    updatedAt: now,
  };
  user.tanks = [tankId];

  const batch = db.batch();
  batch.set(uRef, user);
  batch.set(tankRef(tankId), { ...tank, ownerId: uid });
  await batch.commit();

  return { user, tank, created: true };
});

// ─── 일일 로그인 보상 ────────────────────────────────────────────────────────

exports.claimDailyReward = onCall(async (request) => {
  const uid = requireAuth(request);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef(uid));
    if (!snap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = snap.data();
    const now = Date.now();

    if (!isNewDay(user.lastLoginAt, now)) {
      return { user, reward: null };
    }
    const streak = (user.loginStreak % 7) + 1;
    const def = G.DAILY_LOGIN_REWARDS[streak - 1];
    applyReward(user, def);
    user.loginStreak = streak;
    user.lastLoginAt = now;

    tx.set(userRef(uid), user);
    return {
      user,
      reward: { type: def.type, amount: def.amount, tier: def.tier, day: streak },
    };
  });
});

// ─── 알 구매 ─────────────────────────────────────────────────────────────────

exports.purchaseEgg = onCall(async (request) => {
  const uid = requireAuth(request);
  const tier = request.data && request.data.tier;
  const def = G.EGG_PRICES[tier];
  if (!def) throw new HttpsError("invalid-argument", "잘못된 알 종류");

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef(uid));
    if (!snap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = snap.data();

    const field = def.currency === "pearl" ? "pearl" : "starCoral";
    if ((user[field] || 0) < def.price) {
      throw new HttpsError("failed-precondition", "재화가 부족합니다.");
    }
    user[field] -= def.price;
    user.inventory = [...user.inventory, makeEgg(tier)];

    tx.set(userRef(uid), user);
    return { user };
  });
});

// ─── 부화 시작 ───────────────────────────────────────────────────────────────

exports.startHatching = onCall(async (request) => {
  const uid = requireAuth(request);
  const eggId = request.data && request.data.eggId;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef(uid));
    if (!snap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = snap.data();
    const egg = user.inventory.find((e) => e.id === eggId);
    if (!egg) throw new HttpsError("not-found", "알을 찾을 수 없습니다.");
    if (egg.isHatching) return { user };

    user.inventory = user.inventory.map((e) =>
      e.id === eggId ? { ...e, startedAt: Date.now(), isHatching: true, hatchNotified: false } : e
    );
    user.nextHatchAt = computeNextHatchAt(user);
    tx.set(userRef(uid), user);
    return { user };
  });
});

// ─── 부화 수확 (RNG + 물고기 생성 + 도감 등록) ───────────────────────────────

exports.hatchEgg = onCall(async (request) => {
  const uid = requireAuth(request);
  const eggId = request.data && request.data.eggId;
  const tankId = request.data && request.data.tankId;
  if (!tankId) throw new HttpsError("invalid-argument", "수조 ID 필요");

  return db.runTransaction(async (tx) => {
    const uSnap = await tx.get(userRef(uid));
    if (!uSnap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = uSnap.data();
    const tankData = await readOwnedTank(tx, uid, tankId);

    const egg = user.inventory.find((e) => e.id === eggId);
    if (!egg || !egg.isHatching) throw new HttpsError("failed-precondition", "부화 중인 알이 아닙니다.");
    const elapsed = (Date.now() - egg.startedAt) / 1000;
    if (elapsed < egg.hatchDuration) throw new HttpsError("failed-precondition", "아직 부화 중입니다.");

    // ★ 종 추첨은 반드시 서버에서
    const speciesId = rollSpecies(egg.tier);
    const species = G.SPECIES[speciesId];
    const now = Date.now();
    const fish = {
      id: genId("fish"),
      speciesId,
      name: species ? species.name : "???",
      growthStage: "fry",
      growthProgress: 0,
      mood: "happy",
      feedCount: 0,
      lastFedAt: 0,
      acquiredAt: now,
      stageStartedAt: now,
      growthBoostSeconds: 0,
      position: {
        x: (Math.random() - 0.5) * 8,
        y: (Math.random() - 0.5) * 4,
        z: (Math.random() - 0.5) * 6,
      },
    };

    user.inventory = user.inventory.filter((e) => e.id !== eggId);
    user.nextHatchAt = computeNextHatchAt(user);
    if (!user.collectedSpecies.includes(speciesId)) {
      user.collectedSpecies = [...user.collectedSpecies, speciesId];
    }
    // 수조가 가득 차면 보관함으로, 아니면 수조에 바로 배치 (클라 TankPage.finalizeHatch 와 동일)
    const currentFish = tankData.fish || [];
    const full = currentFish.length >= G.getTankCapacity(tankData.capacityLevel);
    if (full) {
      user.fishInventory = [...(user.fishInventory || []), fish];
      tx.set(userRef(uid), user);
      return { user, tank: stripTank(tankData), speciesId, fish, storedInInventory: true };
    }

    const fishList = [...currentFish, fish];
    tx.set(userRef(uid), user);
    tx.set(tankRef(tankId), { ...tankData, fish: fishList, updatedAt: now });
    return { user, tank: stripTank({ ...tankData, fish: fishList, updatedAt: now }), speciesId, fish };
  });
});

// ─── 먹이 주기 (일일 제한 + 성장 가속 + 진주 보상) ──────────────────────────

exports.feedFish = onCall(async (request) => {
  const uid = requireAuth(request);
  const tankId = request.data && request.data.tankId;
  const fishId = request.data && request.data.fishId;
  if (!tankId || !fishId) throw new HttpsError("invalid-argument", "tankId/fishId 필요");

  return db.runTransaction(async (tx) => {
    const uSnap = await tx.get(userRef(uid));
    if (!uSnap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = uSnap.data();
    const tankData = await readOwnedTank(tx, uid, tankId);

    const target = (tankData.fish || []).find((f) => f.id === fishId);
    if (!target) throw new HttpsError("not-found", "물고기 없음");
    if (target.growthStage === "large") throw new HttpsError("failed-precondition", "이미 최대 성장");

    const now = Date.now();
    // 일일 먹이 제한
    const lastReset = user.lastFeedResetAt || 0;
    const newDay = isNewDay(lastReset, now);
    const count = newDay ? 0 : user.feedCountToday || 0;
    if (count >= G.FEED_MAX_PER_DAY) throw new HttpsError("failed-precondition", "오늘 먹이 소진");

    // 성장 가속 적용
    const boosted = {
      ...target,
      feedCount: (target.feedCount || 0) + 1,
      lastFedAt: now,
      mood: "happy",
      growthBoostSeconds: (target.growthBoostSeconds || 0) + G.FEED_GROWTH_BOOST_SECONDS,
    };
    const advanced = applyGrowthAdvance(boosted, now);
    const finalFish = advanced || boosted;
    const fishList = (tankData.fish || []).map((f) => (f.id === fishId ? finalFish : f));

    // 재화·카운트 갱신
    user.pearl = (user.pearl || 0) + G.FEED_PEARL_REWARD;
    user.feedCountToday = count + 1;
    user.lastFeedResetAt = newDay ? now : lastReset;

    tx.set(userRef(uid), user);
    tx.set(tankRef(tankId), { ...tankData, fish: fishList, updatedAt: now });
    return {
      user,
      tank: stripTank({ ...tankData, fish: fishList, updatedAt: now }),
      newStage: advanced ? advanced.growthStage : null,
    };
  });
});

// ─── 물고기 보관함 ↔ 수조 이동 / 수조 확장 ──────────────────────────────────
// tank.fish 는 서버 소유(보안 규칙으로 클라 쓰기 차단)이므로 이동/확장은 반드시 서버에서.

/** 수조 → 보관함 */
exports.storeFish = onCall(async (request) => {
  const uid = requireAuth(request);
  const tankId = request.data && request.data.tankId;
  const fishId = request.data && request.data.fishId;
  if (!tankId || !fishId) throw new HttpsError("invalid-argument", "tankId/fishId 필요");

  return db.runTransaction(async (tx) => {
    const uSnap = await tx.get(userRef(uid));
    if (!uSnap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = uSnap.data();
    const tankData = await readOwnedTank(tx, uid, tankId);

    const target = (tankData.fish || []).find((f) => f.id === fishId);
    if (!target) throw new HttpsError("not-found", "물고기 없음");

    const now = Date.now();
    const fishList = (tankData.fish || []).filter((f) => f.id !== fishId);
    user.fishInventory = [...(user.fishInventory || []), target];

    tx.set(userRef(uid), user);
    tx.set(tankRef(tankId), { ...tankData, fish: fishList, updatedAt: now });
    return { user, tank: stripTank({ ...tankData, fish: fishList, updatedAt: now }) };
  });
});

/** 보관함 → 수조 (상한 검증) */
exports.placeFish = onCall(async (request) => {
  const uid = requireAuth(request);
  const tankId = request.data && request.data.tankId;
  const fishId = request.data && request.data.fishId;
  if (!tankId || !fishId) throw new HttpsError("invalid-argument", "tankId/fishId 필요");

  return db.runTransaction(async (tx) => {
    const uSnap = await tx.get(userRef(uid));
    if (!uSnap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = uSnap.data();
    const tankData = await readOwnedTank(tx, uid, tankId);

    const target = (user.fishInventory || []).find((f) => f.id === fishId);
    if (!target) throw new HttpsError("not-found", "보관함에 물고기 없음");

    const currentFish = tankData.fish || [];
    if (currentFish.length >= G.getTankCapacity(tankData.capacityLevel)) {
      throw new HttpsError("failed-precondition", "수조가 가득 찼습니다.");
    }

    const now = Date.now();
    const placed = {
      ...target,
      position: {
        x: (Math.random() - 0.5) * 8,
        y: (Math.random() - 0.5) * 4,
        z: (Math.random() - 0.5) * 6,
      },
    };
    user.fishInventory = (user.fishInventory || []).filter((f) => f.id !== fishId);
    const fishList = [...currentFish, placed];

    tx.set(userRef(uid), user);
    tx.set(tankRef(tankId), { ...tankData, fish: fishList, updatedAt: now });
    return { user, tank: stripTank({ ...tankData, fish: fishList, updatedAt: now }) };
  });
});

/** 수조 확장 (Pearl 차감 + capacityLevel +1) */
exports.expandTankCapacity = onCall(async (request) => {
  const uid = requireAuth(request);
  const tankId = request.data && request.data.tankId;
  if (!tankId) throw new HttpsError("invalid-argument", "tankId 필요");

  return db.runTransaction(async (tx) => {
    const uSnap = await tx.get(userRef(uid));
    if (!uSnap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = uSnap.data();
    const tankData = await readOwnedTank(tx, uid, tankId);

    const lvl = tankData.capacityLevel || 0;
    if (lvl >= G.TANK_MAX_CAPACITY_LEVEL) {
      throw new HttpsError("failed-precondition", "이미 최대 크기입니다.");
    }
    const cost = G.TANK_EXPAND_COST_PEARL[lvl];
    if ((user.pearl || 0) < cost) {
      throw new HttpsError("failed-precondition", "Pearl이 부족합니다.");
    }

    const now = Date.now();
    user.pearl = (user.pearl || 0) - cost;
    const newTank = { ...tankData, capacityLevel: lvl + 1, updatedAt: now };

    tx.set(userRef(uid), user);
    tx.set(tankRef(tankId), newTank);
    return { user, tank: stripTank(newTank) };
  });
});

/** 수조 청소 (Pearl 차감 + 청결도 100) */
exports.cleanTank = onCall(async (request) => {
  const uid = requireAuth(request);
  const tankId = request.data && request.data.tankId;
  if (!tankId) throw new HttpsError("invalid-argument", "tankId 필요");

  return db.runTransaction(async (tx) => {
    const uSnap = await tx.get(userRef(uid));
    if (!uSnap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = uSnap.data();
    const tankData = await readOwnedTank(tx, uid, tankId);

    if ((tankData.cleanliness || 0) >= 95) {
      throw new HttpsError("failed-precondition", "이미 깨끗합니다.");
    }
    const cost = G.CLEAN_TANK_COST_PEARL;
    if ((user.pearl || 0) < cost) {
      throw new HttpsError("failed-precondition", "Pearl이 부족합니다.");
    }

    const now = Date.now();
    user.pearl = (user.pearl || 0) - cost;
    const newTank = { ...tankData, cleanliness: 100, lastCleanlinessTickAt: now, updatedAt: now };

    tx.set(userRef(uid), user);
    tx.set(tankRef(tankId), newTank);
    return { user, tank: stripTank(newTank) };
  });
});

/**
 * 데이터 정합성 보정 (idempotent). 과거 클라-only 이동 로직으로 생긴 손상 복구용:
 *  1) 수조 내 중복 물고기 id 제거
 *  2) 보관함에서 수조에 이미 있는 물고기 / 보관함 내 중복 제거
 *  3) 수조 상한 초과분을 보관함으로 이동
 * 변경이 있을 때만 기록한다. 로그인 시 1회 호출.
 */
exports.reconcileFish = onCall(async (request) => {
  const uid = requireAuth(request);
  const tankId = request.data && request.data.tankId;
  if (!tankId) throw new HttpsError("invalid-argument", "tankId 필요");

  return db.runTransaction(async (tx) => {
    const uSnap = await tx.get(userRef(uid));
    if (!uSnap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = uSnap.data();
    const tankData = await readOwnedTank(tx, uid, tankId);

    const origTank = tankData.fish || [];
    const origInv = user.fishInventory || [];

    // 1) 수조 내 중복 id 제거
    const seen = new Set();
    let tankFish = origTank.filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
    // 2) 보관함: 수조에 이미 있는 물고기 + 보관함 내 중복 제거
    const tankIds = new Set(tankFish.map((f) => f.id));
    const invSeen = new Set();
    let inventory = origInv.filter((f) => {
      if (tankIds.has(f.id) || invSeen.has(f.id)) return false;
      invSeen.add(f.id);
      return true;
    });
    // 3) 상한 초과분을 보관함으로 이동
    const cap = G.getTankCapacity(tankData.capacityLevel);
    if (tankFish.length > cap) {
      inventory = [...inventory, ...tankFish.slice(cap)];
      tankFish = tankFish.slice(0, cap);
    }

    const before = JSON.stringify([origTank.map((f) => f.id), origInv.map((f) => f.id)]);
    const after = JSON.stringify([tankFish.map((f) => f.id), inventory.map((f) => f.id)]);
    if (before === after) {
      return { user, tank: stripTank(tankData) };
    }

    const now = Date.now();
    user.fishInventory = inventory;
    tx.set(userRef(uid), user);
    tx.set(tankRef(tankId), { ...tankData, fish: tankFish, updatedAt: now });
    return { user, tank: stripTank({ ...tankData, fish: tankFish, updatedAt: now }) };
  });
});

// ─── 먹이 뿌리기 (특정 물고기 없이 일일 제한 + 진주 보상만) ──────────────────

exports.sprinkleFeed = onCall(async (request) => {
  const uid = requireAuth(request);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef(uid));
    if (!snap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = snap.data();
    const now = Date.now();
    const lastReset = user.lastFeedResetAt || 0;
    const newDay = isNewDay(lastReset, now);
    const count = newDay ? 0 : user.feedCountToday || 0;
    if (count >= G.FEED_MAX_PER_DAY) throw new HttpsError("failed-precondition", "오늘 먹이 소진");

    user.pearl = (user.pearl || 0) + G.FEED_PEARL_REWARD;
    user.feedCountToday = count + 1;
    user.lastFeedResetAt = newDay ? now : lastReset;
    tx.set(userRef(uid), user);
    return { user };
  });
});

// ─── Star Coral → Pearl 환전 ────────────────────────────────────────────────

exports.exchangePearl = onCall(async (request) => {
  const uid = requireAuth(request);
  const pkgId = request.data && request.data.pkgId;
  const pkg = G.PEARL_PACKAGES[pkgId];
  if (!pkg) throw new HttpsError("invalid-argument", "잘못된 패키지");

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef(uid));
    if (!snap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = snap.data();
    if ((user.starCoral || 0) < pkg.starCoral) {
      throw new HttpsError("failed-precondition", "Star Coral 부족");
    }
    user.starCoral -= pkg.starCoral;
    user.pearl = (user.pearl || 0) + pkg.pearl + pkg.bonus;
    tx.set(userRef(uid), user);
    return { user };
  });
});

// ─── Star Coral 구매 (KRW) ──────────────────────────────────────────────────
// ⚠️ 현재는 실제 결제 검증이 없음(기존 동작 유지). 실서비스 시 IAP 영수증 검증 필요.

exports.purchaseStarCoral = onCall(async (request) => {
  const uid = requireAuth(request);
  const pkgId = request.data && request.data.pkgId;
  const pkg = G.STAR_CORAL_PACKAGES[pkgId];
  if (!pkg) throw new HttpsError("invalid-argument", "잘못된 패키지");

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef(uid));
    if (!snap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = snap.data();
    user.starCoral = (user.starCoral || 0) + pkg.amount + pkg.bonus;
    tx.set(userRef(uid), user);
    return { user };
  });
});

// ─── 데코 구매 (진주 차감만 서버 검증; 인벤토리 소비/배치는 Phase 2) ────────

exports.purchaseDecoration = onCall(async (request) => {
  const uid = requireAuth(request);
  const modelId = request.data && request.data.modelId;
  const price = G.DECORATION_PRICES[modelId];
  if (price == null) throw new HttpsError("invalid-argument", "잘못된 데코");

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef(uid));
    if (!snap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = snap.data();
    if ((user.pearl || 0) < price) throw new HttpsError("failed-precondition", "Pearl 부족");
    user.pearl -= price;
    const inv = { ...(user.decorationInventory || {}) };
    inv[modelId] = (inv[modelId] || 0) + 1;
    user.decorationInventory = inv;
    tx.set(userRef(uid), user);
    return { user };
  });
});

// ─── 도감 마일스톤 청구 ──────────────────────────────────────────────────────

exports.claimMilestone = onCall(async (request) => {
  const uid = requireAuth(request);
  const pct = request.data && request.data.pct;
  const reward = G.COMPENDIUM_REWARDS[pct];
  if (!reward) throw new HttpsError("invalid-argument", "잘못된 마일스톤");

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef(uid));
    if (!snap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = snap.data();
    const claimed = user.claimedCompendiumMilestones || [];
    if (claimed.includes(pct)) throw new HttpsError("failed-precondition", "이미 청구함");

    // ★ 진행도를 서버 데이터로 재계산
    const actualPct = Math.floor(((user.collectedSpecies || []).length / G.SPECIES_COUNT) * 100);
    if (actualPct < pct) throw new HttpsError("failed-precondition", "조건 미달");

    applyReward(user, reward);
    user.claimedCompendiumMilestones = [...claimed, pct];
    tx.set(userRef(uid), user);
    return { user, reward };
  });
});

// ─── 카카오 로그인 (authorization code → Firebase Custom Token) ────────────
// Firebase Auth 는 카카오를 기본 제공자로 지원하지 않으므로,
// 1) 클라가 Kakao.Auth.authorize() 리다이렉트로 받은 `code` 를 보내면
// 2) 서버가 https://kauth.kakao.com/oauth/token 으로 access_token 을 교환하고
// 3) /v2/user/me 로 프로필을 조회한 뒤 uid = `kakao:${kakaoId}` 로 Auth 유저를 upsert
// 4) Custom Token 을 발급해서 돌려준다. 클라는 signInWithCustomToken 으로 진입.

exports.kakaoSignIn = onCall(
  { secrets: [kakaoRestKey, kakaoClientSecret] },
  async (request) => {
  const code = request.data && request.data.code;
  const redirectUri = request.data && request.data.redirectUri;
  if (!code || typeof code !== "string") {
    throw new HttpsError("invalid-argument", "code 필요");
  }
  if (!redirectUri || typeof redirectUri !== "string") {
    throw new HttpsError("invalid-argument", "redirectUri 필요");
  }
  const restKey = kakaoRestKey.value();
  if (!restKey) {
    throw new HttpsError(
      "failed-precondition",
      "KAKAO_REST_API_KEY 시크릿이 설정되지 않았습니다.",
    );
  }
  // client_secret 은 카카오 콘솔 설정에 따라 선택. 미설정이면 빈 문자열.
  const clientSecret = kakaoClientSecret.value();

  // 1. authorization code → access_token 교환
  let accessToken;
  try {
    const tokenParams = {
      grant_type: "authorization_code",
      client_id: restKey,
      redirect_uri: redirectUri,
      code,
    };
    if (clientSecret) tokenParams.client_secret = clientSecret;
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tokenParams).toString(),
    });
    const tokenBody = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new HttpsError(
        "unauthenticated",
        `카카오 토큰 교환 실패: ${tokenBody.error_description || tokenBody.error || tokenRes.status}`,
      );
    }
    accessToken = tokenBody.access_token;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", `카카오 토큰 교환 호출 실패: ${err.message || err}`);
  }

  // 2. 카카오 프로필 조회
  let profile;
  try {
    const res = await fetch("https://kapi.kakao.com/v2/user/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new HttpsError("unauthenticated", `카카오 프로필 조회 실패 (HTTP ${res.status})`);
    }
    profile = await res.json();
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", `카카오 API 호출 실패: ${err.message || err}`);
  }

  const kakaoId = profile && profile.id;
  if (!kakaoId) {
    throw new HttpsError("unauthenticated", "카카오 프로필을 가져올 수 없습니다.");
  }

  const uid = `kakao:${kakaoId}`;
  const kakaoAccount = profile.kakao_account || {};
  const profileInfo = kakaoAccount.profile || {};
  const displayName = profileInfo.nickname || "카카오 유저";
  const photoURL = profileInfo.profile_image_url || undefined;
  // 이메일은 카카오 사업자 검수 후에만 받을 수 있어 없을 수 있음
  const email = kakaoAccount.email || undefined;

  // 3. Firebase Auth 사용자 upsert (StrictMode/연타 동시 호출 시 createUser 가 경쟁할 수 있어 보호)
  const updateFields = { displayName };
  if (photoURL) updateFields.photoURL = photoURL;
  if (email) updateFields.email = email;
  try {
    await admin.auth().updateUser(uid, updateFields);
  } catch (err) {
    if (err && err.code === "auth/user-not-found") {
      try {
        await admin.auth().createUser({ uid, ...updateFields });
      } catch (err2) {
        if (err2 && err2.code === "auth/uid-already-exists") {
          // 다른 인스턴스가 직전에 생성 — 단순히 update 로 다시 진행
          await admin.auth().updateUser(uid, updateFields);
        } else {
          throw err2;
        }
      }
    } else {
      throw err;
    }
  }

  // 4. Custom Token 발급 (bootstrapUser 가 token.name / token.picture 를 읽으므로 클레임으로 동봉)
  const claims = { provider: "kakao", name: displayName };
  if (photoURL) claims.picture = photoURL;
  if (email) claims.email = email;
  const customToken = await admin.auth().createCustomToken(uid, claims);

  return { customToken, uid };
});

// ─── 회원 탈퇴 (계정 영구 삭제) ──────────────────────────────────────────────
// users/{uid} 문서 + ownerId==uid 인 모든 tanks 문서 + Auth 계정 자체를 삭제.
// 처리방침 제7조에 따라 30일 이내 영구 삭제 의무를 즉시 이행한다.

exports.deleteAccount = onCall(async (request) => {
  const uid = requireAuth(request);

  // 1. 소유 tanks 일괄 삭제 (개수가 적으므로 단일 batch 로 충분)
  const tanksSnap = await db.collection("tanks").where("ownerId", "==", uid).get();
  if (!tanksSnap.empty) {
    const batch = db.batch();
    tanksSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // 2. user 문서 삭제
  await userRef(uid).delete();

  // 3. Firebase Auth 계정 삭제 (이후 클라이언트의 모든 ID 토큰 무효화)
  try {
    await admin.auth().deleteUser(uid);
  } catch (err) {
    // Auth 계정이 이미 없는 경우(이중 호출 등)는 성공으로 간주
    if (err && err.code !== "auth/user-not-found") throw err;
  }

  return { ok: true };
});

// ─── 웹 푸시(FCM) 토큰 등록 / 해제 ───────────────────────────────────────────

exports.registerPushToken = onCall(async (request) => {
  const uid = requireAuth(request);
  const token = request.data && request.data.token;
  if (!token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "토큰 필요");
  }
  await userRef(uid).set({ fcmTokens: FieldValue.arrayUnion(token) }, { merge: true });
  return { ok: true };
});

exports.unregisterPushToken = onCall(async (request) => {
  const uid = requireAuth(request);
  const token = request.data && request.data.token;
  if (!token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "토큰 필요");
  }
  await userRef(uid).set({ fcmTokens: FieldValue.arrayRemove(token) }, { merge: true });
  return { ok: true };
});

// ─── 부화 완료 백그라운드 푸시 (1분 주기 스케줄) ─────────────────────────────
// ⚠️ Cloud Scheduler 사용 — Blaze(종량제) 요금제 + `firebase deploy` 필요.

exports.notifyReadyHatches = onSchedule("every 1 minutes", async () => {
  const now = Date.now();
  const snap = await db
    .collection("users")
    .where("nextHatchAt", ">", 0)
    .where("nextHatchAt", "<=", now)
    .limit(200)
    .get();

  for (const docSnap of snap.docs) {
    const user = docSnap.data();
    const ready = (user.inventory || []).filter(
      (e) => e.isHatching && !e.hatchNotified && e.startedAt + e.hatchDuration * 1000 <= now,
    );
    if (ready.length === 0) {
      // nextHatchAt 이 부정확했던 경우 재정렬만 하고 넘어감
      await docSnap.ref.set({ nextHatchAt: computeNextHatchAt(user) }, { merge: true });
      continue;
    }

    const tokens = (user.fcmTokens || []).filter(Boolean);
    if (tokens.length > 0) {
      const title = ready.length > 1 ? `🐣 알 ${ready.length}개 부화 완료!` : "🐣 부화 완료!";
      const body = "수조로 돌아와 새 친구를 만나보세요";
      const res = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: { type: "hatch", emoji: "🐣", tag: "hatch" },
        webpush: { fcmOptions: { link: "/" } },
      });
      // 무효 토큰 정리
      const invalid = [];
      res.responses.forEach((r, i) => {
        if (!r.success) invalid.push(tokens[i]);
      });
      if (invalid.length > 0) {
        await docSnap.ref.set(
          { fcmTokens: FieldValue.arrayRemove(...invalid) },
          { merge: true },
        );
      }
    }

    // 발송 여부와 무관하게 알림 처리 표시 (재발송 방지)
    const readyIds = new Set(ready.map((e) => e.id));
    user.inventory = (user.inventory || []).map((e) =>
      readyIds.has(e.id) ? { ...e, hatchNotified: true } : e,
    );
    user.nextHatchAt = computeNextHatchAt(user);
    await docSnap.ref.set(
      { inventory: user.inventory, nextHatchAt: user.nextHatchAt },
      { merge: true },
    );
  }
});

// ─── 보상형 광고 (AdMob Rewarded) ───────────────────────────────────────────
// 흐름:
//   1) 클라가 prepareAdReward 호출 → 서버가 1회용 nonce 발급(타입+payload 동봉)
//   2) 클라가 nonce 를 AdMob.showRewardVideoAd 의 customData 로 실어 광고 시청
//   3a) (정식) AdMob SSV → admobSSV 엔드포인트가 서명 검증 후 보상 지급
//   3b) (폴백) 클라 onReward 이벤트 → claimAdReward Callable 로 nonce 소비
// 안전 장치:
//   - nonce 는 users/{uid}/adNonces/{nonceId} 에 저장, used 플래그로 1회만 사용
//   - 일일 한도 (HATCH_BOOST 10회 / DAILY_DOUBLE 1회) — 어뷰징 차단
//   - SSV 와 Callable 양쪽 모두 같은 applyAdRewardTx 로 수렴

const AD_REWARD_LIMITS = { hatch_boost: 10, daily_double: 1 };
const HATCH_BOOST_SECONDS = 300;
const AD_NONCE_TTL_MS = 15 * 60 * 1000;

function adNonceRef(uid, nonceId) {
  return db.doc(`users/${uid}/adNonces/${nonceId}`);
}

function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}`;
}

/** 광고 보상 1건을 실제로 user/관련 알에 적용. tx 내에서 호출. */
async function applyAdRewardTx(tx, uid, nonce) {
  const uSnap = await tx.get(userRef(uid));
  if (!uSnap.exists) throw new HttpsError("not-found", "유저 없음");
  const user = uSnap.data();

  if (nonce.type === "hatch_boost") {
    const eggId = nonce.payload && nonce.payload.eggId;
    const inv = user.inventory || [];
    const egg = inv.find((e) => e.id === eggId);
    if (!egg) throw new HttpsError("not-found", "알을 찾을 수 없습니다.");
    if (!egg.isHatching) throw new HttpsError("failed-precondition", "부화 중이 아닙니다.");
    const newDuration = Math.max(1, (egg.hatchDuration || 0) - HATCH_BOOST_SECONDS);
    user.inventory = inv.map((e) => (e.id === eggId ? { ...e, hatchDuration: newDuration } : e));
    user.nextHatchAt = computeNextHatchAt(user);
    tx.set(userRef(uid), user);
    return { user, applied: { type: "hatch_boost", eggId, boostSeconds: HATCH_BOOST_SECONDS } };
  }

  if (nonce.type === "daily_double") {
    // payload 의 보상 정의를 그대로 한 번 더 적용 (claimDailyReward 가 발급 직후 호출되는 시나리오)
    const def = nonce.payload && nonce.payload.reward;
    if (!def || !def.type) throw new HttpsError("failed-precondition", "보상 정보 없음");
    applyReward(user, def);
    tx.set(userRef(uid), user);
    return { user, applied: { type: "daily_double", reward: def } };
  }

  throw new HttpsError("invalid-argument", "알 수 없는 보상 타입");
}

exports.prepareAdReward = onCall(async (request) => {
  const uid = requireAuth(request);
  const type = request.data && request.data.type;
  const payload = (request.data && request.data.payload) || {};
  const limit = AD_REWARD_LIMITS[type];
  if (!limit) throw new HttpsError("invalid-argument", "잘못된 보상 타입");

  const now = Date.now();
  const today = dayKey(now);

  return db.runTransaction(async (tx) => {
    // 일일 한도 검증 — users/{uid}.adWatchCounters[type][YYYYMMDD] 카운터
    const uSnap = await tx.get(userRef(uid));
    if (!uSnap.exists) throw new HttpsError("not-found", "유저 없음");
    const user = uSnap.data();
    const counters = user.adWatchCounters || {};
    const used = ((counters[type] || {})[today] || 0);
    if (used >= limit) throw new HttpsError("failed-precondition", "오늘 한도를 다 썼습니다.");

    // hatch_boost 는 발급 시점에 알 존재 검증 (UX — 광고 본 뒤 실패하면 짜증)
    if (type === "hatch_boost") {
      const egg = (user.inventory || []).find((e) => e.id === payload.eggId);
      if (!egg) throw new HttpsError("not-found", "알을 찾을 수 없습니다.");
      if (!egg.isHatching) throw new HttpsError("failed-precondition", "부화 중이 아닙니다.");
    }

    const nonceId = genId("ad");
    const nonce = {
      type,
      payload,
      used: false,
      createdAt: now,
      expiresAt: now + AD_NONCE_TTL_MS,
    };
    tx.set(adNonceRef(uid, nonceId), nonce);
    return { nonceId, ttlMs: AD_NONCE_TTL_MS };
  });
});

exports.claimAdReward = onCall(async (request) => {
  const uid = requireAuth(request);
  const nonceId = request.data && request.data.nonceId;
  if (!nonceId) throw new HttpsError("invalid-argument", "nonceId 필요");

  return db.runTransaction(async (tx) => {
    const nRef = adNonceRef(uid, nonceId);
    const nSnap = await tx.get(nRef);
    if (!nSnap.exists) throw new HttpsError("not-found", "nonce 없음");
    const nonce = nSnap.data();
    if (nonce.used) throw new HttpsError("failed-precondition", "이미 사용된 nonce");
    if (Date.now() > (nonce.expiresAt || 0)) {
      throw new HttpsError("failed-precondition", "nonce 만료");
    }

    const { user, applied } = await applyAdRewardTx(tx, uid, nonce);

    // nonce 소비 + 일일 카운터 증가
    const today = dayKey(Date.now());
    const counters = user.adWatchCounters || {};
    const typeCounters = counters[nonce.type] || {};
    typeCounters[today] = (typeCounters[today] || 0) + 1;
    counters[nonce.type] = typeCounters;
    user.adWatchCounters = counters;
    tx.set(userRef(uid), user);
    tx.set(nRef, { ...nonce, used: true, usedAt: Date.now() });
    return { user, applied };
  });
});

// AdMob SSV — Google 의 검증 서버가 GET 으로 호출하는 HTTP 엔드포인트.
// 콘솔에서 콜백 URL 로 `https://<region>-<project>.cloudfunctions.net/admobSSV` 등록.
// 서명 검증 후 nonce 를 소비 → applyAdRewardTx 로 보상 지급.
const AD_VERIFIER_KEYS_URL = "https://gstatic.com/admob/reward/verifier-keys.json";
let verifierKeysCache = { keys: null, fetchedAt: 0 };
async function loadVerifierKeys() {
  const now = Date.now();
  if (verifierKeysCache.keys && now - verifierKeysCache.fetchedAt < 60 * 60 * 1000) {
    return verifierKeysCache.keys;
  }
  const res = await fetch(AD_VERIFIER_KEYS_URL);
  if (!res.ok) throw new Error(`verifier keys fetch failed: ${res.status}`);
  const body = await res.json();
  verifierKeysCache = { keys: body.keys || [], fetchedAt: now };
  return verifierKeysCache.keys;
}

function verifyAdMobSignature(rawQuery, signature, keyId) {
  // AdMob 사양: 쿼리스트링에서 `signature` 와 `key_id` 두 파라미터를 빼고 남은
  // 원본 부분("?" 뒤, "&signature=" 이전)에 대해 ECDSA-SHA256 으로 서명.
  // 같은 입력을 그대로 재구성하기 위해 쿼리 문자열 위치를 보존해야 한다.
  const sigMarker = "&signature=";
  const idx = rawQuery.indexOf(sigMarker);
  if (idx < 0) return false;
  const message = rawQuery.slice(0, idx);
  return loadVerifierKeys().then((keys) => {
    const key = keys.find((k) => String(k.keyId) === String(keyId));
    if (!key || !key.pem) return false;
    const crypto = require("crypto");
    const verify = crypto.createVerify("SHA256");
    verify.update(message);
    verify.end();
    // signature 는 web-safe base64. 표준 base64 로 변환.
    const sigB64 = signature.replace(/-/g, "+").replace(/_/g, "/");
    return verify.verify(key.pem, Buffer.from(sigB64, "base64"));
  });
}

exports.admobSSV = onRequest({ region: "asia-northeast3" }, async (req, res) => {
  try {
    const rawQuery = req.url.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "";
    const q = req.query || {};
    const signature = q.signature;
    const keyId = q.key_id;
    const uid = q.user_id;
    const nonceId = q.custom_data;
    const txnId = q.transaction_id;

    if (!signature || !keyId || !uid || !nonceId || !txnId) {
      // AdMob 콘솔 등록 검증 ping (빈 GET) 은 200 으로 받아줘야 등록이 통과된다.
      // 실제 보상 처리는 서명·nonce 검증을 모두 통과해야만 진행되므로 200 응답 자체는 안전.
      res.status(200).send("ok");
      return;
    }

    const valid = await verifyAdMobSignature(rawQuery, signature, keyId);
    if (!valid) {
      res.status(403).send("invalid signature");
      return;
    }

    // 보상 적용은 Callable 폴백과 동일한 1회용 nonce 경로로 수렴
    await db.runTransaction(async (tx) => {
      const nRef = adNonceRef(uid, nonceId);
      const nSnap = await tx.get(nRef);
      if (!nSnap.exists) return; // 이미 폴백이 소비했거나 위조
      const nonce = nSnap.data();
      if (nonce.used) return;
      if (Date.now() > (nonce.expiresAt || 0)) return;
      if (nonce.transactionId && nonce.transactionId !== txnId) return; // 재발사 차단

      const { user } = await applyAdRewardTx(tx, uid, nonce);
      const today = dayKey(Date.now());
      const counters = user.adWatchCounters || {};
      const typeCounters = counters[nonce.type] || {};
      typeCounters[today] = (typeCounters[today] || 0) + 1;
      counters[nonce.type] = typeCounters;
      user.adWatchCounters = counters;
      tx.set(userRef(uid), user);
      tx.set(nRef, { ...nonce, used: true, usedAt: Date.now(), transactionId: txnId, viaSSV: true });
    });

    res.status(200).send("ok");
  } catch (err) {
    console.error("admobSSV error", err);
    res.status(500).send("error");
  }
});
