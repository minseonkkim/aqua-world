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
 *   백그라운드로 광고를 미리 받아둔다. 사용자가 버튼을 누를 땐 show 만 하면 되므로
 *   체감 지연이 사라진다.
 *
 *   ⚠️ Trade-off: prepare 시점에 nonce 가 없으므로 SSV(서버 측 검증) 경로가 비활성.
 *   보안은 claimAdReward 의 1회용 nonce 검증 + 일일 한도로 유지 (충분).
 *
 * ⚠️ 플러그인의 결정적 제약 — 반드시 리스너로 받아야 한다:
 *   네이티브 `showRewardVideoAd()` 의 PluginCall 은 **보상을 획득했을 때만** resolve 된다.
 *   사용자가 중도에 닫거나(onAdDismissedFullScreenContent) 노출에 실패하면
 *   (onAdFailedToShowFullScreenContent) call 이 resolve 도 reject 도 되지 않아 Promise 가
 *   영원히 pending 으로 남는다. 그래서 이 모듈은 show 결과를 **이벤트**로 판정하고,
 *   Promise 는 catch 용으로만 쓴다. 타임아웃도 최후의 안전망으로 함께 건다.
 *
 *   같은 이유로 로드 실패의 errorCode 도 이벤트로만 얻을 수 있다
 *   (prepare 의 reject 에는 `adError.message` 문자열만 담겨 code 가 유실된다).
 */
import { isNative } from './platform';
import { isOffline } from './network';
import { analytics } from './analytics';

/** AdMob 콘솔에서 발급받는 광고 단위 ID. .env 미설정 시 Google 공식 테스트 단위로 폴백. */
const TEST_REWARDED_ANDROID = 'ca-app-pub-3940256099942544/5224354917';

/**
 * VITE_ADMOB_USE_TEST_ADS=true 면 광고 단위 자체를 공식 테스트 단위로 강제한다.
 * 개발/QA 빌드에서 실 광고를 반복 요청·시청하면 무효 트래픽으로 계정이 제재될 수 있다.
 */
function rewardedUnitId(): string {
  if ((import.meta.env.VITE_ADMOB_USE_TEST_ADS as string | undefined) === 'true') {
    return TEST_REWARDED_ANDROID;
  }
  return (
    (import.meta.env.VITE_ADMOB_REWARDED_ANDROID as string | undefined) ||
    TEST_REWARDED_ANDROID
  );
}

/**
 * 테스트 기기 해시 목록 (콤마 구분). 여기 등록된 기기는 **실 광고 단위 그대로** 테스트 광고를
 * 받아 수익/노출에 집계되지 않는다. 해시는 앱 실행 직후 logcat 의
 * "Use RequestConfiguration.Builder().setTestDeviceIds(Arrays.asList("XXXX"))" 줄에 찍힌다.
 */
