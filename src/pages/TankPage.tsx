import React, { useState } from 'react';
import TankScene from '@/components/3d/TankScene';
import DailyRewardModal from '@/components/DailyRewardModal';
import IncubatorPanel from '@/components/IncubatorPanel';
import FishInfoCard from '@/components/FishInfoCard';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { Fish, TankEnvironment } from '@/types';

export default function TankPage() {
  const { user, addPearl, recordFeed, pendingDailyReward } = useUserStore();
  const { tanks, activeTankId } = useTankStore();
  const [toast, setToast] = useState('');
  const [selectedFish, setSelectedFish] = useState<Fish | null>(null);

  const activeTank = tanks.find(t => t.id === activeTankId);
  const environment: TankEnvironment = activeTank?.environment ?? 'coral_reef';
  const fishInTank = activeTank?.fish ?? [];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
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
      <TankScene
        environment={environment}
        fish={fishInTank}
        onFishClick={setSelectedFish}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* 상단 HUD */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: 'calc(var(--safe-top) + 12px) 12px 8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="currency-pill">🪙 {user?.pearl ?? 0}</div>
          <div className="currency-pill">🌸 {user?.starCoral ?? 0}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {fishInTank.length > 0 && (
            <div className="currency-pill" style={{ color: 'var(--color-secondary)' }}>
              🐟 {fishInTank.length}
            </div>
          )}
          <div className="currency-pill" style={{ color: 'var(--color-accent)' }}>
            Lv.{user?.level ?? 1}
          </div>
        </div>
      </div>

      {/* 인큐베이터 패널 (왼쪽 하단) */}
      <IncubatorPanel onHatchSuccess={showToast} />

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

      {/* 빈 수조 안내 */}
      {fishInTank.length === 0 && (
        <div style={{
          position: 'absolute', bottom: 140, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.65)', borderRadius: 16, padding: '12px 20px',
          fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          🛒 상점에서 알을 구매해 물고기를 키워보세요!
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '10px 20px',
          borderRadius: 20, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none',
          zIndex: 100,
        }}>
          {toast}
        </div>
      )}

      {/* 일일 보상 팝업 */}
      {pendingDailyReward && <DailyRewardModal reward={pendingDailyReward} />}

      {/* 물고기 정보 카드 */}
      {selectedFish && <FishInfoCard fish={selectedFish} onClose={() => setSelectedFish(null)} />}
    </div>
  );
}
