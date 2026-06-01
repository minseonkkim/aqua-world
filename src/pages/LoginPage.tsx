import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { useModalStore } from '@/store/useModalStore';
import { signInWithGoogle } from '@/services/firebase/auth';
import { loadUserFromFirestore, loadUserTanks } from '@/services/firebase/firestore';
import { bootstrapUser, claimDailyReward } from '@/services/firebase/functions';
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
  const { setUser, claimDailyLogin, setPendingReward } = useUserStore();
  const { tanks, addTank, setTanks } = useTankStore();

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const firebaseUser = await signInWithGoogle();

      // 기존 유저인지 Firestore에서 확인
      const [firestoreUser, firestoreTanks] = await Promise.all([
        loadUserFromFirestore(firebaseUser.uid),
        loadUserTanks(firebaseUser.uid),
      ]);

      if (firestoreUser) {
        // 기존 유저: Firestore 데이터 복원
        setUser(firestoreUser);
        if (firestoreTanks.length > 0) {
          setTanks(firestoreTanks);
        }
      } else {
        // 신규 유저: 서버(Cloud Functions)에서 생성 — 시작 재화·수조를 서버가 고정
        const res = await bootstrapUser();
        setUser(res.user);
        if (res.tank) setTanks([res.tank]);
      }

      // 일일 로그인 보상 (서버 검증)
      const daily = await claimDailyReward();
      if (daily.reward) setPendingReward(daily.reward as DailyRewardResult);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const SILENT_CODES = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/popup-blocked'];
      if (code && SILENT_CODES.includes(code)) {
        return;
      }
      console.error('[Google Login]', err);
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      await useModalStore.getState().alert({
        emoji: '⚠️',
        title: 'Google 로그인 실패',
        message: `${msg}\n\n(DevTools 콘솔에서 자세한 스택을 확인하세요)`,
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const guestLogin = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));

    setUser({
      id: 'guest_' + Date.now(),
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
      flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '48px 32px', background: 'var(--color-bg)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 80 }}>🌊</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: 2 }}>AquaWorld</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>나만의 3D 수족관</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn" style={{ background: '#000', color: '#fff', gap: 10 }} onClick={() => comingSoon('Apple')} disabled={loading}>
          <AppleLogo />
          Apple로 계속하기
        </button>
        <button className="btn" style={{ background: '#fff', color: '#1f1f1f', gap: 10 }} onClick={handleGoogleLogin} disabled={loading}>
          <GoogleLogo />
          Google로 계속하기
        </button>
        <button className="btn" style={{ background: '#FEE500', color: '#191919', gap: 10 }} onClick={() => comingSoon('카카오')} disabled={loading}>
          <KakaoLogo />
          카카오로 계속하기
        </button>
        <button className="btn btn-ghost" onClick={guestLogin} disabled={loading}>
          {loading ? '로딩...' : '게스트로 시작 (Pearl 200 지급)'}
        </button>
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
