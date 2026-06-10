// 일일 리셋(먹이/로그인 보상 등) 판정은 항상 KST(Asia/Seoul) 자정 기준으로 한다.
// 서버(Cloud Functions, UTC 런타임)와 클라(브라우저 로컬 TZ)가 각자 다른 타임존으로
// '날짜'를 비교하면 일일 카운터가 어긋난다(예: KST 00:00~09:00 구간에 클라는 새 날,
// 서버는 전날 → "오늘 먹이 소진" 거절). 한국은 DST가 없어 고정 +9h 오프셋이 안전하다.
// functions/index.js 의 isNewDay 와 반드시 동일한 규칙을 유지할 것.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** lastMs 와 nowMs 가 KST 기준으로 서로 다른 날짜이면 true. */
export function isNewDayKst(lastMs: number, nowMs: number): boolean {
  const a = new Date(lastMs + KST_OFFSET_MS);
  const b = new Date(nowMs + KST_OFFSET_MS);
  return (
    a.getUTCFullYear() !== b.getUTCFullYear() ||
    a.getUTCMonth() !== b.getUTCMonth() ||
    a.getUTCDate() !== b.getUTCDate()
  );
}
