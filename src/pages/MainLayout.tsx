import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import TankPage from './TankPage';
import CompendiumPage from './CompendiumPage';
import ShopPage from './ShopPage';
import FriendsPage from './FriendsPage';
import SettingsPage from './SettingsPage';

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

  return (
    <>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/tank" element={<TankPage />} />
          <Route path="/compendium" element={<CompendiumPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/tank" replace />} />
        </Routes>
      </div>

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
    </>
  );
}
