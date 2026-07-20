/**
 * 친구 시스템 콜러블 래퍼 (V1.1).
 *
 * functions.ts 의 `call` 헬퍼는 응답의 user/tank 를 내 스토어에 권위로 반영한다.
 * 친구 함수 대부분은 "남의" 데이터를 돌려주므로 그 헬퍼를 쓰면 안 된다 —
 * 친구 수조를 내 수조 스토어에 덮어쓰는 사고가 난다. 그래서 여기서는 직접 호출하고,
 * 내 문서가 실제로 바뀌는 경로(redeemInvite, getFriendTank 의 방문 보상)만
 * 명시적으로 스토어에 반영한다.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from './config';
import { useUserStore } from '@/store/useUserStore';
import { syncServerClock } from '@/services/clock';
import { FunctionsUnavailableError } from './functions';
import type {
  Friend,
  FriendProfile,
  FriendRelation,
  FriendTraceType,
  FriendVisit,
  Tank,
  User,
} from '@/types';

interface WithServerTime {
  serverTime?: number;
}

/**
 * 친구 함수 공용 호출기 — 서버 클럭만 동기화하고 스토어는 건드리지 않는다.
 * serverTime 은 모든 응답에 붙으므로 제약 대신 교차 타입으로 얹는다
 * (제약으로 두면 선택 속성뿐인 WithServerTime 이 weak type 검사에 걸린다).
 */
function callFriend<TData, TResult>(name: string) {
  return async (data?: TData): Promise<TResult & WithServerTime> => {
    if (!functions) throw new FunctionsUnavailableError();
    const fn = httpsCallable<TData, TResult & WithServerTime>(functions, name);
    const res = await fn(data as TData);
    if (typeof res.data.serverTime === 'number') syncServerClock(res.data.serverTime);
    return res.data;
  };
}

// ─── 친구 코드 / 검색 ───────────────────────────────────────────────────────

export const getMyFriendCode = callFriend<void, { code: string }>('getMyFriendCode');

export const findUserByFriendCode = callFriend<
  { code: string },
  { profile: FriendProfile; relation: FriendRelation }
>('findUserByFriendCode');

// ─── 요청 / 목록 ────────────────────────────────────────────────────────────

export const sendFriendRequest = callFriend<
  { code: string },
  { status: 'requested' | 'friend' }
>('sendFriendRequest');

export const respondFriendRequest = callFriend<
  { fromUid: string; accept: boolean },
  { status: 'friend' | 'declined' }
>('respondFriendRequest');

export const removeFriend = callFriend<{ friendUid: string }, { status: 'removed' }>(
  'removeFriend',
);

export interface FriendListPayload {
  friends: Friend[];
  incoming: FriendProfile[];
  outgoing: FriendProfile[];
  visits: FriendVisit[];
  myCode: string;
}
export const listFriends = callFriend<void, FriendListPayload>('listFriends');

// ─── 수조 방문 / 흔적 ───────────────────────────────────────────────────────

export interface FriendTankPayload {
  tank: Tank;
  owner: FriendProfile;
  /** 오늘 이 친구를 처음 방문했을 때만 0보다 크다. */
  pearlReward: number;
  tracedToday: boolean;
}

/**
 * 친구 수조를 읽기 전용으로 가져온다.
 * 방문 보상 Pearl 은 내 재화가 실제로 늘어난 것이므로 상단 바가 즉시 따라오도록 반영한다.
 */
export async function getFriendTank(friendUid: string): Promise<FriendTankPayload> {
  const res = await callFriend<{ friendUid: string }, FriendTankPayload>('getFriendTank')({
    friendUid,
  });
  if (res.pearlReward > 0) {
    const prev = useUserStore.getState().user;
    if (prev) useUserStore.getState().setUser({ ...prev, pearl: prev.pearl + res.pearlReward });
  }
  return res;
}

export const sendFriendTrace = callFriend<
  { friendUid: string; type: FriendTraceType },
  { status: 'ok'; type: FriendTraceType; fed?: { fishName: string; speciesId: string } }
>('sendFriendTrace');

// ─── 초대 보상 ──────────────────────────────────────────────────────────────

/**
 * 초대 코드를 입력해 양쪽에 희귀 알을 지급받는다.
 * 서버가 내 user 문서를 바꾸므로(알 지급 + invitedBy) 권위 상태를 스토어에 반영한다.
 * tutorialStep / decorationInventory 는 클라 UI 권위라 functions.ts 와 동일하게 보존한다.
 */
export async function redeemInvite(code: string): Promise<{ inviterUid: string }> {
  const res = await callFriend<
    { code: string },
    { user: User; inviterUid: string }
  >('redeemInvite')({ code });
  const prev = useUserStore.getState().user;
  useUserStore.getState().setUser(
    prev
      ? { ...res.user, tutorialStep: prev.tutorialStep, decorationInventory: prev.decorationInventory }
      : res.user,
  );
  return { inviterUid: res.inviterUid };
}

// ─── 친구 코드 표기 ─────────────────────────────────────────────────────────

/** 6자리 코드를 3-3 으로 끊어 읽기 쉽게 만든다. 예: 7F3K2M → 7F3 K2M */
export function formatFriendCode(code: string): string {
  if (code.length !== 6) return code;
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/** 초대 링크. HashRouter 라 경로가 `#/` 아래에 있다. */
export function inviteUrl(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/invite/${code}?utm_source=invite&utm_medium=share`;
}