function testingDevices(): string[] {
  return ((import.meta.env.VITE_ADMOB_TEST_DEVICES as string | undefined) ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

type AdMobModule = typeof import('@capacitor-community/admob');

let pluginCache: AdMobModule | null = null;
async function loadPlugin(): Promise<AdMobModule> {
  if (!pluginCache) pluginCache = await import('@capacitor-community/admob');
  return pluginCache;
}

// ─── 실패 원인 분류 / 리포팅 ────────────────────────────────────────────────
// 원인을 남기지 않으면 "정말 광고 재고가 없는 것"과 "우리 설정이 틀린 것"을 구분할 수 없다.

/** 이벤트로 넘어오는 AdMob 에러의 최소 형태 (플러그인 AdMobError). */
type AdErrorLike = { code?: number; message?: string };

/** com.google.android.gms.ads.AdRequest 의 ERROR_CODE_* 상수. */
const LOAD_ERROR_REASON: Record<number, string> = {
  0: 'internal',
  1: 'invalid_request',
  2: 'network',
  3: 'no_fill',
  8: 'app_id_missing',
  9: 'mediation_no_fill',
  10: 'request_id_mismatch',
  11: 'invalid_ad_string',
};

/** 재고/네트워크 사정 — 정상 운영 중에도 발생한다. 사람이 볼 필요 없으니 Sentry 로는 안 보낸다. */
const EXPECTED_REASONS = new Set(['no_fill', 'mediation_no_fill', 'network', 'offline']);

let sentryPromise: Promise<typeof import('@sentry/react')> | null = null;
function getSentry() {
  if (!sentryPromise) sentryPromise = import('@sentry/react');
  return sentryPromise;
}

/** 로드 실패 이벤트로만 얻을 수 있는 code 를 담아뒀다가 prepare 의 reject 시점에 함께 보고한다. */
let lastLoadError: AdErrorLike | null = null;

function reasonOf(adError: AdErrorLike | null | undefined, fallback: string): string {
  const code = adError?.code;
  if (typeof code !== 'number') return fallback;
  return LOAD_ERROR_REASON[code] ?? `code_${code}`;
}

/**
 * 광고 실패를 원인과 함께 남긴다.
 * - GA4: 모든 실패 (no-fill 비율을 집계해야 "광고가 없어서인지" 를 판단할 수 있다)
 * - Sentry: 설정 오류성 실패만 (no-fill/네트워크까지 보내면 노이즈 + 쿼터 낭비)
 */
function reportAdFailure(stage: string, reason: string, detail?: unknown): void {
  const message =
    (typeof detail === 'object' && detail !== null && 'message' in detail
      ? String((detail as AdErrorLike).message)
      : detail instanceof Error
        ? detail.message
        : detail === undefined
          ? ''
          : String(detail));

  console.warn(`[ads] ${stage} failed — ${reason}`, message || detail || '');
  analytics.adLoadFailed(stage, reason);

  if (EXPECTED_REASONS.has(reason)) return;
  void getSentry()
    .then(S =>
      S.captureMessage(`[ads] ${stage} failed: ${reason}`, {
        level: 'warning',
        tags: { ad_stage: stage, ad_reason: reason },
        extra: { message, adUnitId: rewardedUnitId() },
      }),
    )
    .catch(() => {});
}

// ─── 초기화 ────────────────────────────────────────────────────────────────

let initialized = false;
let initPromise: Promise<void> | null = null;

/** 앱 부팅 직후 1회만 호출. 네이티브가 아니면 no-op. */
export async function initAds(): Promise<void> {
  if (!isNative()) return;
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const mod = await loadPlugin();
    // testingDevices 가 비어 있으면 initializeForTesting 은 아무 효과가 없다(플러그인이
    // 빈 배열을 그대로 RequestConfiguration 에 넣는다). 등록된 기기가 있을 때만 켠다.
    const devices = testingDevices();
    await mod.AdMob.initialize({
      initializeForTesting: devices.length > 0,
      testingDevices: devices,
    });
    await registerRewardListeners(mod);
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
// prepareRewardVideoAd 가 끝나면 광고 인스턴스가 SDK 내부에 캐싱된다. 다만 그 캐시는
// 영구적이지 않다 — AdMob 보상형 광고는 로드 후 약 1시간이면 만료되고, 만료된 광고를
// show 하면 onAdFailedToShowFullScreenContent 로 조용히 죽는다. 그래서 로드 시각을
// 함께 들고 다니며 TTL 을 넘긴 광고는 없는 것으로 취급하고 새로 받는다.

/** 실제 만료(약 1시간)보다 여유를 둔다. */
const AD_TTL_MS = 50 * 60 * 1000;
/** prepare 콜백이 영영 안 오는 경우를 위한 안전망. */
const PREPARE_TIMEOUT_MS = 20_000;
/** show 호출 후 광고가 실제로 화면에 뜰 때까지 기다리는 한도. */
const SHOW_START_TIMEOUT_MS = 10_000;
/** 광고가 뜬 뒤 Dismissed 가 끝내 안 오는 경우를 위한 최후 한도. */
const SHOW_WATCH_TIMEOUT_MS = 5 * 60 * 1000;
/** 연속 로드 실패 시 백그라운드 preload 재시도 간격 (마지막 값에서 고정). */
const BACKOFF_MS = [3_000, 10_000, 30_000, 60_000];

let preloadInFlight: Promise<boolean> | null = null;
let preloadedAt = 0;
let failStreak = 0;
let nextPreloadAt = 0;

/** 지금 바로 보여줄 수 있는(만료 전) 광고를 들고 있는가. */
function hasFreshAd(): boolean {
  return preloadedAt > 0 && Date.now() - preloadedAt < AD_TTL_MS;
}

/** 광고 인스턴스가 소비됐거나 죽었다 — 다음엔 반드시 새로 받아야 한다. */
function markAdConsumed(): void {
  preloadedAt = 0;
}

function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(tag)), ms);
    p.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * 백그라운드로 다음 광고 1편을 미리 받는다. 이미 신선한 게 있으면 no-op.
 * 호출은 idempotent — 패널 mount/open 시점에 마음껏 불러도 안전.
 *
 * 연속 실패 시 백오프가 걸려 백그라운드 호출은 조용히 false 를 돌려준다.
 * 사용자가 직접 버튼을 누른 경로는 `{ force: true }` 로 백오프를 무시한다.
 */
export function preloadRewardedAd(opts?: { force?: boolean }): Promise<boolean> {
  if (!isNative()) return Promise.resolve(false);
  if (hasFreshAd()) return Promise.resolve(true);
  if (preloadInFlight) return preloadInFlight;

  const force = opts?.force === true;
  if (!force && Date.now() < nextPreloadAt) return Promise.resolve(false);
  if (isOffline()) {
    // SDK 를 부르면 어차피 network 에러로 돌아온다. 왕복을 아끼고 원인만 남긴다.
    reportAdFailure('load', 'offline');
    return Promise.resolve(false);
  }

  preloadInFlight = (async () => {
    try {
      await initAds();
      const mod = await loadPlugin();
      lastLoadError = null;
      await withTimeout(
        mod.AdMob.prepareRewardVideoAd({ adId: rewardedUnitId() }),
        PREPARE_TIMEOUT_MS,
        'prepare_timeout',
      );
      preloadedAt = Date.now();
      failStreak = 0;
      nextPreloadAt = 0;
      return true;
    } catch (err) {
      preloadedAt = 0;
      failStreak += 1;
      nextPreloadAt = Date.now() + BACKOFF_MS[Math.min(failStreak - 1, BACKOFF_MS.length - 1)];
      // reject 의 message 에는 code 가 없다 — FailedToLoad 리스너가 담아둔 값을 우선 쓴다.
      reportAdFailure('load', reasonOf(lastLoadError, 'unknown'), lastLoadError ?? err);
      return false;
    } finally {
      preloadInFlight = null;
    }
  })();
  return preloadInFlight;
}

// ─── show 세션 ──────────────────────────────────────────────────────────────

/**
 * 광고 시청 결과.
 *  - 'rewarded'     : 끝까지 시청 → 보상 지급 대상
 *  - 'dismissed'    : 사용자가 중도에 닫음 → 본인 선택이므로 보상 없음(안내도 없음)
 *  - 'load_failed'  : 광고 인벤토리 없음(no-fill)·네트워크 등 → 사용자 잘못 아님, 재시도 안내 대상
 */
export type AdResult = 'rewarded' | 'dismissed' | 'load_failed';

type ShowSession = {
  resolve: (r: AdResult) => void;
  /** Rewarded 이벤트를 받았는가 (= 끝까지 시청). */
  rewarded: boolean;
  /** Showed 이벤트를 받았는가 (= 광고가 실제로 화면에 떴다). */
  started: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

let showSession: ShowSession | null = null;

function armShowTimeout(ms: number): void {
  const s = showSession;
  if (!s) return;
  if (s.timer) clearTimeout(s.timer);
  s.timer = setTimeout(onShowTimeout, ms);
}

function onShowTimeout(): void {
  const s = showSession;
  if (!s) return;
  // 보상은 받았는데 Dismissed 만 안 온 경우 — 사용자 몫은 지켜준다.
  if (s.rewarded) { settleShow('rewarded'); return; }
  if (s.started) {
    // 광고는 떴는데 끝나는 신호가 없다. 보상은 줄 수 없지만 사용자 잘못도 아니므로
    // 조용히 닫힌 것으로 처리한다(실패 토스트로 헷갈리게 만들지 않는다).
    reportAdFailure('show', 'stuck_after_shown');
    settleShow('dismissed');
  } else {
    reportAdFailure('show', 'show_start_timeout');
    settleShow('load_failed');
  }
}

function settleShow(result: AdResult): void {
  const s = showSession;
  if (!s) return;
  showSession = null;
  if (s.timer) clearTimeout(s.timer);
  markAdConsumed();
  // 다음번을 위해 백그라운드 재로드 (사용자가 연속으로 누르는 흐름 대응)
  void preloadRewardedAd();
  s.resolve(result);
}

let listenersReady = false;

/**
 * show 결과를 판정하는 유일한 경로. initAds 안에서 1회만 등록하고 앱 생애주기 내내 유지한다.
 * (플러그인이 PluginCall 을 보상 획득 시에만 resolve 하므로 이벤트 없이는 결과를 알 수 없다)
 */
async function registerRewardListeners(mod: AdMobModule): Promise<void> {
  if (listenersReady) return;
  listenersReady = true;
  const { AdMob, RewardAdPluginEvents } = mod;

  await AdMob.addListener(RewardAdPluginEvents.Showed, () => {
    const s = showSession;
    if (!s) return;
    s.started = true;
    markAdConsumed(); // 노출된 광고 인스턴스는 재사용 불가
    armShowTimeout(SHOW_WATCH_TIMEOUT_MS);
  });

  await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
    if (showSession) showSession.rewarded = true;
  });

  // Dismissed 는 보상 획득 후 닫힘 / 중도 닫힘 양쪽에서 온다 → rewarded 플래그로 구분.
  await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
    const s = showSession;
    if (!s) return;
    settleShow(s.rewarded ? 'rewarded' : 'dismissed');
  });

  await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error: AdErrorLike) => {
    reportAdFailure('show', reasonOf(error, 'show_failed'), error);
    settleShow('load_failed');
  });

  // 결과 판정에는 쓰지 않고 code 만 보관한다 — prepare 의 reject 에는 code 가 없기 때문.
  await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error: AdErrorLike) => {
    lastLoadError = error;
  });
}

