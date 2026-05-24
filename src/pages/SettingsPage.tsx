import React, { useState } from 'react';
import { useUserStore } from '@/store/useUserStore';

export default function SettingsPage() {
  const { user, setUser } = useUserStore();
  const [sound, setSound] = useState(true);
  const [bgm, setBgm] = useState(true);
  const [notif, setNotif] = useState(true);

  const handleLogout = () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    setUser(null);
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? 'var(--color-accent)' : 'var(--color-surface)',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: value ? 22 : 2, width: 20, height: 20,
        borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
      }} />
    </div>
  );

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 15 }}>{label}</span>
      {children}
    </div>
  );

  const Section = ({ title }: { title: string }) => (
    <p style={{ color: 'var(--color-text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, padding: '16px 16px 6px' }}>{title}</p>
  );

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">설정</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-surface)', margin: '0 16px', borderRadius: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🐟</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{user?.displayName || '게스트'}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Lv.{user?.level ?? 1} · Pearl {user?.pearl ?? 0} · Star Coral {user?.starCoral ?? 0}</div>
        </div>
      </div>

      <Section title="사운드" />
      <div style={{ background: 'var(--color-surface)', margin: '0 16px', borderRadius: 12, overflow: 'hidden' }}>
        <Row label="효과음"><Toggle value={sound} onChange={setSound} /></Row>
        <Row label="배경음악 (BGM)"><Toggle value={bgm} onChange={setBgm} /></Row>
      </div>

      <Section title="알림" />
      <div style={{ background: 'var(--color-surface)', margin: '0 16px', borderRadius: 12, overflow: 'hidden' }}>
        <Row label="푸시 알림"><Toggle value={notif} onChange={setNotif} /></Row>
      </div>

      <Section title="정보" />
      <div style={{ background: 'var(--color-surface)', margin: '0 16px', borderRadius: 12, overflow: 'hidden' }}>
        <Row label="버전"><span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>1.0.0</span></Row>
        <Row label="개인정보처리방침">
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>›</span>
        </Row>
        <Row label="이용약관">
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>›</span>
        </Row>
        <Row label="오픈소스 라이선스">
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>›</span>
        </Row>
      </div>

      <Section title="계정" />
      <div style={{ background: 'var(--color-surface)', margin: '0 16px', borderRadius: 12, overflow: 'hidden' }}>
        <div onClick={handleLogout} style={{ padding: '14px 16px', color: '#ff6b6b', cursor: 'pointer', fontSize: 15 }}>로그아웃</div>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}
