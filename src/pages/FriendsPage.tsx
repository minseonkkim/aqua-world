import React from 'react';

export default function FriendsPage() {
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">친구</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <span style={{ fontSize: 64 }}>👥</span>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>V1.1에서 오픈 예정</h2>
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>친구 수조 방문, 먹이 주기 등<br />소셜 기능이 곧 추가됩니다!</p>
      </div>
    </div>
  );
}
