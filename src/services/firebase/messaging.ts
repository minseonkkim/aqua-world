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

/**
 * 웹 푸시(FCM) 연결. vite-plugin-pwa의 Workbox SW와 충돌하지 않도록
 * FCM 전용 서비스워커(firebase-messaging-sw.js)를 별도 스코프로 등록한다.
 * Firebase 설정값은 정적 SW에 빌드 주입이 불가능하므로 쿼리스트링으로 전달한다.
 */

let messaging: Messaging | null = null;
let foregroundUnsub: (() => void) | null = null;

export async function isPushSupported(): Promise<boolean> {
  if (!isConfigured || !app || !vapidKey) return false;
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
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

/**
 * 푸시 권한 요청 → 토큰 발급 → 서버 등록. 성공 시 토큰 반환, 실패/거부 시 null.
 */
export async function enablePush(): Promise<string | null> {
  if (!(await isPushSupported())) return null;
  const m = getMessagingInstance();
  if (!m || !functions) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const swReg = await registerMessagingSW();
  const token = await getToken(m, { vapidKey, serviceWorkerRegistration: swReg });
  if (!token) return null;

  await httpsCallable(functions, 'registerPushToken')({ token });
  listenForeground();
  return token;
}

/** 토큰 삭제 + 서버 해제. */
export async function disablePush(): Promise<void> {
  const m = getMessagingInstance();
  if (!m) return;
  try {
    const swReg = await registerMessagingSW();
    const token = await getToken(m, { vapidKey, serviceWorkerRegistration: swReg });
    if (token && functions) {
      await httpsCallable(functions, 'unregisterPushToken')({ token });
    }
    await deleteToken(m);
  } catch {
    // 토큰이 이미 없거나 권한 미부여 — 무시
  }
  foregroundUnsub?.();
  foregroundUnsub = null;
}

/** 앱이 포그라운드일 때 도착한 메시지를 인앱 알림함에 적재. */
export function listenForeground(): void {
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

/** 현재 브라우저 푸시 권한 상태. */
export function pushPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}
