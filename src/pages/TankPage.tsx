import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TankScene from '@/components/3d/TankScene';
import DailyRewardModal from '@/components/DailyRewardModal';
import IncubatorPanel from '@/components/IncubatorPanel';
import FishInfoCard from '@/components/FishInfoCard';
import HatchAnimationModal from '@/components/HatchAnimationModal';
import TutorialOverlay, { TutorialAction } from '@/components/TutorialOverlay';
import DecorationModePanel from '@/components/DecorationModePanel';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { useFishStore } from '@/store/useFishStore';
import { Fish, TankDecoration, TankEnvironment, EggTier } from '@/types';
import { getDecorationMeta } from '@/utils/decorationModels';

interface PendingHatch {
  speciesId: string;
  eggTier: EggTier;
}

export default function TankPage() {
  const navigate = useNavigate();
  const {
    user,
    addPearl,
    recordFeed,
    pendingDailyReward,
    collectHatchedEgg,
    addCollectedSpecies,
    addEggToInventory,
    setTutorialStep,
    consumeDecorationInventory,
    addDecorationInventory,
  } = useUserStore();
  const {
    tanks, activeTankId, addFishToTank, feedFish, tickFishGrowth,
    addDecoration, removeDecoration, updateDecoration,
    savePreset, loadPreset, deletePreset,
  } = useTankStore();
  const { getSpeciesById } = useFishStore();
  const [toast, setToast] = useState('');
  const [selectedFishId, setSelectedFishId] = useState<string | null>(null);
  const [pendingHatch, setPendingHatch] = useState<PendingHatch | null>(null);
  const [decorationMode, setDecorationMode] = useState(false);
  const [selectedDecoId, setSelectedDecoId] = useState<string | null>(null);

  const activeTank = tanks.find(t => t.id === activeTankId);
  const environment: TankEnvironment = activeTank?.environment ?? 'coral_reef';
  const fishInTank = activeTank?.fish ?? [];
  const decorationsInTank = activeTank?.decorations ?? [];
  const selectedDecoration = useMemo(
    () => decorationsInTank.find(d => d.id === selectedDecoId) ?? null,
    [decorationsInTank, selectedDecoId],
  );

  const selectedFish = useMemo(
    () => fishInTank.find(f => f.id === selectedFishId) ?? null,
    [fishInTank, selectedFishId],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleFishClick = useCallback((f: Fish) => setSelectedFishId(f.id), []);

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

  // ===== 튜토리얼 =====
  const tutorialStep = user?.tutorialStep ?? -1;
  const tutorialActive = tutorialStep >= 1 && tutorialStep <= 5;

  // 신규 유저(step=0) 진입 시 1단계 시작
  useEffect(() => {
    if (user && user.tutorialStep === 0) setTutorialStep(1);
  }, [user, setTutorialStep]);

  // Step 4 → 5: 부화 시작 감지
  useEffect(() => {
    if (tutorialStep !== 4) return;
    if (user?.inventory.some(e => e.isHatching)) setTutorialStep(5);
  }, [tutorialStep, user?.inventory, setTutorialStep]);

  // Step 5 → 완료: 수조에 물고기가 추가되면 종료
  const prevFishCountRef = useRef(fishInTank.length);
  useEffect(() => {
    if (tutorialStep === 5 && fishInTank.length > prevFishCountRef.current) {
      setTutorialStep(-1);
      showToast('🎉 튜토리얼 완료! 자유롭게 수족관을 즐겨보세요');
    }
    prevFishCountRef.current = fishInTank.length;
  }, [tutorialStep, fishInTank.length, setTutorialStep]);

  const handleTutorialAction = (action: TutorialAction) => {
    if (action.type === 'skip') {
      setTutorialStep(-1);
      return;
    }
    if (action.type === 'gift_egg') {
      addEggToInventory('basic', 10); // 10초 부화 튜토리얼 알
      showToast('🎁 튜토리얼 알 지급! (10초 부화)');
      setTutorialStep(4);
      return;
    }
    if (action.type === 'next') {
      setTutorialStep(tutorialStep + 1);
    }
  };
  // =====================

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

  // ===== 꾸미기 모드 핸들러 =====
  const handleAddDecoration = useCallback((modelId: string) => {
    if (!activeTankId) return;
    const meta = getDecorationMeta(modelId);
    if (!meta) return;
    // 인벤토리 소비 (상점에서 구매한 데코만 배치 가능)
    if (!consumeDecorationInventory(modelId)) {
      showToast(`🛒 상점에서 먼저 구매하세요`);
      return;
    }
    const id = `deco_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newDeco: TankDecoration = {
      id,
      type: meta.type,
      modelId,
      position: { x: 0, y: -3, z: -1.5 }, // 바닥 중앙(살짝 뒤쪽) — 카탈로그 패널에 가리지 않도록
      rotation: { x: 0, y: 0, z: 0 },
      scale: meta.defaultScale,
    };
    addDecoration(activeTankId, newDeco);
    setSelectedDecoId(id);
    showToast(`✨ ${meta.name} 배치 · 드래그로 이동`);
  }, [activeTankId, addDecoration, consumeDecorationInventory]);

  const handleMoveDecoration = useCallback((id: string, pos: { x: number; y: number; z: number }) => {
    if (!activeTankId) return;
    updateDecoration(activeTankId, id, { position: pos });
  }, [activeTankId, updateDecoration]);

  const handleDeleteDecoration = useCallback((id: string) => {
    if (!activeTankId) return;
    const deco = decorationsInTank.find(d => d.id === id);
    removeDecoration(activeTankId, id);
    setSelectedDecoId(null);
    // 삭제 시 인벤토리 복귀
    if (deco) addDecorationInventory(deco.modelId, 1);
    showToast('🗑 데코 삭제 · 인벤토리 복귀');
  }, [activeTankId, decorationsInTank, removeDecoration, addDecorationInventory]);

  const handleRotateDecoration = useCallback((id: string, deltaY: number) => {
    if (!activeTankId) return;
    const deco = decorationsInTank.find(d => d.id === id);
    if (!deco) return;
    updateDecoration(activeTankId, id, {
      rotation: { ...deco.rotation, y: deco.rotation.y + deltaY },
    });
  }, [activeTankId, decorationsInTank, updateDecoration]);

  const handleScaleDecoration = useCallback((id: string, delta: number) => {
    if (!activeTankId) return;
    const deco = decorationsInTank.find(d => d.id === id);
    if (!deco) return;
    const next = Math.max(0.3, Math.min(2.5, deco.scale + delta));
    updateDecoration(activeTankId, id, { scale: next });
  }, [activeTankId, decorationsInTank, updateDecoration]);

  const handleExitDecorationMode = useCallback(() => {
    setDecorationMode(false);
    setSelectedDecoId(null);
  }, []);

  // ===== 프리셋 핸들러 =====
  const handleSavePreset = useCallback((slot: number) => {
    if (!activeTankId) return;
    const result = savePreset(activeTankId, slot);
    if (result) showToast(`💾 슬롯 ${slot + 1}에 ${result.decorations.length}개 저장됨`);
  }, [activeTankId, savePreset]);

  const handleLoadPreset = useCallback((slot: number) => {
    if (!activeTankId) return;
    const previous = loadPreset(activeTankId, slot);
    if (!previous) {
      showToast(`슬롯 ${slot + 1}이 비어있습니다`);
      return;
    }
    // 기존 배치는 인벤토리로 회수
    const counts: Record<string, number> = {};
    previous.forEach(d => { counts[d.modelId] = (counts[d.modelId] ?? 0) + 1; });
    Object.entries(counts).forEach(([modelId, cnt]) => addDecorationInventory(modelId, cnt));
    // 새 배치는 인벤토리 소비 — 부족하면 보유한 만큼만 적용
    // (loadPreset이 이미 새 배치를 set했으므로, 부족분은 다시 빼야 함)
    const newDecos = useTankStore.getState().tanks.find(t => t.id === activeTankId)?.decorations ?? [];
    const consumedOk: TankDecoration[] = [];
    const refunded: TankDecoration[] = [];
    for (const d of newDecos) {
      if (consumeDecorationInventory(d.modelId)) consumedOk.push(d);
      else refunded.push(d);
    }
    if (refunded.length > 0) {
      useTankStore.getState().updateTank(activeTankId, { decorations: consumedOk });
      showToast(`📂 ${consumedOk.length}개 배치 · ${refunded.length}개는 인벤토리 부족`);
    } else {
      showToast(`📂 슬롯 ${slot + 1} 불러옴 · ${consumedOk.length}개 배치`);
    }
    setSelectedDecoId(null);
  }, [activeTankId, loadPreset, addDecorationInventory, consumeDecorationInventory]);

  const handleDeletePreset = useCallback((slot: number) => {
    if (!activeTankId) return;
    deletePreset(activeTankId, slot);
    showToast(`🗑 슬롯 ${slot + 1} 삭제`);
  }, [activeTankId, deletePreset]);

  const handleShopRedirect = useCallback(() => {
    setDecorationMode(false);
    setSelectedDecoId(null);
    navigate('/shop?tab=decoration');
  }, [navigate]);

  const presets = activeTank?.decorationPresets ?? [];

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#000' }}>
      {/* 3D 수조 */}
      <TankScene
        environment={environment}
        fish={fishInTank}
        decorations={decorationsInTank}
        onFishClick={handleFishClick}
        decorationMode={decorationMode}
        selectedDecorationId={selectedDecoId}
        onDecorationSelect={setSelectedDecoId}
        onDecorationMove={handleMoveDecoration}
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

      {/* 인큐베이터 패널 (왼쪽 하단) — 꾸미기 모드 중에는 숨김 */}
      {!decorationMode && <IncubatorPanel onCollect={handleHatchCollect} />}

      {/* 우측 액션 버튼 — 꾸미기 모드 중에는 숨김 */}
      {!decorationMode && (
        <div style={{ position: 'absolute', right: 12, bottom: 80, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { icon: '🍖', label: `먹이\n${remaining}/3`, action: handleFeed },
            { icon: '🪴', label: '꾸미기', action: () => { setDecorationMode(true); setSelectedDecoId(null); } },
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
      )}

      {/* 꾸미기 모드 패널 */}
      {decorationMode && (
        <DecorationModePanel
          selectedDecoration={selectedDecoration}
          presets={presets}
          onAdd={handleAddDecoration}
          onExit={handleExitDecorationMode}
          onDelete={handleDeleteDecoration}
          onRotate={handleRotateDecoration}
          onScale={handleScaleDecoration}
          onSavePreset={handleSavePreset}
          onLoadPreset={handleLoadPreset}
          onDeletePreset={handleDeletePreset}
          onShopRedirect={handleShopRedirect}
        />
      )}

      {/* 빈 수조 안내 — 알도 없고 튜토리얼도 끝났을 때만 */}
      {fishInTank.length === 0 && (user?.inventory.length ?? 0) === 0 && !tutorialActive && (
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

      {/* 튜토리얼 오버레이 */}
      {tutorialActive && !pendingHatch && (
        <TutorialOverlay step={tutorialStep} onAction={handleTutorialAction} />
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
