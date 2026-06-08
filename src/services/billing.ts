/// <reference types="cordova-plugin-purchase" />
/**
 * Star Coral 인앱결제 (Google Play Billing).
 *
 * - 네이티브: `cordova-plugin-purchase`(v13, CdvPurchase) 로 결제 → 서버검증 → 소비(consume).
 * - 웹: Play Billing 인벤토리가 없으므로 `isBillingAvailable()` 가 false → UI 에서 다른 경로로 분기.
 *
 * 결제 흐름(낙관적 선지급 없음 — 실화폐이므로 서버 확정 후에만 재화 반영):
 *   1. UI 가 `purchaseStarCoral(pkg)` 호출 → `store.order()` 로 Play 결제창 노출
 *   2. 결제 승인(approved) → `verifyStarCoralPurchase({pkgId, productId, purchaseToken})` 서버 호출
 *      서버가 Play Developer API 로 purchaseToken 을 검증하고 멱등 지급 → 권위 user 반환(setUser)
 *   3. 검증 성공 시에만 `transaction.finish()` 로 소비 → 같은 상품 재구매 가능
 *
 * ads.ts 의 init-once(promise guard) + `isNative()` web no-op 패턴을 따른다.
 */
import { isNative } from './platform';
import { verifyStarCoralPurchase } from './firebase/functions';
import { CURRENCY } from '@/constants';

type StarCoralPkg = (typeof CURRENCY.STAR_CORAL_PACKAGES)[number];

declare global {
  interface Window {
    CdvPurchase?: typeof CdvPurchase;
  }
}

/** 사용자가 결제창을 직접 닫았을 때(취소). UI 는 조용히 종료해야 한다. */
export class PurchaseCancelledError extends Error {
  constructor() {
    super('결제가 취소되었습니다');
    this.name = 'PurchaseCancelledError';
  }
}

/** UI 가 인앱결제 버튼을 노출할지 결정. */
export function isBillingAvailable(): boolean {
  return isNative();
}

// productId → 진행 중인 1건의 주문 resolver. approved 이벤트가 전역으로 오므로 주문과 상관시킨다.
const pending = new Map<string, { resolve: () => void; reject: (e: unknown) => void }>();

let initialized = false;
let initPromise: Promise<void> | null = null;

/** 앱 부팅 직후 1회만 호출. 네이티브가 아니면 no-op. */
export async function initBilling(): Promise<void> {
  if (!isNative()) return;
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // 타입은 store.d.ts 의 ambient 전역(CdvPurchase)으로 제공된다. 이 import 는 side-effect 전용
    // (window.CdvPurchase 등록)이며, 패키지가 ESM 모듈을 export 하지 않아 타입상 "모듈 아님" 경고가 난다.
    // @ts-expect-error cordova-plugin-purchase 는 전역 네임스페이스만 제공(모듈 export 없음)
    await import('cordova-plugin-purchase');
    const api = window.CdvPurchase;
    if (!api) throw new Error('CdvPurchase 플러그인을 로드하지 못했습니다');
    const { store, ProductType, Platform } = api;

    store.register(
      CURRENCY.STAR_CORAL_PACKAGES.map(p => ({
        id: p.playProductId,
        type: ProductType.CONSUMABLE,
        platform: Platform.GOOGLE_PLAY,
      })),
    );

    store
      .when()
      .approved(transaction => {
        void handleApproved(transaction);
      });

    await store.initialize([Platform.GOOGLE_PLAY]);
    initialized = true;
  })().catch(err => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

/** 결제 승인 → 서버검증 → 검증 성공 시에만 소비(finish). */
async function handleApproved(transaction: CdvPurchase.Transaction): Promise<void> {
  const productId = transaction.products?.[0]?.id;
  // Google Play Receipt 의 purchaseToken (서버가 Play Developer API 검증에 사용).
  const receipt = transaction.parentReceipt as unknown as { purchaseToken?: string };
  const purchaseToken = receipt?.purchaseToken;
  const pkg = CURRENCY.STAR_CORAL_PACKAGES.find(p => p.playProductId === productId);
  const waiter = productId ? pending.get(productId) : undefined;

  if (!pkg || !purchaseToken) {
    // 알 수 없는 상품/토큰 → 소비해서 큐를 비우고 대기자에 실패 통보.
    await transaction.finish().catch(() => undefined);
    waiter?.reject(new Error('알 수 없는 결제 항목입니다'));
    if (productId) pending.delete(productId);
    return;
  }

  try {
    // 서버가 검증 + 멱등 지급 후 권위 user 를 반환(setUser 는 call 헬퍼가 처리).
    await verifyStarCoralPurchase({ pkgId: pkg.id, productId, purchaseToken });
    // 검증 성공 → 소비. 같은 소비성 상품을 다시 살 수 있게 된다.
    await transaction.finish();
    waiter?.resolve();
  } catch (e) {
    // 서버 검증 실패: finish 하지 않는다. 미소비 상태로 남겨 다음 init 때 재시도 가능
    // (일시 오류 대응). 끝내 소비 안 된 소비성 상품은 Play 가 3일 후 자동 환불.
    waiter?.reject(e);
  } finally {
    pending.delete(productId);
  }
}

/**
 * Star Coral 패키지 결제. 결제 성공+서버검증 완료 시 resolve(이때 user 스토어는 이미 갱신됨).
 * 사용자가 취소하면 PurchaseCancelledError 로 reject.
 */
export async function purchaseStarCoral(pkg: StarCoralPkg): Promise<void> {
  if (!isNative()) throw new Error('인앱결제는 앱에서만 가능합니다');
  await initBilling();
  const api = window.CdvPurchase;
  if (!api) throw new Error('CdvPurchase 플러그인을 로드하지 못했습니다');
  const { store, Platform, ErrorCode } = api;

  const product = store.get(pkg.playProductId, Platform.GOOGLE_PLAY);
  const offer = product?.getOffer();
  if (!offer) throw new Error('상품 정보를 불러오지 못했습니다');

  return new Promise<void>((resolve, reject) => {
    pending.set(pkg.playProductId, { resolve, reject });
    offer
      .order()
      .then(err => {
        if (err) {
          pending.delete(pkg.playProductId);
          if (err.code === ErrorCode.PAYMENT_CANCELLED) reject(new PurchaseCancelledError());
          else reject(new Error(err.message || '결제에 실패했습니다'));
        }
        // 성공 시: approved 이벤트(handleApproved)가 resolve/reject 한다.
      })
      .catch(e => {
        pending.delete(pkg.playProductId);
        reject(e);
      });
  });
}
