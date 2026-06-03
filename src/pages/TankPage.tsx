import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TankScene, { TankSceneHandle } from '@/components/3d/TankScene';
import DailyRewardModal from '@/components/DailyRewardModal';
import IncubatorPanel from '@/components/IncubatorPanel';
import FishInfoCard from '@/components/FishInfoCard';
import HatchAnimationModal from '@/components/HatchAnimationModal';
import TutorialOverlay, { TutorialAction } from '@/components/TutorialOverlay';
import DecorationModePanel from '@/components/DecorationModePanel';
import PhotoModeOverlay from '@/components/PhotoModeOverlay';
import NotificationPanel from '@/components/NotificationPanel';
import FishInventoryPanel from '@/components/FishInventoryPanel';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { useFishStore } from '@/store/useFishStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { Fish, TankDecoration, TankEnvironment, EggTier } from '@/types';
import { getDecorationMeta } from '@/utils/decorationModels';
import { CLEAN_TANK_COST_PEARL } from '@/utils/mood';
import { getTankCapacity, getTankScale, TANK_MAX_CAPACITY_LEVEL, TANK_EXPAND_COST_PEARL } from '@/constants';
import {
  isCloudUser,
  optimistic,
  sprinkleFeed,
  feedFish as feedFishServer,
  hatchEgg as hatchEggServer,
  storeFish as storeFishServer,
  placeFish as placeFishServer,
  expandTankCapacity as expandTankCapacityServer,
} from '@/services/firebase/functions';
import { analytics } from '@/services/analytics';

interface PendingHatch {
  speciesId: string;
  eggTier: EggTier;
  /** 클라우드 유저: 서버가 수조가 가득 차 보관함에 넣었으면 true */
  storedInInventory?: boolean;
}

