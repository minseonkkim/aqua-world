import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { useModalStore } from '@/store/useModalStore';
import { signInWithGoogle, startKakaoLogin } from '@/services/firebase/auth';
import { loadUserTanks } from '@/services/firebase/firestore';
import { bootstrapUser, claimDailyReward, reconcileFish } from '@/services/firebase/functions';
import { analytics, identifyUser, setUserProps } from '@/services/analytics';
import { isNative } from '@/services/platform';
import { Tank } from '@/types';
import { DailyRewardResult } from '@/store/useUserStore';

const AppleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.05 12.04c-.03-3.02 2.47-4.47 2.58-4.55-1.41-2.06-3.6-2.34-4.38-2.37-1.86-.19-3.63 1.1-4.58 1.1-.95 0-2.4-1.07-3.95-1.04-2.03.03-3.91 1.18-4.96 3-2.11 3.66-.54 9.07 1.52 12.04 1.01 1.45 2.21 3.08 3.78 3.02 1.52-.06 2.09-.98 3.93-.98 1.83 0 2.36.98 3.96.95 1.64-.03 2.67-1.48 3.67-2.94 1.16-1.69 1.64-3.33 1.66-3.41-.04-.02-3.18-1.22-3.21-4.82zM14.06 3.6c.84-1.02 1.41-2.43 1.25-3.84-1.21.05-2.67.8-3.54 1.82-.78.9-1.46 2.34-1.28 3.72 1.35.1 2.73-.69 3.57-1.7z" />
  </svg>
);

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

const KakaoLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.79 1.86 5.24 4.66 6.63-.18.6-.66 2.2-.76 2.54-.12.42.16.42.32.3.13-.09 2.05-1.4 2.88-1.97.95.14 1.93.22 2.9.22 5.523 0 10-3.477 10-7.72S17.523 3 12 3z" />
  </svg>
);

