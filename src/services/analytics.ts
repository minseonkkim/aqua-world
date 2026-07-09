/**
 * Firebase Analytics 얇은 래퍼.
 *
 * - Analytics 인스턴스는 `analyticsSupported()` 가 통과해야 생성되므로 비동기적으로 채워진다.
 *   → 모든 호출은 instance 가 없으면 no-op (조용히 폐기) 한다.
 * - 게스트/미설정 환경에서도 안전하게 호출 가능.
 * - dev 모드에서는 콘솔에 함께 출력해 검증을 돕는다.
 *
 * Phase 2 핵심 20개 이벤트 목록은 docs 로드맵 2-5 참조.
 * 추적되는 이벤트 이름은 모두 snake_case (GA4 권장).
 */

import { getAnalyticsInstance } from './firebase/config';

// firebase/analytics 모듈도 동적 로드 — 초기 firebase 청크에서 분리(번들 절감).
// getAnalyticsInstance() 가 non-null 이면 config.ts 가 이미 이 모듈을 로드해둔
// 상태이므로, 아래 import()는 캐시된 청크를 즉시 반환한다(추가 지연 없음).
let fbAnalyticsMod: Promise<typeof import('firebase/analytics')> | null = null;
function loadAnalyticsMod() {
  if (!fbAnalyticsMod) fbAnalyticsMod = import('firebase/analytics');
  return fbAnalyticsMod;
}

// Sentry는 main.tsx와 동일하게 lazy — analytics 사용 시점에 동적 로드.
let sentryPromise: Promise<typeof import('@sentry/react')> | null = null;
function getSentry() {
  if (!sentryPromise) sentryPromise = import('@sentry/react');
  return sentryPromise;
}

type EventParams = Record<string, string | number | boolean | undefined | null>;

/** 모든 이벤트 호출 진입점. instance 가 아직 없으면 no-op. */
export function track(name: string, params?: EventParams): void {
  // undefined/null 파라미터는 GA4 에서 의미 없으므로 제거 (드롭된 키는 BigQuery 에서도 깔끔)
  const cleaned = params
    ? Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
      )
    : undefined;

  if (import.meta.env.DEV) {
    // dev 콘솔에서 이벤트가 트리거됐는지 한눈에 확인
    console.debug('[analytics]', name, cleaned ?? '');
  }

  const inst = getAnalyticsInstance();
  if (!inst) return;
  void loadAnalyticsMod()
    .then(({ logEvent }) => {
      logEvent(inst, name, cleaned as Record<string, unknown> | undefined);
    })
    .catch(err => {
      // GA4 호출 실패는 게임 동작에 영향이 없어야 한다.
      if (import.meta.env.DEV) console.warn('[analytics] logEvent failed', err);
    });
}

/** 로그인/로그아웃 시 호출. null → 사용자 식별 해제. */
export function identifyUser(uid: string | null): void {
  void getSentry().then(S => S.setUser(uid ? { id: uid } : null)).catch(() => {});
  const inst = getAnalyticsInstance();
  if (!inst) return;
  void loadAnalyticsMod()
    .then(({ setUserId }) => setUserId(inst, uid))
    .catch(err => {
      if (import.meta.env.DEV) console.warn('[analytics] setUserId failed', err);
    });
}

/** 코호트 분석용 user properties (account_type, level 등). */
export function setUserProps(props: Record<string, string | number | boolean | null>): void {
  const inst = getAnalyticsInstance();
  if (!inst) return;
  void loadAnalyticsMod()
    .then(({ setUserProperties }) => setUserProperties(inst, props))
    .catch(err => {
      if (import.meta.env.DEV) console.warn('[analytics] setUserProperties failed', err);
    });
}

// ─── 이벤트 헬퍼 ────────────────────────────────────────────────────────────
// 각 헬퍼는 의도된 파라미터 스키마를 타입으로 강제해 호출 지점의 일관성을 보장한다.

export const analytics = {
  // 세션/인증
  appOpen: () => track('app_open'),
  signUp: (method: 'google' | 'kakao' | 'guest') => track('sign_up', { method }),
  login: (method: 'google' | 'kakao' | 'guest') => track('login', { method }),
  logout: () => track('logout'),

  // 온보딩/튜토리얼
  onboardingComplete: () => track('onboarding_complete'),
  tutorialStep: (step: number) => track('tutorial_step', { step }),
  tutorialComplete: (outcome: 'completed' | 'skipped') =>
    track('tutorial_complete', { outcome }),

  // 코어 루프
  feedFish: (stage: string) => track('feed_fish', { stage }),
  sprinkleFeed: () => track('sprinkle_feed'),
  cleanTank: () => track('clean_tank'),
  fishGrowStage: (newStage: string) => track('fish_grow_stage', { new_stage: newStage }),
  dailyRewardClaim: (day: number, rewardType: string) =>
    track('daily_reward_claim', { day, reward_type: rewardType }),

  // 가챠
  purchaseEgg: (tier: string, currency: 'pearl' | 'star_coral', price: number) =>
    track('purchase_egg', { tier, currency, price }),
  startHatching: (tier: string) => track('start_hatching', { tier }),
  hatchEgg: (tier: string, speciesId: string) =>
    track('hatch_egg', { tier, species_id: speciesId }),
  breedFish: (speciesId: string) => track('breed_fish', { species_id: speciesId }),

  // 경제/상점
  purchaseDecoration: (modelId: string, price: number) =>
    track('purchase_decoration', { model_id: modelId, price }),
  purchaseFeedTicket: (pkgId: string, amount: number, price: number) =>
    track('purchase_feed_ticket', { pkg_id: pkgId, amount, price }),
  purchaseStarCoral: (pkgId: string, amount: number, priceKrw: number) =>
    track('purchase_star_coral', { pkg_id: pkgId, amount, price_krw: priceKrw }),
  exchangePearl: (pkgId: string) => track('exchange_pearl', { pkg_id: pkgId }),

  // 참여
  photoCapture: (filter: string, frame: string, action: 'shared' | 'downloaded') =>
    track('photo_capture', { filter, frame, action }),
  compendiumMilestoneClaim: (pct: number) =>
    track('compendium_milestone_claim', { pct }),
};
