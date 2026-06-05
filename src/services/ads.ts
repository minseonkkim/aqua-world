/**
 * 보상형 광고(AdMob).
 *
 * - 네이티브: `@capacitor-community/admob` 의 RewardVideoAd 사용.
 * - 웹: AdMob 인벤토리가 없으므로 `isAdsAvailable()` 가 false 를 돌려 UI 에서 버튼을 숨긴다.
 *
 * 보상 지급 흐름:
 *   1. UI 가 `prepareAdReward({type, payload})` 호출 → 서버가 1회용 nonce 발급
 *   2. `showRewardedAd(nonce)` 가 광고를 띄움 (가능하면 사전 로드된 인스턴스 사용)
 *   3. 광고 종료 시 클라가 `claimAdReward({nonceId})` 호출 → 서버가 nonce 검증 후 보상 지급
 *
 * UX 최적화 — 사전 로드(preload):
 *   인큐베이터/일일보상 패널이 열리는 순간 `preloadRewardedAd()` 를 호출해
 *   백그라운드로 광고를 미리 받아둔다. 사용자가 버튼을 누를 땐 `showRewardVideoAd()` 만
 *   호출하면 되므로 체감 지연이 사라진다.
 *
 *   ⚠️ Trade-off: prepare 시점에 nonce 가 없으므로 SSV(서버 측 검증) 경로가 비활성.
 *   보안은 claimAdReward 의 1회용 nonce 검증 + 일일 한도로 유지 (충분).
 *   강한 SSV 가 필요하면 prepareRewardVideoAd 의 ssv 옵션을 직접 채워 호출하면 된다.
 */
import { isNative } from './platform';

/** AdMob 콘솔에서 발급받는 광고 단위 ID. .env 미설정 시 Google 공식 테스트 단위로 폴백. */
const TEST_REWARDED_ANDROID = 'ca-app-pub-3940256099942544/5224354917';
function rewardedUnitId(): string {
  return (
    (import.meta.env.VITE_ADMOB_REWARDED_ANDROID as string | undefined) ||
    TEST_REWARDED_ANDROID
  );
}

type CapAdMob = typeof import('@capacitor-community/admob').AdMob;

let pluginCache: { plugin: CapAdMob } | null = null;
async function loadPlugin(): Promise<{ plugin: CapAdMob }> {
  if (!pluginCache) {
    const m = await import('@capacitor-community/admob');
    pluginCache = { plugin: m.AdMob };
  }
  return pluginCache;
}

let initialized = false;
let initPromise: Promise<void> | null = null;

/** 앱 부팅 직후 1회만 호출. 네이티브가 아니면 no-op. */
export async function initAds(): Promise<void> {
  if (!isNative()) return;
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const { plugin } = await loadPlugin();
    await plugin.initialize({
      initializeForTesting: true,
    });
    initialized = true;
  })().catch(err => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

/** UI 가 광고 버튼을 노출할지 결정. */
export function isAdsAvailable(): boolean {
  return isNative();
}

// ─── 사전 로드(preload) 상태 머신 ────────────────────────────────────────────
// 한 번 prepareRewardVideoAd 가 끝나면 show 직전까지 광고 인스턴스가 SDK 내부에
// 캐싱된다. 우리는 그 "로드 완료" 시점만 Promise 로 노출해 show 직전 await 하면 된다.
// show 가 끝나면 자동으로 다음 광고를 다시 미리 받는 체인 구조.

let preloadInFlight: Promise<boolean> | null = null;
let preloaded = false;

/**
 * 백그라운드로 다음 광고 1편을 미리 받는다. 이미 받아둔 게 있으면 no-op.
 * 호출은 idempotent — 패널 mount/open 시점에 마음껏 불러도 안전.
 */
export function preloadRewardedAd(): Promise<boolean> {
  if (!isNative()) return Promise.resolve(false);
  if (preloaded) return Promise.resolve(true);
  if (preloadInFlight) return preloadInFlight;
  preloadInFlight = (async () => {
    try {
      await initAds();
      const { plugin } = await loadPlugin();
      await plugin.prepareRewardVideoAd({ adId: rewardedUnitId() });
      preloaded = true;
      return true;
    } catch (err) {
      console.warn('[ads] preload failed', err);
      preloaded = false;
      return false;
    } finally {
      preloadInFlight = null;
    }
  })();
  return preloadInFlight;
}

/**
 * 광고 시청 → 보상 1회. 성공 시 true, 사용자 닫기/실패 시 false.
 *
 * 우선 preload 가 끝났으면 즉시 show. 없으면 prepare 부터 직렬 호출(느림).
 * nonce/uid 는 SSV 옵션을 채우고 싶은 경우를 대비해 시그니처에 남겼지만, 사전 로드된
 * 광고에는 SSV 가 없다. 보상 검증은 호출 측의 claimAdReward(nonce) 가 책임진다.
 */
export async function showRewardedAd(_nonce: string, _uid: string): Promise<boolean> {
  if (!isNative()) return false;
  await initAds();
  const { plugin } = await loadPlugin();

  // 1) 사전 로드된 광고가 없으면 지금 받음 (콜드 패스 — 느림)
  if (!preloaded) {
    const ok = await preloadRewardedAd();
    if (!ok) return false;
  }

  try {
    const reward = await plugin.showRewardVideoAd();
    preloaded = false; // 한 번 보여진 광고는 재사용 불가
    // 다음번을 위해 즉시 백그라운드 재로드 (사용자가 연속으로 누르는 흐름 대응)
    void preloadRewardedAd();
    return !!reward && (reward.amount ?? 0) > 0;
  } catch (err) {
    console.warn('[ads] showRewardedAd failed', err);
    preloaded = false;
    void preloadRewardedAd();
    return false;
  }
}
