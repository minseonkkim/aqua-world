/**
 * 서버 공용 기반 — Firestore 핸들 + 여러 함수 모듈이 함께 쓰는 헬퍼.
 *
 * index.js 와 friends.js 가 같은 admin 인스턴스·같은 규칙(일일 리셋 기준, 알 생성,
 * 소유권 검증)을 공유하도록 여기 한 곳에 모아둔다. 각 모듈이 제 사본을 들고 있으면
 * 규칙이 갈라졌을 때(예: 일일 리셋 시각) 조용히 desync 된다.
 */
const { HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const G = require("./gameData");

// 이 모듈이 앱 초기화의 단일 진입점이다. index.js / friends.js 어느 쪽이 먼저
// require 되든 한 번만 초기화되도록 이미 초기화된 앱이 있으면 재사용한다.
if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();

function requireAuth(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  return uid;
}

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// 일일 리셋(먹이/로그인 보상/친구 방문)은 KST(Asia/Seoul) 자정 기준. Cloud Functions 런타임은
// UTC라 그냥 getDate() 를 쓰면 클라(브라우저 로컬 TZ)와 '날짜'가 어긋나 일일 카운터가 desync 된다.
// 한국은 DST 가 없어 고정 +9h 오프셋이 안전. 클라 src/utils/day.ts isNewDayKst 와 동일 규칙.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function isNewDay(lastMs, nowMs) {
  const a = new Date(lastMs + KST_OFFSET_MS);
  const b = new Date(nowMs + KST_OFFSET_MS);
  return (
    a.getUTCDate() !== b.getUTCDate() ||
    a.getUTCMonth() !== b.getUTCMonth() ||
    a.getUTCFullYear() !== b.getUTCFullYear()
  );
}

/** KST 기준 날짜 키(YYYYMMDD). 일일 카운터 맵의 키로 쓴다. */
function dayKeyKst(nowMs) {
  const d = new Date(nowMs + KST_OFFSET_MS);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}${m}${day}`;
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

const userRef = (uid) => db.doc(`users/${uid}`);
const tankRef = (tankId) => db.doc(`tanks/${tankId}`);

/** tank 문서를 읽고 소유권을 검증. ownerId 는 Tank 타입에 없는 Firestore 전용 필드. */
async function readOwnedTank(tx, uid, tankId) {
  const snap = await tx.get(tankRef(tankId));
  if (!snap.exists) {
    logger.warn("readOwnedTank rejected: tank not found", { uid, tankId });
    throw new HttpsError("not-found", "수조를 찾을 수 없습니다.");
  }
  const data = snap.data();
  if (data.ownerId !== uid) {
    logger.warn("readOwnedTank rejected: owner mismatch", { uid, tankId, ownerId: data.ownerId });
    throw new HttpsError("permission-denied", "본인 수조가 아닙니다.");
  }
  return data;
}

/** tank 에서 ownerId 제거(클라 Tank 타입과 일치) */
function stripTank(tankWithOwner) {
  const { ownerId, ...tank } = tankWithOwner;
  void ownerId;
  return tank;
}

module.exports = {
  db,
  KST_OFFSET_MS,
  requireAuth,
  genId,
  isNewDay,
  dayKeyKst,
  makeEgg,
  userRef,
  tankRef,
  readOwnedTank,
  stripTank,
};
