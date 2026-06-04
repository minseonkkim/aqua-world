import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported,
  Messaging,
} from 'firebase/messaging';
import { httpsCallable } from 'firebase/functions';
import { app, functions, firebaseConfig, vapidKey, isConfigured } from './config';
import { useNotificationStore } from '@/store/useNotificationStore';
import { isNative } from '@/services/platform';
import type { PluginListenerHandle } from '@capacitor/core';

/**
 * 푸시 메시징.
 * - 웹: FCM Web Push (Notification API + Service Worker + vite-plugin-pwa 와 분리된 firebase-messaging-sw.js)
 * - 네이티브(Capacitor): @capacitor/push-notifications → FCM Android 토큰
 * 두 경로 모두 같은 `registerPushToken` Callable 로 서버 등록 → admin SDK 가
 * `sendEachForMulticast` 에서 토큰 형식에 따라 자동 라우팅한다.
 */

let messaging: Messaging | null = null;
let foregroundUnsub: (() => void) | null = null;
let nativeListeners: PluginListenerHandle[] = [];
let nativeToken: string | null = null;

type CapPushNotifications = typeof import('@capacitor/push-notifications').PushNotifications;
// Capacitor 플러그인은 Proxy 라서 직접 Promise 해석 값으로 두면 await 시 internal
// thenable 체크가 `proxy.then()` 을 호출 → "is not implemented on android" 예외 발생.
// 반드시 wrapper 객체로 감싸 우회한다.
let pushPluginCache: { plugin: CapPushNotifications } | null = null;
async function loadPushPlugin(): Promise<{ plugin: CapPushNotifications }> {
  if (!pushPluginCache) {
    const m = await import('@capacitor/push-notifications');
    pushPluginCache = { plugin: m.PushNotifications };
  }
  return pushPluginCache;
}

