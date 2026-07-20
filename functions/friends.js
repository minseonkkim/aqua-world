/**
 * 친구 시스템 서버 권위 로직 (V1.1 — 로드맵 5-1).
 *
 * 설계 원칙
 * - 친구 데이터는 전부 이 함수들을 통해서만 읽고 쓴다. 보안 규칙은 users/{uid} 문서
 *   "본인 읽기" 만 허용하므로, 클라는 남의 프로필·수조를 직접 못 읽는다. 규칙을 푸는 대신
 *   서버가 필요한 필드만 정제(sanitize)해 돌려주는 방식을 택했다 — 이 코드베이스의
 *   기존 패턴(모든 쓰기 = 콜러블)과 일치하고, 규칙 레벨 lookup 비용도 없다.
 * - 친구 관계는 양쪽 문서에 대칭으로 쓴다(users/{a}/friends/{b} + users/{b}/friends/{a}).
 *   조회가 압도적으로 잦고 쓰기는 드문 관계라, 읽기 한 번에 끝나는 비정규화가 맞다.
 *
 * Firestore 구조
 *   users/{uid}                        friendCode, invitedBy, inviteRewardGranted, visitCounter
 *   users/{uid}/friends/{friendUid}     { uid, since }
 *   users/{uid}/requestsIn/{fromUid}    { uid, at }   받은 친구 요청
 *   users/{uid}/requestsOut/{toUid}     { uid, at }   보낸 친구 요청
 *   users/{uid}/visits/{visitorUid}     { uid, type, at }  내 수조에 남겨진 방문 흔적
 *   friendCodes/{CODE}                  { uid }       코드 → uid 유일성 인덱스
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const G = require("./gameData");
const { applyGrowthAdvance } = require("./growth");
const {
  db,
  requireAuth,
  dayKeyKst,
  makeEgg,
  userRef,
  tankRef,
} = require("./shared");

const friendsCol = (uid) => userRef(uid).collection("friends");
const requestsInCol = (uid) => userRef(uid).collection("requestsIn");
const requestsOutCol = (uid) => userRef(uid).collection("requestsOut");
const visitsCol = (uid) => userRef(uid).collection("visits");
const codeRef = (code) => db.doc(`friendCodes/${code}`);

// ─── 친구 코드 ──────────────────────────────────────────────────────────────

function randomCode() {
  const A = G.FRIEND_CODE_ALPHABET;
  let out = "";
  for (let i = 0; i < G.FRIEND_CODE_LENGTH; i++) {
    out += A[Math.floor(Math.random() * A.length)];
  }
  return out;
}

/**
 * 입력 정규화 — 사용자는 "aq-7f3k2m", "7F3K 2M" 처럼 제각각 입력한다.
 * 대문자화 + 알파벳 외 문자 제거로 한 형태에 모은다.
 */
function normalizeCode(raw) {
  if (typeof raw !== "string") return "";
  const upper = raw.toUpperCase();
  let out = "";
  for (const ch of upper) {
    if (G.FRIEND_CODE_ALPHABET.includes(ch)) out += ch;
  }
  return out;
}

/**
 * uid 의 친구 코드를 반환. 없으면 새로 발급한다.
 * friendCodes/{code} 문서를 create 로만 만들어(이미 있으면 실패) 충돌을 감지하고 재시도한다.
 */
async function ensureCode(uid) {
  const snap = await userRef(uid).get();
  if (!snap.exists) throw new HttpsError("not-found", "유저 없음");
  const existing = snap.data().friendCode;
  if (existing) return existing;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    try {
      await codeRef(code).create({ uid, createdAt: Date.now() });
      await userRef(uid).set({ friendCode: code }, { merge: true });
      return code;
    } catch (err) {
      // ALREADY_EXISTS = 코드 충돌. 다른 코드로 재시도한다.
      if (err && err.code === 6) continue;
      throw err;
    }
  }
  logger.error("ensureCode: 코드 발급 실패 (충돌 반복)", { uid });
  throw new HttpsError("internal", "친구 코드를 만들지 못했습니다. 잠시 후 다시 시도해주세요.");
}

