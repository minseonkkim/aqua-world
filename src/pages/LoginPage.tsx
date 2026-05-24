import React, { useState } from 'react';
import { useUserStore } from '@/store/useUserStore';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { setUser } = useUserStore();

  const guestLogin = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    setUser({
      id: 'guest_' + Date.now(),
      displayName: '게스트',
      email: '',
      pearl: 100,
      starCoral: 10,
      level: 1,
      experience: 0,
      loginStreak: 0,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
      tanks: [],
      inventory: [],
      collectedSpecies: [],
      feedCountToday: 0,
      lastFeedResetAt: Date.now(),
    });
    setLoading(false);
  };

  const comingSoon = (name: string) => alert(`${name} 로그인은 곧 지원됩니다.`);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 32px', background: 'var(--color-bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 80 }}>🌊</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: 2 }}>AquaWorld</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>나만의 3D 수족관</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { label: '🍎  Apple로 계속하기', bg: '#000', color: '#fff', action: () => comingSoon('Apple') },
          { label: '🔵  Google로 계속하기', bg: 'var(--color-surface)', color: '#fff', action: () => comingSoon('Google') },
          { label: '💛  카카오로 계속하기', bg: '#FEE500', color: '#3C1E1E', action: () => comingSoon('카카오') },
        ].map(btn => (
          <button key={btn.label} className="btn" style={{ background: btn.bg, color: btn.color }} onClick={btn.action}>
            {btn.label}
          </button>
        ))}
        <button className="btn btn-ghost" onClick={guestLogin} disabled={loading}>
          {loading ? '로딩...' : '게스트로 시작'}
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
