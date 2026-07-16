/**
 * 로그인 실패 원인을 "사용자가 읽을 수 있는" 한국어 메시지로 변환한다.
 *
 * 배경: 네이티브 Google 로그인 / Firebase / Functions 는 실패를 원문 그대로 던진다.
 *  - Wi‑Fi·데이터가 꺼져 있으면 GMS INTERNAL_ERROR(8) 라 "internal" 토스트만 뜬다.
 *  - SHA / OAuth 설정 오류(DEVELOPER_ERROR=10)면 "...Play Console 확인" 같은 개발자용
 *    문구가 그대로 사용자에게 노출된다.
 * 원인을 특정할 수 있는 경우(특히 네트워크)엔 그 이유를 보여주고, 특정할 수 없으면
 * 담백한 일반 안내로 대체한다. 원문은 항상 console.error 로 남긴다(호출부 책임).
 */

import { isOffline } from '@/services/network';

export interface AuthErrorInfo {
  emoji: string;
  title: string;
  message: string;
  /** 네트워크(오프라인/타임아웃) 계열이면 true. */
  isNetwork: boolean;
}

function errCode(err: unknown): string {
  const c = (err as { code?: unknown })?.code;
  if (typeof c === 'string') return c;
  if (typeof c === 'number') return String(c);
  return '';
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  const m = (err as { message?: unknown })?.message;
  return typeof m === 'string' ? m : '';
}

/** 네트워크(오프라인/타임아웃) 계열인지 판별. */
function looksLikeNetwork(err: unknown): boolean {
  // OS/WebView 가 오프라인이라고 보고하면 코드와 무관하게 네트워크로 본다.
  // (@capacitor/network 실시간 상태 → navigator.onLine 폴백. Wi‑Fi·데이터 전체가
  //  꺼진 경우를 가장 확실하게 잡는 신호.)
  if (isOffline()) return true;

  const code = errCode(err).toLowerCase();
  const msg = errMessage(err).toLowerCase();

  // Firebase JS Auth / Cloud Functions 네트워크 코드
  if (
    code.includes('network-request-failed') ||
    code === 'functions/unavailable' ||
    code === 'functions/deadline-exceeded' ||
    code === 'unavailable' ||
    code === 'deadline-exceeded'
  ) return true;

  // Android GMS ApiException 상태코드: 7 NETWORK_ERROR, 15 TIMEOUT
  if (code === '7' || code === '15') return true;

  // 코드 없이 문자열만 오는 경우(네이티브 플러그인 등) 메시지 패턴으로 판별.
  return /network|offline|timed?\s*out|timeout|unreachable|no internet|internet connection|인터넷|네트워크|연결/.test(
    msg,
  );
}

/** 사용자가 직접 취소한 경우(팝업 닫기/뒤로가기 등) — 토스트를 띄우지 않아야 한다. */
export function isCancelError(err: unknown): boolean {
  const code = errCode(err);
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/popup-blocked' ||
    code === '12501' // GMS SIGN_IN_CANCELLED
  ) return true;
  return /cancel|사용자가 취소/i.test(errMessage(err));
}

// 계정 상태 등 알려진 Firebase Auth 코드 → 사람이 읽을 수 있는 안내.
const KNOWN_AUTH_MESSAGES: Record<string, string> = {
  'auth/too-many-requests': '요청이 너무 많아요. 잠시 후 다시 시도해주세요.',
  'auth/user-disabled': '사용이 정지된 계정이에요. 고객센터로 문의해주세요.',
  'auth/account-exists-with-different-credential':
    '이미 다른 방법으로 가입된 이메일이에요. 기존에 사용하던 로그인 방법으로 시도해주세요.',
  'auth/operation-not-allowed': '현재 이 로그인 방식을 사용할 수 없어요. 다른 방법으로 시도해주세요.',
};

/**
 * 로그인 에러를 모달에 바로 넣을 수 있는 형태로 변환한다.
 * @param providerLabel 'Google' | '카카오' 등 — 원인을 특정하지 못했을 때 제목에 쓴다.
 */
export function describeAuthError(err: unknown, providerLabel: string): AuthErrorInfo {
  // 1) 네트워크 — 실제 사용자에게 가장 흔한 원인. 오프라인이면 코드와 무관하게 이걸로.
  if (looksLikeNetwork(err)) {
    return {
      emoji: '📡',
      title: '인터넷 연결을 확인해주세요',
      message: 'Wi‑Fi나 데이터가 켜져 있는지 확인한 뒤 다시 시도해주세요.',
      isNetwork: true,
    };
  }

  const code = errCode(err);
  const msg = errMessage(err);

  // 2) 설정/버전 문제(DEVELOPER_ERROR=10 등) — 사용자가 Play Console 을 볼 수 없다.
  if (code === '10' || /developer_error|configuration|sha-?1|play console|oauth client/i.test(msg)) {
    return {
      emoji: '🛠️',
      title: '로그인 설정 오류',
      message: '앱을 최신 버전으로 업데이트한 뒤 다시 시도해주세요. 계속 실패하면 잠시 후 다시 시도해주세요.',
      isNetwork: false,
    };
  }

  // 3) 알려진 Firebase Auth 코드
  if (KNOWN_AUTH_MESSAGES[code]) {
    return {
      emoji: '⚠️',
      title: `${providerLabel} 로그인 실패`,
      message: KNOWN_AUTH_MESSAGES[code],
      isNetwork: false,
    };
  }

  // 4) 그 외 — 담백한 일반 안내. 원문은 dev 빌드에서만 덧붙여 디버깅을 돕는다.
  const detail = import.meta.env.DEV
    ? `\n\n(${err instanceof Error ? `${err.name}: ${err.message}` : String(err)})`
    : '';
  return {
    emoji: '⚠️',
    title: `${providerLabel} 로그인 실패`,
    message: `로그인 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.${detail}`,
    isNetwork: false,
  };
}