export default function TankPage() {
  const navigate = useNavigate();
  const {
    user,
    addPearl,
    spendPearl,
    recordFeed,
    pendingDailyReward,
    collectHatchedEgg,
    addCollectedSpecies,
    setTutorialStep,
    consumeDecorationInventory,
    addDecorationInventory,
    addFishToInventory,
    removeFishFromInventory,
  } = useUserStore();
  const {
    tanks, activeTankId, addFishToTank, removeFish, feedFish, tickFishGrowth,
    addDecoration, removeDecoration, updateDecoration,
    savePreset, loadPreset, deletePreset, setLightMode,
    tickMoodAndCleanliness, cleanTank, contaminate, expandTankCapacity,
  } = useTankStore();
  const { getSpeciesById } = useFishStore();
  const pushNotification = useNotificationStore(s => s.push);
  const unreadCount = useNotificationStore(s => s.notifications.filter(n => !n.read).length);
  const [notifOpen, setNotifOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedFishId, setSelectedFishId] = useState<string | null>(null);
  const [pendingHatch, setPendingHatch] = useState<PendingHatch | null>(null);
  const [decorationMode, setDecorationMode] = useState(false);
  const [selectedDecoId, setSelectedDecoId] = useState<string | null>(null);
  const [photoMode, setPhotoMode] = useState(false);
  const [lightPopupOpen, setLightPopupOpen] = useState(false);
  // 좌측 하단 패널 상호 배타 — 한 번에 하나만 열림
  const [leftPanel, setLeftPanel] = useState<'incubator' | 'fishbox' | null>(null);
  const tankSceneRef = useRef<TankSceneHandle>(null);

  const activeTank = tanks.find(t => t.id === activeTankId);
  const environment: TankEnvironment = activeTank?.environment ?? 'coral_reef';
  const fishInTank = activeTank?.fish ?? [];
  const capacityLevel = activeTank?.capacityLevel ?? 0;
  const tankCapacity = getTankCapacity(capacityLevel);
  const tankFull = fishInTank.length >= tankCapacity;
  const canExpand = capacityLevel < TANK_MAX_CAPACITY_LEVEL;
  const expandCost = canExpand ? TANK_EXPAND_COST_PEARL[capacityLevel] : null;
  const decorationsInTank = activeTank?.decorations ?? [];
  const cleanliness = Math.round(activeTank?.cleanliness ?? 100);
  const happyRatio = fishInTank.length > 0
    ? Math.round((fishInTank.filter(f => f.mood === 'happy').length / fishInTank.length) * 100)
    : 0;
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

  // 주기적 성장 틱 (30초마다) — 성장/부화 완료 시 토스트 + 알림 생성, mood/청결도 갱신
  useEffect(() => {
    if (!activeTankId) return;
    const tick = () => {
      tickMoodAndCleanliness(activeTankId);
      const advancedIds = tickFishGrowth(activeTankId);
      if (advancedIds.length > 0) {
        const updated = useTankStore.getState().tanks.find(t => t.id === activeTankId)?.fish ?? [];
        const names: string[] = [];
        advancedIds.forEach(id => {
          const f = updated.find(x => x.id === id);
          if (!f) return;
          names.push(f.name);
          analytics.fishGrowStage(f.growthStage);
          pushNotification({
            id: `growth_${id}_${f.growthStage}`,
            type: 'growth',
            emoji: '🌱',
            title: `${f.name} 성장!`,
            body: `${stageLabel(f.growthStage)} 단계가 되었어요`,
          });
        });
        if (names.length) showToast(`🌱 ${names.join(', ')} 성장!`);
      }

      // 부화 완료 감지 — 수확 가능 상태가 된 알에 1회 알림
      const inv = useUserStore.getState().user?.inventory ?? [];
      const now = Date.now();
      inv.forEach(egg => {
        if (!egg.isHatching) return;
        const elapsed = (now - egg.startedAt) / 1000;
        if (elapsed < egg.hatchDuration) return;
        pushNotification({
          id: `hatch_${egg.id}`,
          type: 'hatch',
          emoji: '🐣',
          title: '부화 완료!',
          body: '알이 부화했어요 · 인큐베이터에서 수확하세요',
        });
      });
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [activeTankId, tickFishGrowth, tickMoodAndCleanliness, pushNotification]);

  // 일일 보상 수령 시 알림 생성 (로컬·클라우드 모두 pendingDailyReward를 거침)
  useEffect(() => {
    if (!pendingDailyReward) return;
    const r = pendingDailyReward;
    const body =
      r.type === 'egg'
        ? `${TIER_LABELS[r.tier ?? 'basic']} 지급`
        : `${r.amount ?? 0} ${r.type === 'pearl' ? 'Pearl' : 'Star Coral'} 지급`;
    const dateKey = new Date().toISOString().slice(0, 10);
    pushNotification({
      id: `daily_${dateKey}_${r.day}`,
      type: 'daily',
      emoji: '🎁',
      title: `${r.day}일 연속 출석 보상`,
      body,
    });
    analytics.dailyRewardClaim(r.day, r.type);
  }, [pendingDailyReward, pushNotification]);

  // ===== 튜토리얼 =====
  const tutorialStep = user?.tutorialStep ?? -1;
  const tutorialActive = tutorialStep >= 1 && tutorialStep <= 5;

  // 신규 유저(step=0) 진입 시 1단계 시작
  useEffect(() => {
    if (user && user.tutorialStep === 0) setTutorialStep(1);
  }, [user, setTutorialStep]);

  // 튜토리얼 단계 진입 시마다 analytics 로 funnel 추적 — auto/manual 모두 한 곳에서.
  useEffect(() => {
    if (tutorialStep >= 1 && tutorialStep <= 5) analytics.tutorialStep(tutorialStep);
  }, [tutorialStep]);

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
      analytics.tutorialComplete('completed');
      showToast('🎉 튜토리얼 완료! 자유롭게 수족관을 즐겨보세요');
    }
    prevFishCountRef.current = fishInTank.length;
  }, [tutorialStep, fishInTank.length, setTutorialStep]);

  const handleTutorialAction = (action: TutorialAction) => {
    if (action.type === 'skip') {
      setTutorialStep(-1);
      analytics.tutorialComplete('skipped');
      return;
    }
    if (action.type === 'gift_egg') {
      // 튜토리얼 알은 bootstrapUser가 가입 시 inventory에 미리 발급함.
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
    if (isCloudUser()) {
      const prevUser = useUserStore.getState().user;
      if (!recordFeed()) { showToast('오늘 먹이주기를 모두 사용했습니다 🐟'); return; }
      addPearl(10);
      if (activeTankId) contaminate(activeTankId);
      showToast('+10 🪙 Pearl 획득!');
      analytics.sprinkleFeed();
      sprinkleFeed().catch(() => {
        useUserStore.getState().setUser(prevUser);
        showToast('오늘 먹이주기를 모두 사용했습니다 🐟');
      });
      return;
    }
    if (!recordFeed()) { showToast('오늘 먹이주기를 모두 사용했습니다 🐟'); return; }
    addPearl(10);
    if (activeTankId) contaminate(activeTankId);
    showToast('+10 🪙 Pearl 획득!');
    analytics.sprinkleFeed();
  };

  // 수면을 직접 클릭/탭하면 먹이가 떨어진다. 일일 한도면 파티클 생략을 위해 false 반환.
  const handleSurfaceFeed = useCallback((): boolean => {
    if (isCloudUser()) {
      const prevUser = useUserStore.getState().user;
      if (!recordFeed()) {
        showToast('오늘 먹이주기를 모두 사용했습니다 🐟');
        return false;
      }
      addPearl(10);
      if (activeTankId) contaminate(activeTankId);
      showToast('🍤 먹이 뿌리기 · +10 🪙');
      analytics.sprinkleFeed();
      sprinkleFeed().catch(() => {
        useUserStore.getState().setUser(prevUser);
        showToast('오늘 먹이주기를 모두 사용했습니다 🐟');
      });
      return true;
    }
    if (!recordFeed()) {
      showToast('오늘 먹이주기를 모두 사용했습니다 🐟');
      return false;
    }
    addPearl(10);
    if (activeTankId) contaminate(activeTankId);
    showToast('🍤 먹이 뿌리기 · +10 🪙');
    analytics.sprinkleFeed();
    return true;
  }, [recordFeed, addPearl, activeTankId, contaminate]);

  const handleFeedFish = async (fish: Fish) => {
    if (!activeTankId) return;
    if (fish.growthStage === 'large') {
      showToast('이미 최대 성장 단계입니다');
      return;
    }
    if (isCloudUser()) {
      const prevUser = useUserStore.getState().user;
      const prevTanks = useTankStore.getState().tanks;
      if (!recordFeed()) {
        showToast('오늘 먹이주기를 모두 사용했습니다 🐟');
        return;
      }
      addPearl(10);
      const result = feedFish(activeTankId, fish.id);
      contaminate(activeTankId);
      analytics.feedFish(fish.growthStage);
      if (result?.newStage) {
        analytics.fishGrowStage(result.newStage);
        showToast(`🌱 ${fish.name} → ${stageLabel(result.newStage)} 성장!`);
      } else showToast(`🍖 +5분 성장 가속 · +10 🪙`);
      feedFishServer({ tankId: activeTankId, fishId: fish.id }).catch(() => {
        useUserStore.getState().setUser(prevUser);
        useTankStore.getState().setTanks(prevTanks);
        showToast('오늘 먹이주기를 모두 사용했습니다 🐟');
      });
      return;
    }
    if (!recordFeed()) {
      showToast('오늘 먹이주기를 모두 사용했습니다 🐟');
      return;
    }
    addPearl(10);
    const result = feedFish(activeTankId, fish.id);
    contaminate(activeTankId);
    analytics.feedFish(fish.growthStage);
    if (result?.newStage) {
      analytics.fishGrowStage(result.newStage);
      showToast(`🌱 ${fish.name} → ${stageLabel(result.newStage)} 성장!`);
    } else {
      showToast(`🍖 +5분 성장 가속 · +10 🪙`);
    }
  };

  const handleHatchCollect = async (eggId: string, eggTier: EggTier) => {
    if (isCloudUser()) {
      if (!activeTankId) return;
      try {
        const res = await hatchEggServer({ eggId, tankId: activeTankId });
        setPendingHatch({ speciesId: res.speciesId, eggTier, storedInInventory: res.storedInInventory });
      } catch {
        showToast('아직 부화하지 않았습니다');
      }
      return;
    }
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

    analytics.hatchEgg(pendingHatch.eggTier, pendingHatch.speciesId);

    // 클라우드 유저는 서버 hatchEgg가 이미 물고기 생성·도감 등록을 마침
    if (isCloudUser()) {
      const stored = pendingHatch.storedInInventory;
      setPendingHatch(null);
      showToast(stored ? `📦 수조가 가득 차 ${name}을(를) 보관함에 보관했어요` : `✨ ${name} 획득!`);
      return;
    }

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
    // 도감은 보유 기준이므로 배치 여부와 무관하게 항상 등록
    addCollectedSpecies(pendingHatch.speciesId);
    // 수조가 가득 차면 보관함으로, 아니면 수조에 바로 배치
    if (activeTank.fish.length >= getTankCapacity(activeTank.capacityLevel)) {
      addFishToInventory(newFish);
      setPendingHatch(null);
      showToast(`📦 수조가 가득 차 ${name}을(를) 보관함에 보관했어요`);
      return;
    }
    addFishToTank(activeTank.id, newFish);
    setPendingHatch(null);
    showToast(`✨ ${name} 획득!`);
  };

  // ===== 물고기 보관함 핸들러 =====
  // tank.fish 는 서버 소유 → 클라우드 유저는 서버 함수로 이동(낙관적 UI + 실패 시 롤백),
  // 게스트/로컬 유저는 기존 로컬 로직 그대로.
  const handlePlaceFish = useCallback((fishId: string) => {
    if (!activeTankId) return;
    const tank = useTankStore.getState().tanks.find(t => t.id === activeTankId);
    if (!tank) return;
    if (tank.fish.length >= getTankCapacity(tank.capacityLevel)) {
      showToast(`수조가 가득 찼어요 (${getTankCapacity(tank.capacityLevel)}마리) — 확장하거나 다른 물고기를 빼주세요`);
      return;
    }
    const invFish = (useUserStore.getState().user?.fishInventory ?? []).find(f => f.id === fishId);
    if (!invFish) return;
    const place = () => {
      removeFishFromInventory(fishId);
      addFishToTank(activeTankId, {
        ...invFish,
        position: {
          x: (Math.random() - 0.5) * 8,
          y: (Math.random() - 0.5) * 4,
          z: (Math.random() - 0.5) * 6,
        },
      });
    };
    if (isCloudUser()) {
      optimistic(place, () => placeFishServer({ tankId: activeTankId, fishId }), () =>
        showToast('배치에 실패했어요 — 다시 시도해주세요'),
      );
    } else {
      place();
    }
    showToast(`🐟 ${invFish.name} 수조에 배치`);
  }, [activeTankId, removeFishFromInventory, addFishToTank]);

  const handleStoreFish = useCallback((fish: Fish) => {
    if (!activeTankId) return;
    const store = () => {
      removeFish(activeTankId, fish.id);
      addFishToInventory(fish);
    };
    if (isCloudUser()) {
      optimistic(store, () => storeFishServer({ tankId: activeTankId, fishId: fish.id }), () =>
        showToast('보관에 실패했어요 — 다시 시도해주세요'),
      );
    } else {
      store();
    }
    setSelectedFishId(null);
    showToast(`📦 ${fish.name} 보관함에 보관`);
  }, [activeTankId, removeFish, addFishToInventory]);

  const handleExpandCapacity = useCallback(() => {
    if (!activeTankId) return;
    const tank = useTankStore.getState().tanks.find(t => t.id === activeTankId);
    if (!tank) return;
    const lvl = tank.capacityLevel ?? 0;
    if (lvl >= TANK_MAX_CAPACITY_LEVEL) {
      showToast('이미 최대 크기예요');
      return;
    }
    const cost = TANK_EXPAND_COST_PEARL[lvl];
    if ((user?.pearl ?? 0) < cost) {
      showToast(`Pearl이 부족합니다 (${cost} 🪙 필요)`);
      return;
    }
    if (isCloudUser()) {
      optimistic(
        () => {
          spendPearl(cost);
          expandTankCapacity(activeTankId);
        },
        () => expandTankCapacityServer({ tankId: activeTankId }),
        () => showToast('확장에 실패했어요 — 다시 시도해주세요'),
      );
    } else {
      if (!spendPearl(cost)) {
        showToast(`Pearl이 부족합니다 (${cost} 🪙 필요)`);
        return;
      }
      expandTankCapacity(activeTankId);
    }
    showToast(`🔧 수조 확장! 최대 ${getTankCapacity(lvl + 1)}마리`);
  }, [activeTankId, user?.pearl, spendPearl, expandTankCapacity]);

  const remaining = 3 - (user?.feedCountToday ?? 0);

  const handleCleanTank = () => {
    if (!activeTankId) return;
    if (cleanliness >= 95) {
      showToast('이미 깨끗해요 ✨');
      return;
    }
    if (!spendPearl(CLEAN_TANK_COST_PEARL)) {
      showToast(`Pearl이 부족합니다 (${CLEAN_TANK_COST_PEARL} 🪙 필요)`);
      return;
    }
    cleanTank(activeTankId);
    tickMoodAndCleanliness(activeTankId);
    analytics.cleanTank();
    showToast('💧 물을 갈았어요 — 청결도 100%');
  };

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
      {/* 3D 수조 — 포토 모드 중에는 인터랙션(클릭/먹이) 비활성, 카메라 컨트롤은 유지 */}
      <TankScene
        ref={tankSceneRef}
        environment={environment}
        fish={fishInTank}
        decorations={decorationsInTank}
        onFishClick={photoMode ? undefined : handleFishClick}
        decorationMode={decorationMode}
        selectedDecorationId={selectedDecoId}
        onDecorationSelect={setSelectedDecoId}
        onDecorationMove={handleMoveDecoration}
        lightMode={activeTank?.lightMode ?? 'auto'}
        onSurfaceFeed={photoMode ? undefined : handleSurfaceFeed}
        tankScale={getTankScale(capacityLevel)}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* 상단 HUD — 포토 모드 중에는 숨김 */}
      {!photoMode && (
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
            <>
              <div
                className="currency-pill"
                title={`수조 청결도 ${cleanliness}%`}
                style={{ color: cleanliness < 35 ? '#e57373' : cleanliness < 70 ? '#ffb74d' : '#80deea' }}
              >
                💧 {cleanliness}%
              </div>
              <div
                className="currency-pill"
                title={`행복한 물고기 ${happyRatio}%`}
                style={{ color: happyRatio >= 70 ? '#81c784' : happyRatio >= 35 ? '#ffb74d' : '#e57373' }}
              >
                💖 {happyRatio}%
              </div>
            </>
          )}
          <div className="currency-pill" style={{ color: 'var(--color-accent)' }}>
            Lv.{user?.level ?? 1}
          </div>
          <button
            onClick={() => setNotifOpen(o => !o)}
            style={{
              position: 'relative', pointerEvents: 'auto',
              background: 'rgba(0,0,0,0.5)', borderRadius: 20,
              width: 34, height: 34, fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            🔔
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: 8, background: 'var(--color-error)',
                color: '#fff', fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
      )}

      {/* 인큐베이터 패널 (왼쪽 하단) — 꾸미기/포토 모드 중에는 숨김 */}
      {!decorationMode && !photoMode && (
        <IncubatorPanel
          onCollect={handleHatchCollect}
          open={leftPanel === 'incubator'}
          onOpenChange={o => setLeftPanel(o ? 'incubator' : null)}
        />
      )}

      {/* 물고기 보관함 패널 (왼쪽, 인큐베이터 위) — 보유 물고기가 있을 때만 */}
      {!decorationMode && !photoMode &&
        (fishInTank.length > 0 || (user?.fishInventory?.length ?? 0) > 0) && (
          <FishInventoryPanel
            onPlace={handlePlaceFish}
            onExpand={handleExpandCapacity}
            tankFishCount={fishInTank.length}
            capacity={tankCapacity}
            canExpand={canExpand}
            expandCost={expandCost}
            open={leftPanel === 'fishbox'}
            onOpenChange={o => setLeftPanel(o ? 'fishbox' : null)}
          />
        )}

      {/* 우측 액션 버튼 — 꾸미기/포토 모드 중에는 숨김 */}
      {!decorationMode && !photoMode && (
        <div style={{ position: 'absolute', right: 12, bottom: 80, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { icon: '🍖', label: `먹이\n${remaining}/3`, action: handleFeed },
            {
              icon: '💧',
              label: `청소\n${CLEAN_TANK_COST_PEARL}🪙`,
              action: handleCleanTank,
              active: cleanliness < 35,
            },
            { icon: '🪴', label: '꾸미기', action: () => { setDecorationMode(true); setSelectedDecoId(null); } },
            { icon: '📷', label: '포토', action: () => setPhotoMode(true) },
            {
              icon: LIGHT_MODE_ICON[activeTank?.lightMode ?? 'auto'],
              label: '조명',
              action: () => setLightPopupOpen(v => !v),
              active: lightPopupOpen,
            },
          ].map(btn => (
            <button key={btn.icon} onClick={btn.action} style={{
              background: btn.active ? 'rgba(77, 208, 225, 0.25)' : 'rgba(0,0,0,0.6)',
              borderRadius: 11, padding: '7px 10px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              border: `1px solid ${btn.active ? 'rgba(77, 208, 225, 0.7)' : 'rgba(255,255,255,0.15)'}`,
              minWidth: 54, color: '#fff',
              fontSize: 9, whiteSpace: 'pre-line', textAlign: 'center',
            }}>
              <span style={{ fontSize: 20 }}>{btn.icon}</span>
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* 조명 모드 팝업 — ☀️ 버튼 좌측에 배치 */}
      {lightPopupOpen && !decorationMode && !photoMode && activeTankId && (
        <div style={{
          position: 'absolute', right: 84, bottom: 80,
          display: 'flex', flexDirection: 'column', gap: 4,
          background: 'rgba(10, 22, 40, 0.95)', borderRadius: 12, padding: 6,
          border: '1px solid rgba(77, 208, 225, 0.4)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          zIndex: 60,
        }}>
          {(['auto', 'day', 'sunset', 'night'] as const).map(mode => {
            const isActive = (activeTank?.lightMode ?? 'auto') === mode;
            return (
              <button
                key={mode}
                onClick={() => {
                  setLightMode(activeTankId, mode);
                  setLightPopupOpen(false);
                  showToast(`${LIGHT_MODE_ICON[mode]} ${LIGHT_MODE_LABEL[mode]} 모드`);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: isActive ? 'rgba(77, 208, 225, 0.25)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(77, 208, 225, 0.6)' : 'transparent'}`,
                  borderRadius: 8, padding: '5px 10px',
                  color: '#fff', fontSize: 11, fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer', whiteSpace: 'nowrap', minWidth: 90,
                }}
              >
                <span style={{ fontSize: 16 }}>{LIGHT_MODE_ICON[mode]}</span>
                <span>{LIGHT_MODE_LABEL[mode]}</span>
              </button>
            );
          })}
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

      {/* 포토 모드 오버레이 */}
      {photoMode && (
        <PhotoModeOverlay
          onCapture={() => tankSceneRef.current?.captureFrame() ?? null}
          onExit={() => setPhotoMode(false)}
          onToast={showToast}
        />
      )}

      {/* 빈 수조 안내 — 알도 없고 튜토리얼도 끝났을 때만 */}
      {fishInTank.length === 0 && (user?.inventory.length ?? 0) === 0 && !tutorialActive && !photoMode && (
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
          borderRadius: 20, fontSize: 14, fontWeight: 600,
          maxWidth: 'min(360px, calc(100vw - 32px))',
          textAlign: 'center', lineHeight: 1.4, wordBreak: 'keep-all',
          pointerEvents: 'none',
          zIndex: 100,
        }}>
          {toast}
        </div>
      )}

      {/* 알림 패널 */}
      {notifOpen && !photoMode && <NotificationPanel onClose={() => setNotifOpen(false)} />}

      {/* 일일 보상 팝업 */}
      {pendingDailyReward && <DailyRewardModal reward={pendingDailyReward} />}

      {/* 물고기 정보 카드 */}
      {selectedFish && (
        <FishInfoCard
          fish={selectedFish}
          feedRemaining={remaining}
          onClose={() => setSelectedFishId(null)}
          onFeed={() => handleFeedFish(selectedFish)}
          onStore={() => handleStoreFish(selectedFish)}
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

const TIER_LABELS: Record<string, string> = {
  basic: '기본 알', rare: '희귀 알', legendary: '전설 알',
};

const LIGHT_MODE_ICON: Record<'auto' | 'day' | 'sunset' | 'night', string> = {
  auto: '🌗', day: '☀️', sunset: '🌅', night: '🌙',
};

const LIGHT_MODE_LABEL: Record<'auto' | 'day' | 'sunset' | 'night', string> = {
  auto: '자동 (시간)', day: '낮', sunset: '노을', night: '밤',
};
