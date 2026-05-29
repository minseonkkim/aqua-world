/**
 * 물고기 성장 계산 (src/utils/growth.ts 의 서버 이식판).
 * 성장은 stageStartedAt + 실제 경과시간 + growthBoostSeconds 로만 결정된다.
 */
const { STAGE_DURATION_SECONDS, NEXT_STAGE } = require("./gameData");

function computeGrowth(fish, now) {
  const stage = fish.growthStage;
  const duration = STAGE_DURATION_SECONDS[stage];
  if (duration == null) {
    return { stage: "large", progress: 100, remainingSeconds: 0, ready: false };
  }
  const stageStarted = fish.stageStartedAt || fish.acquiredAt || now;
  const boostMs = (fish.growthBoostSeconds || 0) * 1000;
  const elapsedMs = Math.max(0, now - stageStarted) + boostMs;
  const durationMs = duration * 1000;
  const ratio = elapsedMs / durationMs;
  const progress = Math.min(100, ratio * 100);
  const remainingSeconds = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));
  return { stage, progress, remainingSeconds, ready: ratio >= 1 };
}

/** 승급 가능하면 다음 단계로 진행한 새 fish 반환. 아니면 null. */
function applyGrowthAdvance(fish, now) {
  let current = fish;
  let changed = false;
  for (let i = 0; i < 5; i++) {
    const snap = computeGrowth(current, now);
    if (!snap.ready) break;
    const next = NEXT_STAGE[snap.stage];
    if (!next) break;
    const duration = STAGE_DURATION_SECONDS[snap.stage];
    if (duration == null) break;
    const stageStarted = current.stageStartedAt || current.acquiredAt;
    const boostMs = (current.growthBoostSeconds || 0) * 1000;
    const overflowMs = Math.max(0, (now - stageStarted) + boostMs - duration * 1000);
    current = {
      ...current,
      growthStage: next,
      stageStartedAt: now - overflowMs,
      growthBoostSeconds: 0,
      growthProgress: 0,
    };
    changed = true;
  }
  if (!changed) return null;
  const snap = computeGrowth(current, now);
  return { ...current, growthProgress: snap.progress };
}

module.exports = { computeGrowth, applyGrowthAdvance };
