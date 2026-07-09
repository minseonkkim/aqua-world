import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import TankPage from './TankPage';
import CompendiumPage from './CompendiumPage';
import ShopPage from './ShopPage';
import FriendsPage from './FriendsPage';
import SettingsPage from './SettingsPage';
import PrivacyPage from './PrivacyPage';
import TermsPage from './TermsPage';
import { useUiStore } from '@/store/useUiStore';
// LicensesPage는 130KB 라이선스 JSON을 import하므로 lazy load
const LicensesPage = lazy(() => import('./LicensesPage'));

const TABS = [
  { path: '/tank', label: '수조', icon: '🐠' },
  { path: '/compendium', label: '도감', icon: '📖' },
  { path: '/shop', label: '상점', icon: '🛍️' },
  { path: '/friends', label: '친구', icon: '👥' },
  { path: '/settings', label: '설정', icon: '⚙️' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  // 전체화면 감상 모드에서는 하단 탭바까지 숨긴다.
  const immersive = useUiStore(s => s.immersive);

  return (
    <>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/tank" element={<TankPage />} />
          <Route path="/compendium" element={<CompendiumPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/licenses" element={
            <Suspense fallback={<div className="page"><div className="page-header">오픈소스 라이선스</div></div>}>
              <LicensesPage />
            </Suspense>
          } />
          <Route path="*" element={<Navigate to="/tank" replace />} />
        </Routes>
      </div>

      {!immersive && (
      <nav className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.path}
            className={`tab-item ${location.pathname === tab.path ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
      )}
    </>
  );
}
