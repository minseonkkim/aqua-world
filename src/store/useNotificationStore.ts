import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationType = 'growth' | 'hatch' | 'daily';

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
  notifications: AppNotification[];
  /** 같은 id가 이미 있으면 무시. 최신순으로 앞에 추가하고 최대 개수로 잘라낸다. */
  push: (n: Omit<AppNotification, 'createdAt' | 'read'>) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],

      push: n => {
        if (get().notifications.some(x => x.id === n.id)) return;
        const entry: AppNotification = { ...n, createdAt: Date.now(), read: false };
        set(state => ({
          notifications: [entry, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
        }));
      },

      markAllRead: () =>
        set(state => ({
          notifications: state.notifications.map(x => (x.read ? x : { ...x, read: true })),
        })),

      remove: id =>
        set(state => ({ notifications: state.notifications.filter(x => x.id !== id) })),

      clearAll: () => set({ notifications: [] }),
    }),
    { name: 'aquaworld-notifications' },
  ),
);