/**
 * 광고 시청 → 결과 반환. 호출 측은 결과에 따라:
 *  - 'rewarded'    → 보상 청구(claimAdReward)
 *  - 'dismissed'   → 조용히 종료
 *  - 'load_failed' → "잠시 후 다시 시도" 토스트 노출(보상은 주지 않음)
 *
 * 신선한 preload 가 있으면 즉시 show, 없으면 prepare 부터 직렬 호출(느림).
 * nonce/uid 는 SSV 옵션을 채우고 싶은 경우를 대비해 시그니처에 남겼지만, 사전 로드된
 * 광고에는 SSV 가 없다. 보상 검증은 호출 측의 claimAdReward(nonce) 가 책임진다.
 */
export async function showRewardedAd(_nonce: string, _uid: string): Promise<AdResult> {
  if (!isNative()) return 'load_failed';

  try {
    await initAds();
  } catch (err) {
    reportAdFailure('init', 'init_failed', err);
    return 'load_failed';
  }
  const mod = await loadPlugin();

  // 이미 광고가 떠 있는데 또 들어온 호출 — 실패가 아니므로 조용히 종료한다.
  if (showSession) return 'dismissed';

  // 사전 로드가 없거나 TTL 을 넘겼으면 지금 받는다 (콜드 패스 — 느림).
  // 사용자가 직접 누른 경로이므로 백오프는 무시한다.
  if (!hasFreshAd()) {
    const ok = await preloadRewardedAd({ force: true });
    if (!ok) return 'load_failed';
  }
  if (showSession) return 'dismissed';

  return new Promise<AdResult>(resolve => {
    showSession = { resolve, rewarded: false, started: false, timer: null };
    armShowTimeout(SHOW_START_TIMEOUT_MS);
    // 이 Promise 는 "보상 획득" 에서만 resolve 되므로 결과 판정에 쓰지 않는다.
    // reject(= 보여줄 광고가 없음)만 잡아 세션을 정리한다.
    mod.AdMob.showRewardVideoAd().catch((err: unknown) => {
      reportAdFailure('show', reasonOf(lastLoadError, 'show_rejected'), err);
      settleShow('load_failed');
    });
  });
}
