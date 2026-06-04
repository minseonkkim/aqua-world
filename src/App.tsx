import React, { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore, DailyRewardResult } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { onAuthChanged, completeKakaoLogin, consumePendingRedirectResult } from '@/services/firebase/auth';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { isNative } from '@/services/platform';
import { useModalStore } from '@/store/useModalStore';
import { useFirestoreSync } from '@/hooks/useFirestoreSync';
import { bootstrapUser, claimDailyReward, reconcileFish } from '@/services/firebase/functions';
import { loadUserTanks } from '@/services/firebase/firestore';
import { isConfigured } from '@/services/firebase/config';
import { isPushSupported, listenForeground, pushPermission } from '@/services/firebase/messaging';
import MainLayout from '@/pages/MainLayout';
import OnboardingPage from '@/pages/OnboardingPage';
import LoginPage from '@/pages/LoginPage';
import PrivacyPage from '@/pages/PrivacyPage';
import TermsPage from '@/pages/TermsPage';
import Modal from '@/components/Modal';
import PWAPrompts from '@/components/PWAPrompts';
import { unlockAudio } from '@/services/audio';
import { analytics, identifyUser, setUserProps } from '@/services/analytics';
import '@/store/useAudioStore'; // 영속 설정 복원 (rehydrate)