/** 남에게 보여줘도 되는 필드만 추린 공개 프로필. */
function publicProfile(uid, data) {
  return {
    uid,
    displayName: data.displayName || "AquaWorld 유저",
    photoURL: data.photoURL || null,
    level: data.level || 1,
    lastActiveAt: data.lastActiveAt || 0,
    collectedCount: (data.collectedSpecies || []).length,
    friendCode: data.friendCode || null,
  };
}

exports.getMyFriendCode = onCall(async (request) => {
  const uid = requireAuth(request);
  const code = await ensureCode(uid);
  return { code, serverTime: Date.now() };
});

// ─── 친구 검색 / 요청 ────────────────────────────────────────────────────────

exports.findUserByFriendCode = onCall(async (request) => {
  const uid = requireAuth(request);
  const code = normalizeCode(request.data && request.data.code);
  if (code.length !== G.FRIEND_CODE_LENGTH) {
    throw new HttpsError("invalid-argument", "친구 코드는 6자리입니다.");
  }

  const cSnap = await codeRef(code).get();
  if (!cSnap.exists) throw new HttpsError("not-found", "해당 코드의 유저가 없습니다.");
  const targetUid = cSnap.data().uid;
  if (targetUid === uid) throw new HttpsError("failed-precondition", "본인 코드입니다.");

  const tSnap = await userRef(targetUid).get();
  if (!tSnap.exists) throw new HttpsError("not-found", "해당 코드의 유저가 없습니다.");

  // 이미 친구인지 / 요청을 보냈는지도 함께 알려줘야 UI가 버튼 상태를 정할 수 있다.
  const [friendSnap, outSnap, inSnap] = await Promise.all([
    friendsCol(uid).doc(targetUid).get(),
    requestsOutCol(uid).doc(targetUid).get(),
    requestsInCol(uid).doc(targetUid).get(),
  ]);

  return {
    profile: publicProfile(targetUid, tSnap.data()),
    relation: friendSnap.exists
      ? "friend"
      : outSnap.exists
        ? "requested"
        : inSnap.exists
          ? "incoming"
          : "none",
    serverTime: Date.now(),
  };
});

exports.sendFriendRequest = onCall(async (request) => {
  const uid = requireAuth(request);
  const code = normalizeCode(request.data && request.data.code);
  if (code.length !== G.FRIEND_CODE_LENGTH) {
    throw new HttpsError("invalid-argument", "친구 코드는 6자리입니다.");
  }

  const cSnap = await codeRef(code).get();
  if (!cSnap.exists) throw new HttpsError("not-found", "해당 코드의 유저가 없습니다.");
  const targetUid = cSnap.data().uid;
  if (targetUid === uid) throw new HttpsError("failed-precondition", "본인에게는 요청할 수 없습니다.");

  const now = Date.now();

  // 상대가 이미 나에게 요청을 보내둔 상태라면, 요청을 또 쌓지 않고 바로 친구가 된다.
  // (양쪽이 동시에 코드를 교환한 흔한 상황 — 여기서 걸러야 요청함에 유령이 남지 않는다.)
  const pendingIn = await requestsInCol(uid).doc(targetUid).get();
  if (pendingIn.exists) {
    await linkFriends(uid, targetUid, now);
    return { status: "friend", serverTime: now };
  }

  const alreadyFriend = await friendsCol(uid).doc(targetUid).get();
  if (alreadyFriend.exists) return { status: "friend", serverTime: now };

  await assertFriendCapacity(uid);
  await assertFriendCapacity(targetUid);

  const batch = db.batch();
  batch.set(requestsOutCol(uid).doc(targetUid), { uid: targetUid, at: now });
  batch.set(requestsInCol(targetUid).doc(uid), { uid, at: now });
  await batch.commit();

  return { status: "requested", serverTime: now };
});

