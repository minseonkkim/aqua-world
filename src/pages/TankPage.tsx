import React, { useState } from 'react';
import TankScene from '@/components/3d/TankScene';
import { useUserStore } from '@/store/useUserStore';
import { TankEnvironment } from '@/types';

export default function TankPage() {
  const { user, addPearl, recordFeed } = useUserStore();
  const [env] = useState<TankEnvironment>('coral_reef');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const handleFeed = () => {
    if (!recordFeed()) { showToast('오늘 먹이주기를 모두 사용했습니다 🐟'); return; }
    addPearl(10);
    showToast('+10 🪙 Pearl 획득!');
  };

  const remaining = 3 - (user?.feedCountToday ?? 0);

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#000' }}>
      {/* 3D 수조 */}
      <TankScene environment={env} style={{ position: 'absolute', inset: 0 }} />

      {/* 상단 HUD */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 'calc(var(--safe-top) + 12px) 12px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="currency-pill">🪙 {user?.pearl ?? 0}</div>
          <div className="currency-pill">🌸 {user?.starCoral ?? 0}</div>
        </div>
        <div className="currency-pill" style={{ color: 'var(--color-accent)' }}>Lv.{user?.level ?? 1}</div>
      </div>

      {/* 우측 액션 버튼 */}
      <div style={{ position: 'absolute', right: 12, bottom: 80, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { icon: '🍖', label: `먹이\n${remaining}/3`, action: handleFeed },
          { icon: '🪴', label: '꾸미기', action: () => showToast('Phase 2에서 오픈 예정!') },
          { icon: '📷', label: '포토', action: () => showToast('Phase 2에서 오픈 예정!') },
        ].map(btn => (
          <button key={btn.icon} onClick={btn.action} style={{
            background: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: '8px 12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            border: '1px solid rgba(255,255,255,0.15)', minWidth: 60, color: '#fff',
            fontSize: 10, whiteSpace: 'pre-line', textAlign: 'center',
          }}>
            <span style={{ fontSize: 22 }}>{btn.icon}</span>
            {btn.label}
          </button>
        ))}
      </div>

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '10px 20px',
          borderRadius: 20, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>{toast}</div>
      )}
    </div>
  );
}