export async function isPushSupported(): Promise<boolean> {
  if (!isConfigured || !app) return false;
  if (isNative()) return true;
  if (!vapidKey) return false;
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/** 현재 푸시 권한 상태. 동기/sync 호출 측을 위해 best-effort 로 반환. */
export function pushPermission(): NotificationPermission | 'unsupported' {
  if (isNative()) {
    // 네이티브에선 비동기 plugin API 만 정확하지만, 토글 초기화용 best-effort 로 토큰 보유 여부 반영
    return nativeToken ? 'granted' : 'default';
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/** 비동기 정확 권한 조회 (UI 마운트 시 hydrate 용). */
export async function getPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (isNative()) {
    try {
      const { plugin: Plugin } = await loadPushPlugin();
      const { receive } = await Plugin.checkPermissions();
      if (receive === 'granted') return 'granted';
      if (receive === 'denied') return 'denied';
      return 'default';
    } catch {
      return 'unsupported';
    }
  }
  return pushPermission();
}

function getMessagingInstance(): Messaging | null {
  if (!app) return null;
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

async function registerMessagingSW(): Promise<ServiceWorkerRegistration> {
  const q = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${q.toString()}`);
}

async function sendTokenToServer(token: string): Promise<void> {
  if (!functions) return;
  await httpsCallable(functions, 'registerPushToken')({ token });
}

async function removeTokenFromServer(token: string): Promise<void> {
  if (!functions) return;
  try {
    await httpsCallable(functions, 'unregisterPushToken')({ token });
  } catch {
    // 이미 등록 해제됐거나 네트워크 실패 — 무시
  }
}

/**
 * 푸시 권한 요청 → 토큰 발급 → 서버 등록. 성공 시 토큰 반환, 실패/거부 시 null.
 */
export async function enablePush(): Promise<string | null> {
  if (!(await isPushSupported())) return null;
  if (isNative()) return enablePushNative();
  return enablePushWeb();
}

async function enablePushWeb(): Promise<string | null> {
  const m = getMessagingInstance();
  if (!m || !functions) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const swReg = await registerMessagingSW();
  const token = await getToken(m, { vapidKey, serviceWorkerRegistration: swReg });
  if (!token) return null;

  await sendTokenToServer(token);
  listenForeground();
  return token;
}

async function ensureNativeChannel(Plugin: CapPushNotifications): Promise<void> {
  try {
    await Plugin.createChannel({
      id: 'aquaworld_default',
      name: 'AquaWorld 알림',
      description: '부화·성장·일일 보상 알림',
      importance: 4, // IMPORTANCE_HIGH — 헤드업 표시
      visibility: 1,
      lights: true,
      vibration: true,
    });
  } catch {
    // iOS 또는 이미 등록된 채널 — 무시
  }
}

async function enablePushNative(): Promise<string | null> {
  const { plugin: Plugin } = await loadPushPlugin();
  await ensureNativeChannel(Plugin);
  let { receive } = await Plugin.checkPermissions();
  if (receive !== 'granted') {
    const req = await Plugin.requestPermissions();
    receive = req.receive;
  }
  if (receive !== 'granted') return null;

  let settled = false;
  let resolveToken!: (v: string | null) => void;
  const tokenPromise = new Promise<string | null>(r => { resolveToken = r; });
  const settle = (value: string | null) => {
    if (settled) return;
    settled = true;
    resolveToken(value);
  };

  // 리스너는 register() 호출 전에 반드시 attach 가 완료되어야 함 (race condition 방지)
  const regHandle = await Plugin.addListener('registration', async (t: { value: string }) => {
    nativeToken = t.value;
    try {
      await sendTokenToServer(t.value);
    } catch {
      // 서버 등록 실패해도 토큰은 받았으니 그대로 반환 — 재시도는 다음 enablePush 호출에서
    } finally {
      settle(t.value);
    }
  });
  const errHandle = await Plugin.addListener('registrationError', () => settle(null));
  nativeListeners.push(regHandle, errHandle);

  attachNativeListeners();

  const timeoutId = setTimeout(() => settle(null), 15000);
  try {
    await Plugin.register();
  } catch {
    settle(null);
  }

  const token = await tokenPromise;
  clearTimeout(timeoutId);
  return token;
}

/** 토큰 삭제 + 서버 해제. */
export async function disablePush(): Promise<void> {
  if (isNative()) return disablePushNative();
  return disablePushWeb();
}

async function disablePushWeb(): Promise<void> {
  const m = getMessagingInstance();
  if (!m) return;
  try {
    const swReg = await registerMessagingSW();
    const token = await getToken(m, { vapidKey, serviceWorkerRegistration: swReg });
    if (token) {
      await removeTokenFromServer(token);
    }
    await deleteToken(m);
  } catch {
    // 토큰이 이미 없거나 권한 미부여 — 무시
  }
  foregroundUnsub?.();
  foregroundUnsub = null;
}

async function disablePushNative(): Promise<void> {
  if (nativeToken) {
    await removeTokenFromServer(nativeToken);
    nativeToken = null;
  }
  await detachNativeListeners();
}

/** 앱이 포그라운드일 때 도착한 웹 푸시 메시지를 인앱 알림함에 적재. */
export function listenForeground(): void {
  if (isNative()) {
    attachNativeListeners();
    return;
  }
  const m = getMessagingInstance();
  if (!m || foregroundUnsub) return;
  foregroundUnsub = onMessage(m, payload => {
    const n = payload.notification;
    if (!n) return;
    useNotificationStore.getState().push({
      id: `push_${payload.messageId ?? Date.now()}`,
      type: (payload.data?.type as 'growth' | 'hatch' | 'daily') ?? 'hatch',
      emoji: payload.data?.emoji ?? '🔔',
      title: n.title ?? 'AquaWorld',
      body: n.body ?? undefined,
    });
  });
}

let nativeListenersAttached = false;
function attachNativeListeners(): void {
  if (nativeListenersAttached) return;
  nativeListenersAttached = true;
  loadPushPlugin().then(({ plugin: Plugin }) => {
    Plugin.addListener('pushNotificationReceived', notification => {
      const data = (notification.data ?? {}) as Record<string, string | undefined>;
      useNotificationStore.getState().push({
        id: `push_${notification.id ?? Date.now()}`,
        type: (data.type as 'growth' | 'hatch' | 'daily') ?? 'hatch',
        emoji: data.emoji ?? '🔔',
        title: notification.title ?? 'AquaWorld',
        body: notification.body ?? undefined,
      });
    }).then(h => nativeListeners.push(h));

    Plugin.addListener('pushNotificationActionPerformed', action => {
      const data = (action.notification.data ?? {}) as Record<string, string | undefined>;
      const link = data.link || '/';
      try {
        // HashRouter 사용 — 해시 경로로 이동시키면 라우터가 처리
        if (typeof window !== 'undefined') {
          window.location.hash = link.startsWith('/') ? `#${link}` : `#/${link}`;
        }
      } catch {
        // ignore
      }
    }).then(h => nativeListeners.push(h));
  }).catch(() => {
    nativeListenersAttached = false;
  });
}

async function detachNativeListeners(): Promise<void> {
  await Promise.all(nativeListeners.map(h => h.remove().catch(() => undefined)));
  nativeListeners = [];
  nativeListenersAttached = false;
}