/** 친구 수 상한 검사 — 목록 조회 비용이 친구 수에 비례하므로 양쪽 모두 확인한다. */
async function assertFriendCapacity(uid) {
  const count = (await friendsCol(uid).count().get()).data().count;
  if (count >= G.FRIEND_MAX) {
    throw new HttpsError("resource-exhausted", `친구는 최대 ${G.FRIEND_MAX}명까지 추가할 수 있습니다.`);
  }
}

/** 양쪽 문서에 대칭으로 친구 관계를 쓰고, 남아있는 요청 문서를 정리한다. */
async function linkFriends(a, b, now) {
  const batch = db.batch();
  batch.set(friendsCol(a).doc(b), { uid: b, since: now });
  batch.set(friendsCol(b).doc(a), { uid: a, since: now });
  batch.delete(requestsInCol(a).doc(b));
  batch.delete(requestsInCol(b).doc(a));
  batch.delete(requestsOutCol(a).doc(b));
  batch.delete(requestsOutCol(b).doc(a));
  await batch.commit();
}

exports.respondFriendRequest = onCall(async (request) => {
  const uid = requireAuth(request);
  const fromUid = request.data && request.data.fromUid;
  const accept = !!(request.data && request.data.accept);
  if (!fromUid || typeof fromUid !== "string") {
    throw new HttpsError("invalid-argument", "fromUid 필요");
  }

  const pending = await requestsInCol(uid).doc(fromUid).get();
  if (!pending.exists) throw new HttpsError("not-found", "요청이 없습니다.");

  const now = Date.now();
  if (!accept) {
    const batch = db.batch();
    batch.delete(requestsInCol(uid).doc(fromUid));
    batch.delete(requestsOutCol(fromUid).doc(uid));
    await batch.commit();
    return { status: "declined", serverTime: now };
  }

  await assertFriendCapacity(uid);
  await assertFriendCapacity(fromUid);
  await linkFriends(uid, fromUid, now);
  return { status: "friend", serverTime: now };
});

exports.removeFriend = onCall(async (request) => {
  const uid = requireAuth(request);
  const friendUid = request.data && request.data.friendUid;
  if (!friendUid || typeof friendUid !== "string") {
    throw new HttpsError("invalid-argument", "friendUid 필요");
  }

  const batch = db.batch();
  batch.delete(friendsCol(uid).doc(friendUid));
  batch.delete(friendsCol(friendUid).doc(uid));
  // 남겨둔 방문 흔적도 함께 지운다 — 친구가 아닌 사람의 흔적이 목록에 남으면 혼란스럽다.
  batch.delete(visitsCol(uid).doc(friendUid));
  batch.delete(visitsCol(friendUid).doc(uid));
  await batch.commit();

  return { status: "removed", serverTime: Date.now() };
});

// ─── 친구 목록 ──────────────────────────────────────────────────────────────

/** uid 목록 → 공개 프로필 목록. getAll 로 한 번에 읽어 N+1 을 피한다. */
async function loadProfiles(uids) {
  if (uids.length === 0) return [];
  const snaps = await db.getAll(...uids.map((u) => userRef(u)));
  const out = [];
  for (const snap of snaps) {
    if (snap.exists) out.push(publicProfile(snap.id, snap.data()));
  }
  return out;
}

