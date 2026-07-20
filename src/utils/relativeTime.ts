/**
 * "3분 전" 같은 상대 시각 표기. 친구 목록의 최근 접속 시간에 쓴다.
 *
 * 서버가 내려준 lastActiveAt 과 비교하므로 기기 시계가 아니라 보정된 서버 시각을 쓴다
 * (clock.ts serverNow — 기기 시계가 틀어져 있으면 "방금"이 "3시간 전"으로 보인다).
 */
import { serverNow } from '@/services/clock';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(at: number): string {
  if (!at) return '기록 없음';
  const diff = serverNow() - at;
  // 서버·클라 오차로 살짝 미래가 나올 수 있다. 음수는 '방금'으로 접는다.
  if (diff < 2 * MINUTE) return '방금';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`;
  if (diff < 30 * DAY) return `${Math.floor(diff / (7 * DAY))}주 전`;
  return `${Math.floor(diff / (30 * DAY))}달 전`;
}
