import { Fish, FishMood, Tank } from '@/types';
import { getTankCapacity } from '@/constants';

export const CLEANLINESS_DECAY_PER_HOUR = 2; // 100점이면 약 2일에 걸쳐 0
export const CLEANLINESS_PER_FEED = 1.5;     // 먹이 1회당 오염
export const MOOD_HAPPY_THRESHOLD = 70;
export const MOOD_BORED_THRESHOLD = 35;

/** 청소 비용(Pearl) — UI에서 사용 */
export const CLEAN_TANK_COST_PEARL = 50;

export interface ComfortBreakdown {
  total: number;        // 0~100
  cleanliness: number;  // 0~40
  density: number;      // 0~20
  habitat: number;      // 0~20
  schooling: number;    // 0~10
  recentFeed: number;   // 0~10
  tips: string[];
}

/**
 * 개별 물고기 쾌적도(0~100) 계산. UI 표시 및 mood 결정에 사용.
 * habitatLabel은 species.habitat 문자열 — 미상이면 매칭 보너스만 빠짐.
 */
export function computeFishComfort(
  fish: Fish,
  tank: Tank,
  now: number = Date.now(),
): ComfortBreakdown {
  const tips: string[] = [];

  // 1) Cleanliness — 40점 만점
  const cleanScore = Math.max(0, Math.min(40, (tank.cleanliness / 100) * 40));
  if (tank.cleanliness < 50) tips.push('수조가 더러워요 — 물을 갈아주세요');

  // 2) Density — 20점 만점. 수조 수용량 비례로 판정(고정값 X).
  //    수용량의 90% 이상이면 '붐빔'(0점), 그 아래로 단계 감점.
  const count = tank.fish.length;
  const capacity = getTankCapacity(tank.capacityLevel);
  const crowdThreshold = Math.ceil(capacity * 0.9); // 예: 20수용→18, 12수용→11
  const ratio = count / capacity;
  let densityScore = 20;
  if (count >= crowdThreshold) densityScore = 0;
  else if (ratio > 0.75) densityScore = 8;
  else if (ratio > 0.55) densityScore = 14;
  if (count >= crowdThreshold) tips.push('수조가 너무 붐벼요');

  // 3) Habitat — 항상 만점. 환경 변경·이주 수단이 없어 페널티가 막다른 길이라 제거함.
  const habitatScore = 20;

  // 4) Schooling — 10점 (같은 종 2마리 이상이면 만점)
  const sameCount = tank.fish.filter(f => f.speciesId === fish.speciesId).length;
  const schoolingScore = sameCount >= 2 ? 10 : 4;
  if (sameCount < 2) tips.push('같은 종 친구가 있으면 더 행복해요');

  // 5) Recent feed — 10점 (최근 2시간 만점, 24시간 이후 0)
  const hoursSinceFeed = (now - (fish.lastFedAt || 0)) / 3_600_000;
  let recentFeed = 0;
  if (fish.lastFedAt > 0) {
    if (hoursSinceFeed < 2) recentFeed = 10;
    else if (hoursSinceFeed < 6) recentFeed = 6;
    else if (hoursSinceFeed < 24) recentFeed = 3;
  }
  if (fish.lastFedAt === 0 || hoursSinceFeed > 24) tips.push('오래 굶었어요 — 먹이를 주세요');

  const total = Math.round(cleanScore + densityScore + habitatScore + schoolingScore + recentFeed);
  return {
    total,
    cleanliness: Math.round(cleanScore),
    density: densityScore,
    habitat: habitatScore,
    schooling: schoolingScore,
    recentFeed,
    tips,
  };
}

export function comfortToMood(score: number): FishMood {
  if (score >= MOOD_HAPPY_THRESHOLD) return 'happy';
  if (score < MOOD_BORED_THRESHOLD) return 'bored';
  return 'normal';
}

/** 마지막 tick 이후 경과 시간에 따라 청결도 감쇠 */
export function decayCleanliness(
  current: number,
  lastTickAt: number,
  now: number = Date.now(),
): number {
  const hours = Math.max(0, (now - lastTickAt) / 3_600_000);
  return Math.max(0, Math.min(100, current - hours * CLEANLINESS_DECAY_PER_HOUR));
}

/** Boids 속도 가중치 — happy는 활발, bored는 느림 */
export function moodSpeedFactor(mood: FishMood): number {
  if (mood === 'happy') return 1.15;
  if (mood === 'bored') return 0.65;
  return 1.0;
}

/** bored 물고기는 바닥 쪽으로 가라앉는 미세 중력 */
export function moodSinkBias(mood: FishMood): number {
  return mood === 'bored' ? -0.0006 : 0;
}
