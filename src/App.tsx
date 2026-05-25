import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { onAuthChanged } from '@/services/firebase/auth';
import { useFirestoreSync } from '@/hooks/useFirestoreSync';
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
  const { isAuthenticated, isLoading, setLoading, claimDailyLogin } = useUserStore();
  useFirestoreSync();

  useEffect(() => {
    const { isAuthenticated: auth } = useUserStore.getState();

    if (!auth) {
      setLoading(false);
      return;
    }

    // 재방문 유저: 수조 없으면 생성
    const { tanks, addTank } = useTankStore.getState();
    if (tanks.length === 0) {
      addTank(createDefaultTank());
    }

    claimDailyLogin();
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Firebase 세션 만료/로그아웃 감지 — 소셜 로그인 유저만 처리
  useEffect(() => {
    const unsubscribe = onAuthChanged(firebaseUser => {
      if (firebaseUser) return;
      const { isAuthenticated: auth, user } = useUserStore.getState();
      if (auth && user && !user.id.startsWith('guest_')) {
        useUserStore.getState().setUser(null);
        useTankStore.getState().setTanks([]);
      }
    });
    return unsubscribe;
  }, []);

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
