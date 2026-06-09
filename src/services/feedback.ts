import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/config';
import { platformName, isNative } from './platform';

/** 앱 버전 — package.json 의 version 과 동기화해 유지한다. */
export const APP_VERSION = '1.0.0';

export type FeedbackType = 'bug' | 'suggestion' | 'other';

/**
 * 피드백과 함께 자동 첨부되는 클라이언트 환경 정보.
 * 버그 재현·분류에 필요한 최소 정보만 수집한다(개인정보 아님).
 */
export interface ClientMeta {
  platform: string; // web | android | ios
  native: boolean;
  appVersion: string;
  route: string; // 제출 시점 화면(라우트)
  userAgent: string;
  language: string;
  screen: string; // WxH@dpr
}

export function collectClientMeta(): ClientMeta {
  const w = typeof window !== 'undefined' ? window : undefined;
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  return {
    platform: platformName(),
    native: isNative(),
    appVersion: APP_VERSION,
    route: w ? w.location.hash || w.location.pathname : '',
    userAgent: nav ? nav.userAgent : '',
    language: nav ? nav.language : '',
    screen: w && w.screen ? `${w.screen.width}x${w.screen.height}@${w.devicePixelRatio || 1}` : '',
  };
}

/**
 * 인앱 피드백 전송. 서버(submitFeedback)가 feedback 컬렉션에 적재한다.
 * 게스트(미인증)도 보낼 수 있다. 오프라인/미설정 환경에서는 사용 불가.
 */
export async function submitFeedback(input: {
  type: FeedbackType;
  message: string;
  contact?: string;
}): Promise<void> {
  if (!functions) throw new Error('지금은 의견을 보낼 수 없어요 (오프라인 모드).');
  const fn = httpsCallable<
    { type: FeedbackType; message: string; contact?: string; meta: ClientMeta },
    { ok: boolean }
  >(functions, 'submitFeedback');
  await fn({ ...input, meta: collectClientMeta() });
}
