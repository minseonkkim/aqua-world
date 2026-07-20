/**
 * 친구 목록 캐시 (V1.1).
 *
 * persist 를 쓰지 않는다 — 친구의 "최근 접속" 과 요청함은 금방 낡는 데이터라
 * 오래된 값을 되살리면 오히려 틀린 화면을 보여준다. 탭을 오가는 동안만
 * 메모리에 들고 있다가, 화면 진입 시 서버에서 다시 받는다.
 */
import { create } from 'zustand';
import { listFriends, FriendListPayload } from '@/services/firebase/friends';
import { useUserStore } from './useUserStore';
import type { Friend, FriendProfile, FriendVisit } from '@/types';

interface FriendState {
  friends: Friend[];
  incoming: FriendProfile[];
  outgoing: FriendProfile[];
  visits: FriendVisit[];
  myCode: string;
  loading: boolean;
  /** 마지막 동기화 시각(unix ms). 0이면 아직 한 번도 못 받았다. */
  loadedAt: number;
  error: string | null;

  refresh: () => Promise<void>;
  apply: (payload: FriendListPayload) => void;
  /** 로그아웃 시 다른 계정에 이전 친구 목록이 비치지 않도록 비운다. */
  reset: () => void;
}

const EMPTY = {
  friends: [] as Friend[],
  incoming: [] as FriendProfile[],
  outgoing: [] as FriendProfile[],
  visits: [] as FriendVisit[],
  myCode: '',
  loadedAt: 0,
  error: null as string | null,
};

export const useFriendStore = create<FriendState>()((set, get) => ({
  ...EMPTY,
  loading: false,

  apply: payload =>
    set({
      friends: payload.friends ?? [],
      incoming: payload.incoming ?? [],
      outgoing: payload.outgoing ?? [],
      visits: payload.visits ?? [],
      myCode: payload.myCode ?? '',
      loadedAt: Date.now(),
      error: null,
    }),

  refresh: async () => {
    if (get().loading) return; // 중복 요청 방지 — 화면 진입과 당겨서 새로고침이 겹칠 수 있다
    set({ loading: true });
    try {
      get().apply(await listFriends());
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '친구 목록을 불러오지 못했습니다.' });
    } finally {
      set({ loading: false });
    }
  },

  reset: () => set({ ...EMPTY, loading: false }),
}));

// 활성 유저가 바뀌면(로그인/로그아웃/계정 전환) 캐시를 비운다. useNotificationStore 와
// 같은 방식 — 한 곳에서 처리해야 화면 코드에 초기화 로직이 흩어지지 않는다.
let lastUid = useUserStore.getState().user?.id ?? null;
useUserStore.subscribe(() => {
  const uid = useUserStore.getState().user?.id ?? null;
  if (uid === lastUid) return;
  lastUid = uid;
  useFriendStore.getState().reset();
});
