import React, { useState, useEffect, useMemo } from 'react';
import TankScene from '@/components/3d/TankScene';
import DailyRewardModal from '@/components/DailyRewardModal';
import IncubatorPanel from '@/components/IncubatorPanel';
import FishInfoCard from '@/components/FishInfoCard';
import HatchAnimationModal from '@/components/HatchAnimationModal';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { useFishStore } from '@/store/useFishStore';
import { Fish, TankEnvironment, EggTier } from '@/types';

interface PendingHatch {
  speciesId: string;
  eggTier: EggTier;
}

export default function TankPage() {
  const { user, addPearl, recordFeed, pendingDailyReward, collectHatchedEgg, addCollectedSpecies } = useUserStore();
  const { tanks, activeTankId, addFishToTank, feedFish, tickFishGrowth } = useTankStore();
  const { getSpeciesById } = useFishStore();
  const [toast, setToast] = useState('');
  const [selectedFishId, setSelectedFishId] = useState<string | null>(null);
  const [pendingHatch, setPendingHatch] = useState<PendingHatch | null>(null);

  const activeTank = tanks.find(t => t.id === activeTankId);
  const environment: TankEnvironment = activeTank?.environment ?? 'coral_reef';
  const fishInTank = activeTank?.fish ?? [];

  const selectedFish = useMemo(
    () => fishInTank.find(f => f.id === selectedFishId) ?? null,
    [fishInTank, selectedFishId],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // 주기적 성장 틱 (30초마다)
  useEffect(() => {
    if (!activeTankId) return;
    const tick = () => {
      const advancedIds = tickFishGrowth(activeTankId);
      if (advancedIds.length > 0) {
        const names = advancedIds
          .map(id => fishInTank.find(f => f.id === id)?.name)
          .filter(Boolean)
          .join(', ');
        if (names) showToast(`🌱 ${names} 성장!`);
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [activeTankId, tickFishGrowth, fishInTank]);

  const handleFeed = () => {
    if (!recordFeed()) { showToast('오늘 먹이주기를 모두 사용했습니다 🐟'); return; }
    addPearl(10);
    showToast('+10 🪙 Pearl 획득!');
  };

  const handleFeedFish = (fish: Fish) => {
    if (!activeTankId) return;
    if (fish.growthStage === 'large') {
      showToast('이미 최대 성장 단계입니다');
      return;
    }
    if (!recordFeed()) {
      showToast('오늘 먹이주기를 모두 사용했습니다 🐟');
      return;
    }
    addPearl(10);
    const result = feedFish(activeTankId, fish.id);
    if (result?.newStage) {
      showToast(`🌱 ${fish.name} → ${stageLabel(result.newStage)} 성장!`);
    } else {
      showToast(`🍖 +5분 성장 가속 · +10 🪙`);
    }
  };

  const handleHatchCollect = (eggId: string, eggTier: EggTier) => {
    const speciesId = collectHatchedEgg(eggId);
    if (!speciesId) return;
    setPendingHatch({ speciesId, eggTier });
  };

  const finalizeHatch = () => {
    if (!pendingHatch || !activeTank) {
      setPendingHatch(null);
      return;
    }
    const species = getSpeciesById(pendingHatch.speciesId);
    const name = species?.name ?? '???';
    const now = Date.now();
    const newFish: Fish = {
      id: `fish_${now}_${Math.random().toString(36).slice(2)}`,
      speciesId: pendingHatch.speciesId,
      name,
      growthStage: 'fry',
      growthProgress: 0,
      mood: 'happy',
      feedCount: 0,
      lastFedAt: 0,
      acquiredAt: now,
      stageStartedAt: now,
      growthBoostSeconds: 0,
      position: {
        x: (Math.random() - 0.5) * 8,
        y: (Math.random() - 0.5) * 4,
        z: (Math.random() - 0.5) * 6,
      },
    };
    addFishToTank(activeTank.id, newFish);
    addCollectedSpecies(pendingHatch.speciesId);
    setPendingHatch(null);
    showToast(`✨ ${name} 획득!`);
  };

  const remaining = 3 - (user?.feedCountToday ?? 0);

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#000' }}>
      {/* 3D 수조 */}
      <TankScene
        environment={environment}
        fish={fishInTank}
        onFishClick={f => setSelectedFishId(f.id)}
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
      <IncubatorPanel onCollect={handleHatchCollect} />

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
      {selectedFish && (
        <FishInfoCard
          fish={selectedFish}
          feedRemaining={remaining}
          onClose={() => setSelectedFishId(null)}
          onFeed={() => handleFeedFish(selectedFish)}
        />
      )}

      {/* 부화 연출 모달 */}
      {pendingHatch && (
        <HatchAnimationModal
          speciesId={pendingHatch.speciesId}
          eggTier={pendingHatch.eggTier}
          onComplete={finalizeHatch}
        />
      )}
    </div>
  );
}

function stageLabel(stage: string): string {
  switch (stage) {
    case 'fry': return '치어';
    case 'juvenile': return '어린 물고기';
    case 'adult': return '성어';
    case 'large': return '대형어';
    default: return stage;
  }
}
