import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore, DailyRewardResult } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { onAuthChanged } from '@/services/firebase/auth';
import { useFirestoreSync } from '@/hooks/useFirestoreSync';
import { claimDailyReward } from '@/services/firebase/functions';
import { loadUserFromFirestore, loadUserTanks } from '@/services/firebase/firestore';
import { isConfigured } from '@/services/firebase/config';
import { isPushSupported, listenForeground, pushPermission } from '@/services/firebase/messaging';
import MainLayout from '@/pages/MainLayout';
import OnboardingPage from '@/pages/OnboardingPage';
import LoginPage from '@/pages/LoginPage';
import Modal from '@/components/Modal';
import PWAPrompts from '@/components/PWAPrompts';

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

  // 이미 푸시를 허용한 유저는 앱 진입 시 포그라운드 수신 리스너 재연결
  useEffect(() => {
    if (pushPermission() !== 'granted') return;
    isPushSupported().then(ok => { if (ok) listenForeground(); });
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
        // 새로고침 등으로 스토어가 비어있으면 서버(Firestore)에서 권위 데이터 복원
        if (!current || current.id !== firebaseUser.uid) {
          try {
            const [fsUser, fsTanks] = await Promise.all([
              loadUserFromFirestore(firebaseUser.uid),
              loadUserTanks(firebaseUser.uid),
            ]);
            if (fsUser) {
              store.setUser(fsUser);
              useTankStore.getState().setTanks(fsTanks.length ? fsTanks : [createDefaultTank()]);
              const daily = await claimDailyReward();
              if (daily.reward) store.setPendingReward(daily.reward as DailyRewardResult);
            }
          } catch {
            // 네트워크 오류 시 로그인 화면 유지
          }
        }
      } else if (current && !current.id.startsWith('guest_')) {
        // 클라우드 유저 로그아웃/세션 만료 → 클리어
        store.setUser(null);
        useTankStore.getState().setTanks([]);
      } else if (current) {
        // 게스트: 로컬 유지 + 일일 보상 체크
        store.claimDailyLogin();
      }

      setLoading(false);
    });
    return unsubscribe;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
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
              <Route path="*" element={<Navigate to="/onboarding" replace />} />
            </>
          )}
        </Routes>
      </HashRouter>
      <Modal />
      <PWAPrompts />
    </div>
  );
}
