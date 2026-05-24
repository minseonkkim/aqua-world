import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import MainLayout from '@/pages/MainLayout';
import OnboardingPage from '@/pages/OnboardingPage';
import LoginPage from '@/pages/LoginPage';

export default function App() {
  const { isAuthenticated, isLoading } = useUserStore();

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
    </div>
  );
}
