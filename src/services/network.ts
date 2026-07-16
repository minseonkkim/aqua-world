import { Network } from '@capacitor/network';

/**
 * 네트워크 연결 상태를 캐시해 "동기" 로 조회할 수 있게 한다.
 *
 * describeAuthError() 같은 동기 코드에서 오프라인 여부를 즉시 판단해야 하는데
 * Network.getStatus() 는 Promise 라 그 자리에서 await 할 수 없다. 그래서 앱 시작 시
 * 리스너를 걸어 최신 상태를 모듈 변수에 담아두고, 조회는 동기로 한다.
 *
 * 웹에서도 @capacitor/network 는 navigator.onLine + Network Information API 로 동작하지만,
 * 리스너가 아직 안 붙은 초기 순간을 위해 navigator.onLine 폴백을 함께 둔다.
 */

let cachedConnected: boolean | null = null;
let initialized = false;

/** 앱 시작 시 1회 호출. 현재 상태를 읽고 변경 리스너를 건다. */
export function initNetworkStatus(): void {
  if (initialized) return;
  initialized = true;
  Network.getStatus()
    .then((s) => { cachedConnected = s.connected; })
    .catch(() => { /* 조회 실패 시 navigator.onLine 폴백에 맡긴다 */ });
  // 앱 생애주기 내내 유지되는 리스너 — 명시적으로 remove 하지 않는다.
  void Network.addListener('networkStatusChange', (s) => { cachedConnected = s.connected; });
}

/**
 * 동기 오프라인 판별.
 * 플러그인이 준 상태를 우선하고, 아직 없으면 navigator.onLine 으로 폴백한다.
 * 어느 쪽도 확신할 수 없으면 false(온라인으로 간주) — 오탐으로 네트워크 안내를 띄우지 않기 위함.
 */
export function isOffline(): boolean {
  if (cachedConnected !== null) return !cachedConnected;
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine === false;
  }
  return false;
}
