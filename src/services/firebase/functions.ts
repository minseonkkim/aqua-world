import { httpsCallable } from 'firebase/functions';
import { functions } from './config';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { syncServerClock } from '@/services/clock';
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
  /** 서버가 응답을 만든 시각(ms). 클럭 오프셋 동기화에 사용. */
  serverTime?: number;
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
  onError?: (err: unknown) => void,
): void {
  const prevUser = useUserStore.getState().user;
  const prevTanks = useTankStore.getState().tanks;
  apply();
  server().catch((err) => {
    useUserStore.getState().setUser(prevUser);
    useTankStore.getState().setTanks(prevTanks);
    onError?.(err);
  });
}

function call<TData, TResult extends ServerResult>(name: string) {
  return async (data?: TData): Promise<TResult> => {
    if (!functions) throw new FunctionsUnavailableError();
    const fn = httpsCallable<TData, TResult>(functions, name);
    const res = await fn(data as TData);
    const result = res.data;
    if (typeof result.serverTime === 'number') syncServerClock(result.serverTime);
    if (result.user) {
      // tutorialStep / decorationInventory 는 클라 UI 권위 — 서버 응답의 stale 값으로 덮어쓰지 않는다.
      const prev = useUserStore.getState().user;
      const next = prev
        ? { ...result.user, tutorialStep: prev.tutorialStep, decorationInventory: prev.decorationInventory }
        : result.user;
      useUserStore.getState().setUser(next);
    }
    if (result.tank) useTankStore.getState().applyServerTank(result.tank);
    return result;
  };
}

// ─── 부트스트랩 / 보상 ──────────────────────────────────────────────────────

export const bootstrapUser = call<void, { user: User; tank?: Tank; created: boolean; serverTime: number }>(
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
export const purchaseDecoration = call<{ modelId: string }, { user: User }>('purchaseDecoration');

// Star Coral 구매: Google Play Billing 영수증(purchaseToken)을 서버가 Play Developer API 로
// 검증한 뒤에만 지급한다. 무검증 지급(구 purchaseStarCoral)은 서버에서 폐기됨.
export const verifyStarCoralPurchase = call<
  { pkgId: string; productId: string; purchaseToken: string },
  { user: User }
>('verifyStarCoralPurchase');

// ─── 부화 / 먹이 ────────────────────────────────────────────────────────────

export const sprinkleFeed = call<void, { user: User }>('sprinkleFeed');

export const startHatching = call<{ eggId: string }, { user: User }>('startHatching');

export const hatchEgg = call<
  { eggId: string; tankId: string },
  { user: User; tank: Tank; speciesId: string; fish: Fish; storedInInventory?: boolean }
>('hatchEgg');

export const feedFish = call<
  { tankId: string; fishId: string },
  { user: User; tank: Tank; newStage: FishGrowthStage | null }
>('feedFish');

// ─── 물고기 보관함 ↔ 수조 / 수조 확장 ───────────────────────────────────────

export const storeFish = call<{ tankId: string; fishId: string }, { user: User; tank: Tank }>(
  'storeFish',
);
export const placeFish = call<{ tankId: string; fishId: string }, { user: User; tank: Tank }>(
  'placeFish',
);
export const expandTankCapacity = call<{ tankId: string }, { user: User; tank: Tank }>(
  'expandTankCapacity',
);
export const cleanTank = call<{ tankId: string }, { user: User; tank: Tank }>('cleanTank');
export const reconcileFish = call<{ tankId: string }, { user: User; tank: Tank }>('reconcileFish');

// ─── 보상형 광고 ────────────────────────────────────────────────────────────
// prepareAdReward: 광고 노출 직전에 1회용 nonce 발급 (서버 권위)
// claimAdReward:   SSV 가 등록 안 됐거나 실패했을 때 클라가 직접 보상 청구 (폴백)
// nonce 는 양쪽에서 같은 1회용 키로 동작하므로 중복 지급 위험 없음.

export type AdRewardType = 'hatch_boost' | 'daily_double';

export async function prepareAdReward(
  type: AdRewardType,
  payload: Record<string, unknown> = {},
): Promise<{ nonceId: string; ttlMs: number }> {
  if (!functions) throw new FunctionsUnavailableError();
  const fn = httpsCallable<{ type: AdRewardType; payload: Record<string, unknown> }, { nonceId: string; ttlMs: number }>(
    functions,
    'prepareAdReward',
  );
  const res = await fn({ type, payload });
  return res.data;
}

export const claimAdReward = call<{ nonceId: string }, { user: User; applied: unknown }>(
  'claimAdReward',
);

// ─── 회원 탈퇴 ─────────────────────────────────────────────────────────────
// 서버에서 user 문서 + 소유 tanks + Auth 계정까지 영구 삭제한다.
// 응답에 user/tank 가 없으므로 call 헬퍼를 쓰지 않고 직접 호출한다.

export async function deleteAccount(): Promise<void> {
  if (!functions) throw new FunctionsUnavailableError();
  await httpsCallable<void, { ok: boolean }>(functions, 'deleteAccount')();
}
