import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { playSFX } from '@/services/audio';
import { useUserStore } from './useUserStore';

// 'visit' — 친구가 내 수조에 흔적(하트/먹이)을 남긴 알림 (V1.1)
export type NotificationType = 'growth' | 'hatch' | 'daily' | 'reengage' | 'visit';

export interface AppNotification {
  id: string; // 고유 + 중복 방지 키
  type: NotificationType;
  emoji: string;
  title: string;
  body?: string;
  createdAt: number;
  read: boolean;
}

const MAX_NOTIFICATIONS = 50;

interface NotificationState {
  /**
   * uid 별 알림함. 알림은 FCM 푸시/인앱 이벤트로 쌓이는 기기 로컬 데이터지만,
   * 한 기기를 여러 계정(게스트 포함)이 쓰므로 유저별로 분리 보관한다.
   * 그래야 다른 계정으로 로그인하면 그 계정의 알림 목록이 뜬다.
   */
  byUser: Record<string, AppNotification[]>;
  /** 현재 활성 유저 id. 유저 스토어를 구독해 자동으로 따라간다(로그아웃 시 null). */
  activeUserId: string | null;
  /** 활성 유저의 알림 목록 — byUser[activeUserId] 의 미러. 컴포넌트는 이 필드만 구독한다. */
  notifications: AppNotification[];

  /** 활성 유저 전환. 해당 유저의 알림함을 노출한다(내부용 — 유저 스토어 구독이 호출). */
  _switchUser: (uid: string | null) => void;
  /** 같은 id가 이미 있으면 무시. 최신순으로 앞에 추가하고 최대 개수로 잘라낸다. */
  push: (n: Omit<AppNotification, 'createdAt' | 'read'>) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
}

const listFor = (byUser: Record<string, AppNotification[]>, uid: string | null) =>
  uid ? byUser[uid] ?? [] : [];

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      byUser: {},
      activeUserId: null,
      notifications: [],

      _switchUser: uid =>
        set(state => ({ activeUserId: uid, notifications: listFor(state.byUser, uid) })),

      push: n => {
        const { activeUserId, byUser } = get();
        if (!activeUserId) return; // 활성 유저가 없으면(로그아웃 등) 적재할 대상이 없다
        const current = byUser[activeUserId] ?? [];
        if (current.some(x => x.id === n.id)) return;
        const entry: AppNotification = { ...n, createdAt: Date.now(), read: false };
        const next = [entry, ...current].slice(0, MAX_NOTIFICATIONS);
        set({ byUser: { ...byUser, [activeUserId]: next }, notifications: next });
        playSFX('notify');
      },

      markAllRead: () => {
        const { activeUserId, byUser } = get();
        if (!activeUserId) return;
        const current = byUser[activeUserId] ?? [];
        const next = current.map(x => (x.read ? x : { ...x, read: true }));
        set({ byUser: { ...byUser, [activeUserId]: next }, notifications: next });
      },

      remove: id => {
        const { activeUserId, byUser } = get();
        if (!activeUserId) return;
        const next = (byUser[activeUserId] ?? []).filter(x => x.id !== id);
        set({ byUser: { ...byUser, [activeUserId]: next }, notifications: next });
      },

      clearAll: () => {
        const { activeUserId, byUser } = get();
        if (!activeUserId) return;
        set({ byUser: { ...byUser, [activeUserId]: [] }, notifications: [] });
      },
    }),
    {
      name: 'aquaworld-notifications',
      // 유저별 버킷만 영속화. activeUserId/notifications 는 런타임에 유저 스토어를 따라 채워진다.
      partialize: state => ({ byUser: state.byUser }),
    },
  ),
);

// 활성 유저(useUserStore.user)를 따라가며 알림함을 전환한다. 이 한 곳이 로그인/로그아웃/
// 계정 전환/새로고침 복원을 모두 커버하므로, 화면 코드에 알림 초기화 로직을 흩뿌릴 필요가 없다.
function syncActiveUser() {
  const uid = useUserStore.getState().user?.id ?? null;
  if (uid === useNotificationStore.getState().activeUserId) return;
  useNotificationStore.getState()._switchUser(uid);
}
useUserStore.subscribe(syncActiveUser);
// 부팅 시 이미 rehydrate 된 게스트를 1회 반영(구독은 이후 변경에만 발화하므로).
syncActiveUser();
