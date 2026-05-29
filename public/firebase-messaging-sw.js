/* AquaWorld 백그라운드 푸시 서비스워커 (FCM 전용)
 *
 * vite-plugin-pwa가 생성하는 Workbox SW와 별개로, FCM은 이 파일을
 * 자체 스코프(/firebase-cloud-messaging-push-scope)에 등록한다.
 * Firebase 설정값은 정적 파일에 빌드 시 주입할 수 없으므로,
 * 앱이 SW를 등록할 때 쿼리스트링으로 넘긴 값을 읽어 초기화한다.
 */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

const params = new URL(self.location).searchParams;
const config = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (config.projectId && config.messagingSenderId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    const data = payload.data || {};
    self.registration.showNotification(n.title || '🐠 AquaWorld', {
      body: n.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'aquaworld',
      data,
    });
  });
}

// 알림 클릭 시 앱 열기/포커스
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    }),
  );
});
