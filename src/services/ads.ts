/**
 * 보상형 광고(AdMob).
 *
 * - 네이티브: `@capacitor-community/admob` 의 RewardVideoAd 사용.
 * - 웹: AdMob 인벤토리가 없으므로 `isAdsAvailable()` 가 false 를 돌려 UI 에서 버튼을 숨긴다.
 *
 * 보상 지급 흐름 (서버 권위):
 *   1. UI 가 `prepareAdReward({type, payload})` 호출 → 서버가 1회용 nonce 발급
 *   2. `showRewardedAd(nonce)` 가 nonce 를 `customData` 로 광고에 실어 보냄
 *   3. 광고 시청 완료 후 AdMob SSV(Server-Side Verification) 가 `admobSSV` HTTP 엔드포인트로
 *      서명된 콜백을 보내고 → 서버가 서명 검증 후 nonce 를 소비하며 보상 지급
 *   4. SSV 미설정/실패 폴백: 클라가 reward 이벤트에서 `claimAdReward({nonceId})` 직접 호출
 *      서버는 같은 1회용 nonce 검증으로 중복 지급을 차단한다.
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

/**
 * 광고 시청 → 보상 1회. 성공 시 true, 사용자 닫기/실패 시 false.
 * customData(=nonce) 는 SSV 콜백/Callable 폴백에서 보상 대상을 식별하는 키.
 *
 * 호출 측은 ① prepareAdReward 로 받은 nonce 를 넘기고,
 * ② resolve 후 서버 보상이 user 상태에 반영될 때까지 짧게 폴링(또는 listen)하면 된다.
 */
export async function showRewardedAd(nonce: string, uid: string): Promise<boolean> {
  if (!isNative()) return false;
  await initAds();
  const { plugin } = await loadPlugin();

  const adId = rewardedUnitId();
  try {
    await plugin.prepareRewardVideoAd({
      adId,
      // SSV: AdMob 서버가 콜백 URL 로 보낼 때 함께 넘어오는 식별 파라미터.
      ssv: {
        userId: uid,
        customData: nonce,
      },
    });
    // v8: 사용자가 보상 조건을 충족하면 AdMobRewardItem({type, amount}) 반환.
    // 조기 종료/실패 시 reject 되므로 catch 로 false 처리.
    const reward = await plugin.showRewardVideoAd();
    // amount 가 양수면 정상 보상 처리.
    return !!reward && (reward.amount ?? 0) > 0;
  } catch (err) {
    console.warn('[ads] showRewardedAd failed', err);
    return false;
  }
}
