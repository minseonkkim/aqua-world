/**
 * 서버-클라이언트 시계 동기화.
 *
 * 부화 완료 판정은 서버(hatchEgg)가 권위인데, UI 는 기기의 Date.now() 로 "수확!" 버튼을
 * 노출 여부를 정한다. 기기 시계가 서버보다 앞서 있으면(에뮬레이터/시간 자동설정 꺼진 기기)
 * UI 는 완료로 보지만 서버는 거절 → "아직 부화하지 않았습니다" 토스트가 뜬다.
 * 광고로 hatchDuration 이 1초까지 줄면 판정 경계가 부화 시작 직후가 되어 이 오차가 항상 노출된다.
 *
 * 해결: 서버 응답에 담긴 serverTime 으로 오프셋을 잡고, readiness 계산은 serverNow() 를 쓴다.
 * 오프셋에는 편도 네트워크 지연이 섞이지만(수백 ms 수준), serverNow() 가 서버 시각을 살짝
 * 적게 보는 보수적 방향이라 "UI 가 서버보다 먼저 완료로 판단"하는 일은 생기지 않는다.
 */

// clientReceive - serverTime. 양수면 기기 시계가 서버보다 앞서 있다는 뜻.
let clockOffsetMs = 0;

/** 서버 응답의 serverTime(ms) 으로 클럭 오프셋을 갱신한다. */
export function syncServerClock(serverTime: number): void {
  if (typeof serverTime !== 'number' || !Number.isFinite(serverTime)) return;
  clockOffsetMs = Date.now() - serverTime;
}

/** 서버 시각 추정치(ms). 부화 완료 등 서버 권위 시간 판정은 이 값을 기준으로 한다. */
export function serverNow(): number {
  return Date.now() - clockOffsetMs;
}
