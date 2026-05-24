import React, { useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { signInWithGoogle } from '@/services/firebase/auth';
import { loadUserFromFirestore, loadUserTanks, saveUserToFirestore, saveTankToFirestore } from '@/services/firebase/firestore';
import { Tank } from '@/types';

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
  const [loading, setLoading] = useState(false);
  const { setUser, claimDailyLogin } = useUserStore();
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
        } else if (tanks.length === 0) {
          const defaultTank = createDefaultTank();
          addTank(defaultTank);
          await saveTankToFirestore(defaultTank, firebaseUser.uid);
        }
      } else {
        // 신규 유저: 기본값으로 생성 후 Firestore에 저장
        const newUser = {
          id: firebaseUser.uid,
          displayName: firebaseUser.displayName ?? 'AquaWorld 유저',
          email: firebaseUser.email ?? '',
          photoURL: firebaseUser.photoURL ?? undefined,
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
        };
        const defaultTank = createDefaultTank();

        setUser(newUser);
        addTank(defaultTank);

        await Promise.all([
          saveUserToFirestore(newUser),
          saveTankToFirestore(defaultTank, firebaseUser.uid),
        ]);
      }

      claimDailyLogin();
    } catch (err) {
      console.error('[Google Login]', err);
      alert('Google 로그인에 실패했습니다. 다시 시도해주세요.');
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
    });

    if (tanks.length === 0) addTank(createDefaultTank());
    claimDailyLogin();
    setLoading(false);
  };

  const comingSoon = (name: string) => alert(`${name} 로그인은 곧 지원됩니다.`);

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
        <button className="btn" style={{ background: '#000', color: '#fff' }} onClick={() => comingSoon('Apple')} disabled={loading}>
          🍎  Apple로 계속하기
        </button>
        <button className="btn" style={{ background: 'var(--color-surface)', color: '#fff' }} onClick={handleGoogleLogin} disabled={loading}>
          🔵  Google로 계속하기
        </button>
        <button className="btn" style={{ background: '#FEE500', color: '#3C1E1E' }} onClick={() => comingSoon('카카오')} disabled={loading}>
          💛  카카오로 계속하기
        </button>
        <button className="btn btn-ghost" onClick={guestLogin} disabled={loading}>
          {loading ? '로딩...' : '🐟 게스트로 시작 (Pearl 200 지급)'}
        </button>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: 12, lineHeight: 1.6 }}>
        계속 진행하면{' '}
        <span style={{ color: 'var(--color-primary-light)', textDecoration: 'underline' }}>이용약관</span>
        {' 및 '}
        <span style={{ color: 'var(--color-primary-light)', textDecoration: 'underline' }}>개인정보처리방침</span>
        에 동의합니다.
      </p>
    </div>
  );
}