function createDefaultTank() {
  return {
    id: 'tank_default',
    name: '나의 수조',
    environment: 'coral_reef' as const,
    fish: [],
    decorations: [],
    cleanliness: 100,
    lightMode: 'auto' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export default function App() {
  const { isAuthenticated, isLoading, setLoading } = useUserStore();
  useFirestoreSync();

  // 카카오 콜백 동기 감지 — 첫 렌더 전에 결정해야 onboarding 깜빡임이 없다.
  // ?code= 가 URL 에 있으면 토큰 교환 → 인증 완료까지 스플래시를 유지한다.
  const [kakaoInFlight, setKakaoInFlight] = useState(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return p.has('code') || p.has('error');
  });

  // 인증 완료(=user 스토어 채워짐)되면 자연스럽게 게이트 해제 → MainLayout 으로 라우팅.
  useEffect(() => {
    if (kakaoInFlight && isAuthenticated) setKakaoInFlight(false);
  }, [kakaoInFlight, isAuthenticated]);

  // 카카오 OAuth 콜백 처리.
  // Kakao 가 ?code=...(+state, error) 를 붙여 redirectUri 로 돌려보내면, 우선 URL 에서 제거하고
  // 서버에 code 를 보내 access_token 교환 + Custom Token 발급 → signInWithCustomToken.
  // 이후의 bootstrap / daily reward 는 아래 onAuthChanged 가 자동으로 처리한다.
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const oauthError = url.searchParams.get('error');
    const errorDesc = url.searchParams.get('error_description');
    if (!code && !oauthError) return;

    // URL 정리 (StrictMode 더블 마운트 시 두 번째 effect 에서는 code 가 없어 그대로 종료)
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    window.history.replaceState({}, '', url.toString());

    if (oauthError) {
      void useModalStore.getState().alert({
        emoji: '⚠️',
        title: '카카오 로그인 취소',
        message: `${oauthError}: ${errorDesc || '사용자가 동의하지 않았거나 인증이 중단되었습니다.'}`,
        tone: 'info',
      });
      setKakaoInFlight(false);
      return;
    }

    setLoading(true);
    completeKakaoLogin(code!).catch(err => {
      console.error('[Kakao callback]', err);
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      void useModalStore.getState().alert({
        emoji: '⚠️',
        title: '카카오 로그인 실패',
        message: msg,
        tone: 'danger',
      });
      setLoading(false);
      setKakaoInFlight(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Capacitor (네이티브) 전용: 딥링크로 돌아온 OAuth code 수신 + Google redirect 결과 회수.
  useEffect(() => {
    if (!isNative()) return;
    void consumePendingRedirectResult();
    const sub = CapApp.addListener('appUrlOpen', ({ url: deeplink }) => {
      // 예: app.aquaworld://oauth/kakao?code=abcd...
      try {
        const u = new URL(deeplink);
        const code = u.searchParams.get('code');
        const oauthError = u.searchParams.get('error');
        if (!code && !oauthError) return;
        void Browser.close().catch(() => undefined);
        if (oauthError) {
          void useModalStore.getState().alert({
            emoji: '⚠️',
            title: '카카오 로그인 취소',
            message: oauthError,
            tone: 'info',
          });
          return;
        }
        setKakaoInFlight(true);
        setLoading(true);
        completeKakaoLogin(code!).catch(err => {
          console.error('[Kakao deeplink]', err);
          setLoading(false);
          setKakaoInFlight(false);
        });
      } catch (e) {
        console.warn('[appUrlOpen] parse fail', e);
      }
    });
    return () => {
      void sub.then(s => s.remove());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 이미 푸시를 허용한 유저는 앱 진입 시 포그라운드 수신 리스너 재연결
  useEffect(() => {
    if (pushPermission() !== 'granted') return;
    isPushSupported().then(ok => { if (ok) listenForeground(); });
  }, []);

  // 로그인 완료 직후 백그라운드 프리페치 — three.js + GLB(Draco) 디코더 + 모델을
  // 사용자가 /tank 로 이동하기 전에 캐시에 올려둔다. 동적 import 라 비로그인 번들에는 포함되지 않음.
  const preloadedRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || preloadedRef.current) return;
    preloadedRef.current = true;
    void import('@/utils/fishModelLoader').then(m => m.preloadFishModels()).catch(() => {});
    void import('@/utils/decorationModelLoader').then(m => m.preloadDecorationModels()).catch(() => {});
  }, [isAuthenticated]);

  // 앱 진입 1회 — Analytics 가 isSupported() 통과 후 채워지므로
  // 다음 틱에서 호출해도 인스턴스가 있을 가능성이 더 높다.
  useEffect(() => {
    const t = setTimeout(() => analytics.appOpen(), 0);
    return () => clearTimeout(t);
  }, []);

  // 첫 사용자 입력에서 오디오 unlock + BGM 시작 (iOS/Android 자동재생 정책)
  useEffect(() => {
    const onGesture = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      window.removeEventListener('touchstart', onGesture);
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    window.addEventListener('touchstart', onGesture);
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      window.removeEventListener('touchstart', onGesture);
    };
  }, []);

  useEffect(() => {
    // Firebase 미설정: 게스트 전용 환경. 로컬 캐시로 복원된 게스트만 처리.
    if (!isConfigured) {
      const store = useUserStore.getState();
      if (store.user) store.claimDailyLogin();
      setLoading(false);
      return;
    }

    // 클라우드 유저는 localStorage에 남지 않으므로, Firebase 세션을 기준으로 복원한다.
    const unsubscribe = onAuthChanged(async firebaseUser => {
      const store = useUserStore.getState();
      const current = store.user;

      if (firebaseUser) {
        // 새로고침 등으로 스토어가 비어있으면 서버(권위)에서 복원
        if (!current || current.id !== firebaseUser.uid) {
          try {
            const [res, fsTanks] = await Promise.all([
              bootstrapUser(),
              loadUserTanks(firebaseUser.uid),
            ]);
            store.setUser(res.user);
            const tanks = fsTanks.length
              ? fsTanks
              : res.tank ? [res.tank] : [createDefaultTank()];
            useTankStore.getState().setTanks(tanks);
            // 과거 클라-only 이동으로 생긴 손상(수조 초과·중복) 보정 (idempotent)
            if (tanks[0]) reconcileFish({ tankId: tanks[0].id }).catch(() => {});
            const daily = await claimDailyReward();
            if (daily.reward) store.setPendingReward(daily.reward as DailyRewardResult);

            // Analytics: 사용자 식별 + 가입/로그인 구분.
            // identify 는 새로고침 세션 복원에서도 매번 호출(이후 이벤트 attribution 용).
            // login/sign_up 은 LoginPage 가 sessionStorage 에 심어둔 플래그가 있을 때만 — 즉,
            // 사용자가 이번 세션에서 직접 로그인 버튼을 눌렀을 때만 1회 발화한다.
            identifyUser(firebaseUser.uid);
            const provider = firebaseUser.uid.startsWith('kakao:')
              ? 'kakao'
              : (firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'kakao');
            setUserProps({
              account_type: 'cloud',
              level: res.user.level ?? 1,
              provider,
            });
            const authAction = sessionStorage.getItem('aw:auth_action');
            if (authAction === 'google' || authAction === 'kakao') {
              sessionStorage.removeItem('aw:auth_action');
              if (res.created) analytics.signUp(authAction);
              else analytics.login(authAction);
            }
          } catch {
            // 네트워크 오류 시 로그인 화면 유지
          }
        }
      } else if (current && !current.id.startsWith('guest_')) {
        // 클라우드 유저 로그아웃/세션 만료 → 클리어
        store.setUser(null);
        useTankStore.getState().setTanks([]);
        identifyUser(null);
      } else if (current) {
        // 게스트: 로컬 유지 + 일일 보상 체크
        store.claimDailyLogin();
      }

      setLoading(false);
    });
    return unsubscribe;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || kakaoInFlight) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 64 }}>🌊</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <HashRouter>
        <Routes>
          {isAuthenticated ? (
            <Route path="/*" element={<MainLayout />} />
          ) : (
            <>
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="*" element={<Navigate to="/onboarding" replace />} />
            </>
          )}
        </Routes>
      </HashRouter>
      <Modal />
      {import.meta.env.VITE_TARGET !== 'capacitor' && <PWAPrompts />}
    </div>
  );
}