exports.listFriends = onCall(async (request) => {
  const uid = requireAuth(request);

  const [friendDocs, inDocs, outDocs, visitDocs] = await Promise.all([
    friendsCol(uid).get(),
    requestsInCol(uid).get(),
    requestsOutCol(uid).get(),
    visitsCol(uid).orderBy("at", "desc").limit(20).get(),
  ]);

  const friendIds = friendDocs.docs.map((d) => d.id);
  const inIds = inDocs.docs.map((d) => d.id);
  const outIds = outDocs.docs.map((d) => d.id);
  // 세 목록은 겹치지 않지만 프로필 조회는 한 번으로 합친다(중복 uid 는 getAll 이 싫어한다).
  const allIds = [...new Set([...friendIds, ...inIds, ...outIds])];
  const profiles = await loadProfiles(allIds);
  const byId = new Map(profiles.map((p) => [p.uid, p]));

  const sinceById = new Map(friendDocs.docs.map((d) => [d.id, d.data().since || 0]));

  const friends = friendIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((p) => ({ ...p, since: sinceById.get(p.uid) || 0 }))
    // 최근 접속 순 — 지금 놀고 있는 친구의 수조를 보러 가는 게 자연스러운 동선이다.
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt);

  const code = await ensureCode(uid);

  return {
    friends,
    incoming: inIds.map((id) => byId.get(id)).filter(Boolean),
    outgoing: outIds.map((id) => byId.get(id)).filter(Boolean),
    visits: visitDocs.docs.map((d) => ({
      uid: d.id,
      type: d.data().type,
      at: d.data().at || 0,
      displayName: d.data().displayName || "AquaWorld 유저",
    })),
    myCode: code,
    serverTime: Date.now(),
  };
});

// ─── 친구 수조 방문 (읽기 전용) ──────────────────────────────────────────────

/**
 * 방문 일일 한도 확인 + 카운트. 같은 친구를 여러 번 봐도 하루 1회만 차감되도록
 * 방문한 uid 집합을 날짜별로 들고 있는다(단순 카운터면 새로고침이 한도를 갉아먹는다).
 */
function takeVisitSlot(user, friendUid, now) {
  const key = dayKeyKst(now);
  const counter = user.visitCounter && user.visitCounter.day === key
    ? user.visitCounter
    : { day: key, uids: [] };
  if (counter.uids.includes(friendUid)) return { counter, charged: false };
  if (counter.uids.length >= G.FRIEND_VISIT_LIMIT_PER_DAY) {
    throw new HttpsError(
      "resource-exhausted",
      `오늘은 친구 수조를 ${G.FRIEND_VISIT_LIMIT_PER_DAY}곳까지 방문했어요. 내일 다시 놀러가요!`,
    );
  }
  return { counter: { day: key, uids: [...counter.uids, friendUid] }, charged: true };
}

exports.getFriendTank = onCall(async (request) => {
  const uid = requireAuth(request);
  const friendUid = request.data && request.data.friendUid;
  if (!friendUid || typeof friendUid !== "string") {
    throw new HttpsError("invalid-argument", "friendUid 필요");
  }

  const link = await friendsCol(uid).doc(friendUid).get();
  if (!link.exists) throw new HttpsError("permission-denied", "친구만 수조를 방문할 수 있습니다.");

  const fSnap = await userRef(friendUid).get();
  if (!fSnap.exists) throw new HttpsError("not-found", "유저 없음");
  const friend = fSnap.data();

  const tankId = (friend.tanks || [])[0];
  if (!tankId) throw new HttpsError("not-found", "친구 수조가 없습니다.");
  const tSnap = await tankRef(tankId).get();
  if (!tSnap.exists || tSnap.data().ownerId !== friendUid) {
    throw new HttpsError("not-found", "친구 수조가 없습니다.");
  }

  // 방문 한도 차감 + 첫 방문 보상은 내 문서 트랜잭션으로 원자 처리.
  const now = Date.now();
  const reward = await db.runTransaction(async (tx) => {
    const meSnap = await tx.get(userRef(uid));
    if (!meSnap.exists) throw new HttpsError("not-found", "유저 없음");
    const me = meSnap.data();
    const { counter, charged } = takeVisitSlot(me, friendUid, now);
    if (!charged) return 0; // 오늘 이미 다녀온 친구 — 재방문은 무료지만 보상도 없다
    me.visitCounter = counter;
    me.pearl = (me.pearl || 0) + G.FRIEND_VISIT_PEARL_REWARD;
    tx.set(userRef(uid), me);
    return G.FRIEND_VISIT_PEARL_REWARD;
  });

  // 읽기 전용 스냅샷 — ownerId 는 물론 방문자가 알 필요 없는 필드도 지운다.
  const t = tSnap.data();
  const tank = {
    id: t.id,
    name: t.name,
    environment: t.environment,
    fish: t.fish || [],
    decorations: t.decorations || [],
    cleanliness: typeof t.cleanliness === "number" ? t.cleanliness : 100,
    lightMode: t.lightMode || "auto",
    capacityLevel: t.capacityLevel || 0,
    createdAt: t.createdAt || 0,
    updatedAt: t.updatedAt || 0,
  };

  const myVisit = await visitsCol(friendUid).doc(uid).get();

  return {
    tank,
    owner: publicProfile(friendUid, friend),
    pearlReward: reward,
    // 오늘 이 친구에게 이미 흔적을 남겼는지 — UI 버튼 상태용
    tracedToday: myVisit.exists && dayKeyKst(myVisit.data().at || 0) === dayKeyKst(now),
    serverTime: now,
  };
});

