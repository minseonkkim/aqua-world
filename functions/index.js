/**
 * AquaWorld 서버 권위 로직 (Cloud Functions v2, asia-northeast3).
 *
 * 원칙: 재화·아이템·뽑기 결과를 바꾸는 모든 연산은 여기(서버)에서만 실행한다.
 * 클라이언트는 요청만 보내고, Firestore 직접 쓰기는 보안 규칙으로 차단된다.
 * Admin SDK 는 보안 규칙을 우회하므로 실제 쓰기는 이 함수들만 가능하다.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
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
    const fishList = [...(tankData.fish || []), fish];

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
