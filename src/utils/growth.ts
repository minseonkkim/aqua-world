import { Fish, FishGrowthStage } from '@/types';
import { STAGE_DURATION_SECONDS, NEXT_STAGE } from '@/constants';

export interface GrowthSnapshot {
  stage: FishGrowthStage;
  /** 0~100, large 단계는 항상 100 */
  progress: number;
  /** 현재 단계 잔여 시간(초). large는 0 */
  remainingSeconds: number;
  /** 다음 단계로 승급 가능 여부 */
  ready: boolean;
}

/**
 * 저장된 fish 데이터로부터 현재 성장 상태를 계산한다.
 * stageStartedAt이 없으면(레거시) acquiredAt 사용.
 */
export function computeGrowth(fish: Fish, now: number = Date.now()): GrowthSnapshot {
  const stage = fish.growthStage;
  const duration = STAGE_DURATION_SECONDS[stage];
  if (duration == null) {
    return { stage: 'large', progress: 100, remainingSeconds: 0, ready: false };
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

/**
 * 승급 가능하면 다음 단계로 진행한 새 fish 객체를 반환. 아니면 null.
 * 여러 단계가 한 번에 누적된 경우(오랜만에 접속)는 한 번에 모두 처리.
 */
export function applyGrowthAdvance(fish: Fish, now: number = Date.now()): Fish | null {
  let current = fish;
  let changed = false;
  for (let i = 0; i < 5; i++) {
    const snap = computeGrowth(current, now);
    if (!snap.ready) break;
    const next = NEXT_STAGE[snap.stage];
    if (!next) break;
    const duration = STAGE_DURATION_SECONDS[snap.stage];
    if (duration == null) break;
    // 이전 단계에서 소요된 시간만큼 빼서 다음 단계로 carry-over
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
  // 최신 progress 동기화
  const snap = computeGrowth(current, now);
  return { ...current, growthProgress: snap.progress };
}

export function formatRemaining(sec: number): string {
  if (sec <= 0) return '승급 가능!';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}