// ─── 방문 흔적 (하트 · 먹이 주기) ────────────────────────────────────────────

exports.sendFriendTrace = onCall(async (request) => {
  const uid = requireAuth(request);
  const friendUid = request.data && request.data.friendUid;
  const type = request.data && request.data.type;
  if (!friendUid || typeof friendUid !== "string") {
    throw new HttpsError("invalid-argument", "friendUid 필요");
  }
  if (type !== "heart" && type !== "feed") {
    throw new HttpsError("invalid-argument", "type 은 heart 또는 feed 여야 합니다.");
  }

  const link = await friendsCol(uid).doc(friendUid).get();
  if (!link.exists) throw new HttpsError("permission-denied", "친구에게만 흔적을 남길 수 있습니다.");

  const meSnap = await userRef(uid).get();
  if (!meSnap.exists) throw new HttpsError("not-found", "유저 없음");
  const myName = meSnap.data().displayName || "AquaWorld 유저";

  const now = Date.now();
  const today = dayKeyKst(now);

  // 하트는 기록만 남긴다. 먹이는 친구 수조를 실제로 바꾸므로 트랜잭션 + 수신 한도가 필요하다.
  if (type === "heart") {
    await visitsCol(friendUid).doc(uid).set({
      uid, type: "heart", at: now, displayName: myName,
    });
    return { status: "ok", type: "heart", serverTime: now };
  }

  const fed = await db.runTransaction(async (tx) => {
    const fSnap = await tx.get(userRef(friendUid));
    if (!fSnap.exists) throw new HttpsError("not-found", "유저 없음");
    const friend = fSnap.data();
    const tankId = (friend.tanks || [])[0];
    if (!tankId) throw new HttpsError("not-found", "친구 수조가 없습니다.");

    const tSnap = await tx.get(tankRef(tankId));
    if (!tSnap.exists || tSnap.data().ownerId !== friendUid) {
      throw new HttpsError("not-found", "친구 수조가 없습니다.");
    }
    const tank = tSnap.data();

    // 수조가 하루에 받을 수 있는 친구 먹이 수 제한 — 친구가 많아도 성장이 폭주하지 않게.
    const recv = tank.friendFeedCounter && tank.friendFeedCounter.day === today
      ? tank.friendFeedCounter
      : { day: today, count: 0 };
    if (recv.count >= G.FRIEND_FEED_RECEIVE_LIMIT_PER_DAY) {
      throw new HttpsError("resource-exhausted", "이 수조는 오늘 친구 먹이를 충분히 받았어요.");
    }

    // 아직 다 자라지 않은 물고기 중 하나에게 준다. 전부 large 면 먹일 대상이 없다.
    const list = tank.fish || [];
    const targets = list.filter((f) => f.growthStage !== "large");
    if (targets.length === 0) {
      throw new HttpsError("failed-precondition", "먹이를 줄 물고기가 없어요.");
    }
    const target = targets[Math.floor(Math.random() * targets.length)];

    const boosted = {
      ...target,
      feedCount: (target.feedCount || 0) + 1,
      lastFedAt: now,
      mood: "happy",
      growthBoostSeconds: (target.growthBoostSeconds || 0) + G.FRIEND_FEED_GROWTH_BOOST_SECONDS,
    };
    const advanced = applyGrowthAdvance(boosted, now);
    const finalFish = advanced || boosted;

    tx.set(tankRef(tankId), {
      ...tank,
      fish: list.map((f) => (f.id === target.id ? finalFish : f)),
      friendFeedCounter: { day: today, count: recv.count + 1 },
      updatedAt: now,
    });
    tx.set(visitsCol(friendUid).doc(uid), {
      uid, type: "feed", at: now, displayName: myName,
    });
    return { fishName: target.name, speciesId: target.speciesId };
  });

  return { status: "ok", type: "feed", fed, serverTime: now };
});

