import { httpsCallable } from 'firebase/functions';
import { functions } from './config';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { User, Tank, EggTier, Fish, FishGrowthStage } from '@/types';

/**
 * 모든 경제 연산은 서버(Cloud Functions)에서 실행된다.
 * 각 래퍼는 함수를 호출하고, 반환된 권위 상태(user/tank)를 스토어에 반영한다.
 */

export class FunctionsUnavailableError extends Error {
  constructor() {
    super('서버 함수를 사용할 수 없습니다 (게스트/오프라인 모드).');
    this.name = 'FunctionsUnavailableError';
  }
}

/**
 * 클라우드(서버 권위) 경로를 써야 하는지 여부.
 * 게스트 유저(guest_)와 미설정 환경은 기존 로컬 로직을 그대로 사용한다.
 */
export function isCloudUser(): boolean {
  const u = useUserStore.getState().user;
  return !!functions && !!u && !u.id.startsWith('guest_');
}

interface ServerResult {
  user: User;
  tank?: Tank;
}

/**
 * 낙관적 UI 헬퍼.
 * 1) apply(): 로컬 상태를 즉시 변경해 화면이 바로 반응한다.
 * 2) server(): 백그라운드로 서버 호출 — 성공 시 권위 상태로 자동 재조정(setUser/applyServerTank).
 * 3) 실패 시 호출 직전 user/tank 스냅샷으로 롤백 + onError.
 */
export function optimistic(
  apply: () => void,
  server: () => Promise<unknown>,
  onError?: () => void,
): void {
  const prevUser = useUserStore.getState().user;
  const prevTanks = useTankStore.getState().tanks;
  apply();
  server().catch(() => {
    useUserStore.getState().setUser(prevUser);
    useTankStore.getState().setTanks(prevTanks);
    onError?.();
  });
}

function call<TData, TResult extends ServerResult>(name: string) {
  return async (data?: TData): Promise<TResult> => {
    if (!functions) throw new FunctionsUnavailableError();
    const fn = httpsCallable<TData, TResult>(functions, name);
    const res = await fn(data as TData);
    const result = res.data;
    if (result.user) useUserStore.getState().setUser(result.user);
    if (result.tank) useTankStore.getState().applyServerTank(result.tank);
    return result;
  };
}

// ─── 부트스트랩 / 보상 ──────────────────────────────────────────────────────

export const bootstrapUser = call<void, { user: User; tank?: Tank; created: boolean }>(
  'bootstrapUser',
);

export interface DailyRewardPayload {
  user: User;
  reward: { type: 'pearl' | 'star_coral' | 'egg'; amount?: number; tier?: EggTier; day: number } | null;
}
export const claimDailyReward = call<void, DailyRewardPayload>('claimDailyReward');

export const claimMilestone = call<{ pct: number }, { user: User; reward: unknown }>(
  'claimMilestone',
);

// ─── 상점 ───────────────────────────────────────────────────────────────────

export const purchaseEgg = call<{ tier: EggTier }, { user: User }>('purchaseEgg');
export const exchangePearl = call<{ pkgId: string }, { user: User }>('exchangePearl');
export const purchaseStarCoral = call<{ pkgId: string }, { user: User }>('purchaseStarCoral');
export const purchaseDecoration = call<{ modelId: string }, { user: User }>('purchaseDecoration');

// ─── 부화 / 먹이 ────────────────────────────────────────────────────────────

export const sprinkleFeed = call<void, { user: User }>('sprinkleFeed');

export const startHatching = call<{ eggId: string }, { user: User }>('startHatching');

export const hatchEgg = call<
  { eggId: string; tankId: string },
  { user: User; tank: Tank; speciesId: string; fish: Fish }
>('hatchEgg');

export const feedFish = call<
  { tankId: string; fishId: string },
  { user: User; tank: Tank; newStage: FishGrowthStage | null }
>('feedFish');

// ─── 회원 탈퇴 ─────────────────────────────────────────────────────────────
// 서버에서 user 문서 + 소유 tanks + Auth 계정까지 영구 삭제한다.
// 응답에 user/tank 가 없으므로 call 헬퍼를 쓰지 않고 직접 호출한다.

export async function deleteAccount(): Promise<void> {
  if (!functions) throw new FunctionsUnavailableError();
  await httpsCallable<void, { ok: boolean }>(functions, 'deleteAccount')();
}
