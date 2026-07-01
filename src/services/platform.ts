import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function platformName(): 'web' | 'android' | 'ios' {
  const p = Capacitor.getPlatform();
  if (p === 'android' || p === 'ios') return p;
  return 'web';
}

/** 네이티브 앱이 OS 로부터 받을 커스텀 스킴 (AndroidManifest intent-filter 와 동일). */
export const NATIVE_OAUTH_SCHEME = 'aquaworld.app';
export const NATIVE_OAUTH_DEEPLINK = `${NATIVE_OAUTH_SCHEME}://oauth/kakao`;

/**
 * 카카오 콘솔에 등록 가능한 https Redirect URI.
 * 카카오는 커스텀 스킴 등록을 막아두므로, Firebase Hosting 의 1줄짜리 중계 페이지가
 * ?code=... 를 받자마자 `aquaworld.app://oauth/kakao?code=...` 로 다시 보낸다.
 *
 * 배포 후 Firebase 콘솔 → Hosting → 도메인 확인하고 환경변수로 덮어쓰기 가능.
 * (기본값은 .firebaserc 의 default 프로젝트 ID 기반)
 */
const DEFAULT_BRIDGE = 'https://aquaworld-bf2f4.web.app/oauth/kakao.html';
export const KAKAO_NATIVE_REDIRECT_BRIDGE: string =
  (import.meta.env.VITE_KAKAO_NATIVE_REDIRECT as string | undefined) || DEFAULT_BRIDGE;