// ─── 초대 링크 보상 ─────────────────────────────────────────────────────────
// 초대 코드 = 초대한 사람의 친구 코드. 별도 코드 체계를 만들지 않아 링크 하나로
// "친구 추가 + 보상" 이 한 번에 성립한다.

exports.redeemInvite = onCall(async (request) => {
  const uid = requireAuth(request);
  const code = normalizeCode(request.data && request.data.code);
  if (code.length !== G.FRIEND_CODE_LENGTH) {
    throw new HttpsError("invalid-argument", "초대 코드는 6자리입니다.");
  }

  const cSnap = await codeRef(code).get();
  if (!cSnap.exists) throw new HttpsError("not-found", "유효하지 않은 초대 코드입니다.");
  const inviterUid = cSnap.data().uid;
  if (inviterUid === uid) throw new HttpsError("failed-precondition", "본인 초대 코드는 쓸 수 없습니다.");

  const now = Date.now();

  // 중복 방지의 핵심: invitedBy 는 딱 한 번만 설정된다. 이미 있으면 그대로 거절.
  // 트랜잭션 안에서 읽고 쓰므로 동시 호출로 두 번 지급되지 않는다.
  await db.runTransaction(async (tx) => {
    const meSnap = await tx.get(userRef(uid));
    if (!meSnap.exists) throw new HttpsError("not-found", "유저 없음");
    const me = meSnap.data();
    if (me.invitedBy) throw new HttpsError("already-exists", "이미 초대 보상을 받았습니다.");

    // 가입 직후에만 유효 — 오래된 계정이 뒤늦게 코드를 넣어 보상만 챙기는 것을 막는다.
    const ageDays = (now - (me.createdAt || now)) / 86400000;
    if (ageDays > G.INVITE_REDEEM_WINDOW_DAYS) {
      throw new HttpsError(
        "failed-precondition",
        `초대 코드는 가입 후 ${G.INVITE_REDEEM_WINDOW_DAYS}일 이내에만 입력할 수 있습니다.`,
      );
    }

    const inviterSnap = await tx.get(userRef(inviterUid));
    if (!inviterSnap.exists) throw new HttpsError("not-found", "초대한 유저를 찾을 수 없습니다.");
    const inviter = inviterSnap.data();

    me.invitedBy = inviterUid;
    me.inventory = [...(me.inventory || []), makeEgg(G.INVITE_REWARD.tier)];
    inviter.inventory = [...(inviter.inventory || []), makeEgg(G.INVITE_REWARD.tier)];
    inviter.inviteCount = (inviter.inviteCount || 0) + 1;

    tx.set(userRef(uid), me);
    tx.set(userRef(inviterUid), inviter);
  });

  // 보상이 확정된 뒤에 친구로 이어준다. 여기서 실패해도 보상은 유효하고,
  // 사용자는 친구 탭에서 코드로 다시 추가할 수 있다.
  try {
    await linkFriends(uid, inviterUid, now);
  } catch (err) {
    logger.warn("redeemInvite: 친구 연결 실패(보상은 지급됨)", { uid, inviterUid, err });
  }

  const meAfter = await userRef(uid).get();
  return {
    user: meAfter.data(),
    reward: G.INVITE_REWARD,
    inviterUid,
    serverTime: now,
  };
});
