import { Fish } from '../types';
import { BREEDABLE_STAGES, BREED_COOLDOWN_SECONDS } from '../constants';

/**
 * 짝짓기(번식) 자격 판정 유틸.
 * 시간(now)은 호출 측에서 넘긴다 — 클라우드 유저는 serverNow() 를 써서 서버 판정과 어긋나지 않게 한다.
 */

/** 남은 재짝짓기 쿨다운(초). 0이면 바로 짝짓기 가능. */
export function breedCooldownRemaining(fish: Fish, now: number): number {
  const last = fish.lastBredAt ?? 0;
  if (!last) return 0;
  return Math.max(0, BREED_COOLDOWN_SECONDS - (now - last) / 1000);
}

/** 성어 이상 + 쿨다운 종료 → 짝짓기 가능 */
export function isBreedable(fish: Fish, now: number): boolean {
  if (!BREEDABLE_STAGES.includes(fish.growthStage)) return false;
  return breedCooldownRemaining(fish, now) <= 0;
}

/** 두 물고기가 서로 짝지을 수 있는지: 서로 다른 개체 + 같은 종 + 둘 다 짝짓기 가능 */
export function canPair(a: Fish, b: Fish, now: number): boolean {
  return a.id !== b.id && a.speciesId === b.speciesId && isBreedable(a, now) && isBreedable(b, now);
}