function createDefaultTank(): Tank {
  return {
    id: 'tank_default',
    name: '나의 수조',
    environment: 'coral_reef',
    fish: [],
    decorations: [],
    cleanliness: 100,
    lightMode: 'auto',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  // signIn() 이 성공해 실제 계정 bootstrap 이 진행 중일 때만 true.
  // 팝업/외부 브라우저를 사용자가 그냥 닫고 돌아온 경우와 구분하기 위함.
  const bootstrappingRef = useRef(false);
  const { setUser, claimDailyLogin, setPendingReward } = useUserStore();
  const { tanks, addTank, setTanks } = useTankStore();

  // OAuth(구글 팝업 / 카카오 Custom Tab 등)로 떠난 뒤 사용자가 로그인을 끝내지 않고
  // 창을 닫거나 앱으로 돌아오면, signInWithPopup 의 reject 가 누락되거나(COOP 정책)
  // 카카오 Custom Tab 닫힘에 콜백이 없어 로딩이 영원히 풀리지 않는다.
  // 앱 창이 다시 보이거나 포커스를 받으면 로딩을 해제한다.
  // 단, signIn 성공 후 bootstrap 진행 중(bootstrappingRef)일 때는 풀지 않는다 —
  // 성공 시엔 곧 user 가 채워져 MainLayout 으로 라우팅되며 이 컴포넌트가 사라진다.
  useEffect(() => {
    const restore = () => {
      if (document.visibilityState === 'visible' && !bootstrappingRef.current) {
        setLoading(false);
      }
    };
    document.addEventListener('visibilitychange', restore);
    window.addEventListener('focus', restore);
    return () => {
      document.removeEventListener('visibilitychange', restore);
      window.removeEventListener('focus', restore);
    };
  }, []);

  // 소셜 로그인 공통: signIn 콜백으로 Firebase 진입 → bootstrap → tanks 로드 → 일일보상.
  const handleSocialLogin = async (
    providerLabel: string,
    signIn: () => Promise<{ uid: string }>,
    silentErrorCodes: string[] = [],
  ) => {
    setLoading(true);
    try {
      const firebaseUser = await signIn();
      // 여기까지 왔으면 인증 성공 → 창 복귀(focus/visible) 시 로딩을 풀지 않도록 잠근다.
      bootstrappingRef.current = true;

      // bootstrapUser는 idempotent — 신규면 생성하고 튜토리얼 알을 발급,
      // 기존이면 그대로 반환(미발급 계정엔 한 번만 튜토리얼 알 지급).
      const [res, firestoreTanks] = await Promise.all([
        bootstrapUser(),
        loadUserTanks(firebaseUser.uid),
      ]);
      setUser(res.user);
      const loadedTanks = firestoreTanks.length > 0 ? firestoreTanks : res.tank ? [res.tank] : [];
      // 항상 setTanks 로 덮어쓴다 — 게스트로 먼저 플레이했을 때 남은 activeTankId('tank_default')
      // 잔재를 지우기 위함. 그대로 두면 다른 유저 탱크로 요청해 "본인 수조가 아닙니다" 가 난다.
      setTanks(loadedTanks);
      // 과거 클라-only 이동으로 생긴 손상(수조 초과·중복) 보정 (idempotent)
      if (loadedTanks[0]) reconcileFish({ tankId: loadedTanks[0].id }).catch(() => {});

      // 일일 로그인 보상 (서버 검증)
      const daily = await claimDailyReward();
      if (daily.reward) setPendingReward(daily.reward as DailyRewardResult);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code && silentErrorCodes.includes(code)) {
        return;
      }
      console.error(`[${providerLabel} Login]`, err);
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      await useModalStore.getState().alert({
        emoji: '⚠️',
        title: `${providerLabel} 로그인 실패`,
        message: `${msg}\n\n(DevTools 콘솔에서 자세한 스택을 확인하세요)`,
        tone: 'danger',
      });
    } finally {
      bootstrappingRef.current = false;
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // App.tsx onAuthChanged 가 login/sign_up 이벤트를 발화할 때 참조하는 플래그.
    sessionStorage.setItem('aw:auth_action', 'google');
    return handleSocialLogin('Google', signInWithGoogle, [
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/popup-blocked',
    ]).catch(() => sessionStorage.removeItem('aw:auth_action'));
  };

  // 카카오는 리다이렉트 흐름 — 즉시 페이지가 카카오로 떠나므로 try/catch 가 의미 없다.
  // SDK 초기화 실패만 잡아 모달로 보여준다. 콜백 후 토큰 교환은 App.tsx 에서 처리.
  const handleKakaoLogin = async () => {
    try {
      setLoading(true);
      sessionStorage.setItem('aw:auth_action', 'kakao');
      await startKakaoLogin();
    } catch (err) {
      sessionStorage.removeItem('aw:auth_action');
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      void useModalStore.getState().alert({
        emoji: '⚠️',
        title: '카카오 로그인 실패',
        message: msg,
        tone: 'danger',
      });
    }
  };

  const guestLogin = async () => {
    // 소셜 로그인 bootstrap 이 진행 중이면 게스트 생성으로 상태가 꼬이지 않게 막는다.
    if (bootstrappingRef.current) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));

    const guestId = 'guest_' + Date.now();
    // 게스트는 Firebase Auth 를 거치지 않아 onAuthChanged 가 발화되지 않는다 → 여기서 직접 처리.
    identifyUser(guestId);
    setUserProps({ account_type: 'guest', level: 1, provider: 'guest' });
    analytics.signUp('guest');

    setUser({
      id: guestId,
      displayName: '게스트',
      email: '',
      pearl: 200,
      starCoral: 20,
      level: 1,
      experience: 0,
      loginStreak: 0,
      lastLoginAt: 0,
      createdAt: Date.now(),
      tanks: [],
      inventory: [],
      collectedSpecies: [],
      feedCountToday: 0,
      lastFeedResetAt: Date.now(),
      feedTickets: 0,
      tutorialStep: 0,
    });

    if (tanks.length === 0) addTank(createDefaultTank());
    claimDailyLogin();
    setLoading(false);
  };

  const comingSoon = (name: string) =>
    useModalStore.getState().alert({
      emoji: '🚧',
      title: '준비 중',
      message: `${name} 로그인은 곧 지원됩니다.`,
      tone: 'info',
    });

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: '48px 32px', background: 'var(--color-bg)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 80 }}>🌊</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: 2 }}>AquaWorld</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>나만의 3D 수족관</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto', marginBottom: 40 }}>
        {/* <button className="btn" style={{ background: '#000', color: '#fff', gap: 10 }} onClick={() => comingSoon('Apple')} disabled={loading}>
          <AppleLogo />
          Apple로 계속하기
        </button> */}
        <button className="btn" style={{ background: '#fff', color: '#1f1f1f', gap: 10 }} onClick={handleGoogleLogin} disabled={loading}>
          <GoogleLogo />
          Google로 계속하기
        </button>
        <button className="btn" style={{ background: '#FEE500', color: '#191919', gap: 10 }} onClick={handleKakaoLogin} disabled={loading}>
          <KakaoLogo />
          카카오로 계속하기
        </button>
        {/* 게스트 로그인은 웹에서만 노출.
            네이티브 앱(Capacitor)에서는 서버 미동기화로 데이터 유실·추적 단절 우려가 있어 숨김. */}
        {!isNative() && (
          <button className="btn btn-ghost" onClick={guestLogin} disabled={loading}>
            {loading ? '로딩...' : '게스트로 시작 (Pearl 200 지급)'}
          </button>
        )}
      </div>

      <p style={{ textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: 12, lineHeight: 1.6 }}>
        계속 진행하면{' '}
        <button
          type="button"
          onClick={() => navigate('/terms')}
          style={{
            background: 'transparent', border: 'none', padding: 0,
            color: 'var(--color-primary-light)', textDecoration: 'underline',
            fontSize: 12, cursor: 'pointer',
          }}
        >
          이용약관
        </button>
        {' 및 '}
        <button
          type="button"
          onClick={() => navigate('/privacy')}
          style={{
            background: 'transparent', border: 'none', padding: 0,
            color: 'var(--color-primary-light)', textDecoration: 'underline',
            fontSize: 12, cursor: 'pointer',
          }}
        >
          개인정보처리방침
        </button>
        에 동의합니다.
      </p>
    </div>
  );
}
