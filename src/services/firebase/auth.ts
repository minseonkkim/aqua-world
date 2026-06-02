import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './config';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase Auth가 설정되지 않았습니다.');
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

// ─── 카카오 로그인 (authorization code 리다이렉트 흐름) ──────────────────────
// SDK v2.0 부터 Kakao.Auth.login() 콜백 방식이 제거되고 Kakao.Auth.authorize() 만 남았다.
// 흐름: startKakaoLogin() → Kakao 로 리다이렉트 → 콜백 URL 에 ?code= 가 붙어 돌아옴
//      → App.tsx 에서 code 감지 → completeKakaoLogin(code) → 서버가 토큰 교환 → 진입.

interface KakaoSdk {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Auth: {
    authorize: (opts: { redirectUri: string; scope?: string; state?: string }) => void;
    logout: (cb?: () => void) => Promise<unknown> | void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

/** Kakao 가 정확히 매칭하는 redirect_uri (콘솔 등록값과 동일해야 함). */
export function kakaoRedirectUri(): string {
  return window.location.origin + '/';
}

function ensureKakaoReady(): KakaoSdk {
  const Kakao = window.Kakao;
  if (!Kakao) {
    throw new Error('Kakao SDK가 로드되지 않았습니다. 네트워크를 확인해주세요.');
  }
  const key = import.meta.env.VITE_KAKAO_JS_KEY;
  if (!key) {
    throw new Error('VITE_KAKAO_JS_KEY 환경변수가 설정되지 않았습니다.');
  }
  if (!Kakao.isInitialized()) Kakao.init(key);
  return Kakao;
}

/** Kakao 인증 페이지로 즉시 리다이렉트한다 (이후 코드는 실행되지 않음). */
export function startKakaoLogin(): void {
  const Kakao = ensureKakaoReady();
  Kakao.Auth.authorize({
    redirectUri: kakaoRedirectUri(),
    scope: 'profile_nickname,profile_image',
  });
}

/** Kakao 콜백에서 받은 `code` 를 서버에 보내 Firebase 세션을 연다. */
export async function completeKakaoLogin(code: string): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase Auth가 설정되지 않았습니다.');
  if (!functions) throw new Error('Firebase Functions가 설정되지 않았습니다.');

  const callable = httpsCallable<
    { code: string; redirectUri: string },
    { customToken: string; uid: string }
  >(functions, 'kakaoSignIn');
  const { data } = await callable({ code, redirectUri: kakaoRedirectUri() });

  const result = await signInWithCustomToken(auth, data.customToken);
  return result.user;
}

export async function signOut(): Promise<void> {
  if (!auth) return;
  // 카카오 SDK 세션도 같이 정리해 다음 로그인 시 계정 선택 화면이 정상 표시되게 한다.
  if (typeof window !== 'undefined' && window.Kakao?.isInitialized()) {
    try { window.Kakao.Auth.logout(); } catch { /* ignore */ }
  }
  await firebaseSignOut(auth);
}

export function onAuthChanged(callback: (user: FirebaseUser | null) => void): () => void {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}
