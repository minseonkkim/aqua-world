import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { Browser } from '@capacitor/browser';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, functions } from './config';
import { isNative, KAKAO_NATIVE_REDIRECT_BRIDGE } from '../platform';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase Auth가 설정되지 않았습니다.');
  if (isNative()) {
    // WebView 안의 signInWithRedirect 는 storage-partitioning 때문에 실기기에서 깨진다
    // (missing initial state). 네이티브 Google Sign-In 으로 ID 토큰을 받아
    // Firebase JS SDK 에 credential 로 직접 로그인한다.
    let credential;
    try {
      ({ credential } = await FirebaseAuthentication.signInWithGoogle());
    } catch (err) {
      // 사용자가 계정 선택 시트를 닫은 경우 — 웹 popup-closed 와 동일 코드로 매핑해
      // LoginPage 가 조용히 무시(모달 없이)하도록 한다.
      const msg = err instanceof Error ? err.message : String(err);
      if (/cancel/i.test(msg)) {
        throw Object.assign(new Error(msg), { code: 'auth/popup-closed-by-user' });
      }
      throw err;
    }
    const idToken = credential?.idToken;
    if (!idToken) throw new Error('Google ID 토큰을 받지 못했습니다.');
    const googleCredential = GoogleAuthProvider.credential(idToken, credential?.accessToken);
    const result = await signInWithCredential(auth, googleCredential);
    return result.user;
  }
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
  // 네이티브: 카카오 콘솔에 커스텀 스킴 등록이 막혀 있어 https 중계 페이지를 거친다.
  //          중계 페이지(Firebase Hosting)가 ?code=... 를 받자마자 app.aquaworld:// 로 다시 던진다.
  // 웹: 현재 origin / (Kakao 콘솔에 등록된 값).
  if (isNative()) return KAKAO_NATIVE_REDIRECT_BRIDGE;
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

/** Kakao 인증 페이지로 이동한다. 웹은 같은 탭 리다이렉트, 네이티브는 외부 브라우저 오픈. */
export async function startKakaoLogin(): Promise<void> {
  if (isNative()) {
    // 네이티브: Kakao SDK 의 authorize 가 location.href 를 바꾸는 방식이라 WebView 안에서는
    // 콜백을 받기 어렵다. 직접 OAuth URL 을 만들어 외부 브라우저(Custom Tabs)로 띄우고,
    // redirect 는 app.aquaworld://oauth/kakao 로 받아 App URL listener 가 처리한다.
    const key = import.meta.env.VITE_KAKAO_REST_API_KEY || import.meta.env.VITE_KAKAO_JS_KEY;
    if (!key) {
      throw new Error('VITE_KAKAO_REST_API_KEY 또는 VITE_KAKAO_JS_KEY 환경변수가 설정되지 않았습니다.');
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: key,
      redirect_uri: kakaoRedirectUri(),
      scope: 'profile_nickname profile_image',
    });
    const url = `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
    await Browser.open({ url, presentationStyle: 'popover' });
    return;
  }
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
  // 네이티브 Google 세션도 정리 — 안 하면 다음 로그인에서 계정 선택 없이 자동 재로그인된다.
  if (isNative()) {
    try { await FirebaseAuthentication.signOut(); } catch { /* ignore */ }
  }
  await firebaseSignOut(auth);
}

export function onAuthChanged(callback: (user: FirebaseUser | null) => void): () => void {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}
