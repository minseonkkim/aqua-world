import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Tank, TankEnvironment, TankDecoration, Fish, FishGrowthStage, DecorationPreset } from '../types';
import { FEED_GROWTH_BOOST_SECONDS } from '../constants';
import { applyGrowthAdvance } from '../utils/growth';
import {
  computeFishComfort,
  comfortToMood,
  decayCleanliness,
  CLEANLINESS_PER_FEED,
} from '../utils/mood';
import { useUserStore } from './useUserStore';
import { useFishStore } from './useFishStore';

interface TankState {
  tanks: Tank[];
  activeTankId: string | null;

  setTanks: (tanks: Tank[]) => void;
  setActiveTank: (tankId: string) => void;
  getActiveTank: () => Tank | null;

  /** 서버 함수가 반환한 tank로 동일 id 항목을 통째 교체(없으면 추가) */
  applyServerTank: (tank: Tank) => void;

  addTank: (tank: Tank) => void;
  updateTank: (tankId: string, updates: Partial<Tank>) => void;

  setEnvironment: (tankId: string, env: TankEnvironment) => void;
  setLightMode: (tankId: string, mode: Tank['lightMode']) => void;

  addDecoration: (tankId: string, decoration: TankDecoration) => void;
  removeDecoration: (tankId: string, decorationId: string) => void;
  updateDecoration: (tankId: string, decorationId: string, updates: Partial<TankDecoration>) => void;

  addFishToTank: (tankId: string, fish: Fish) => void;
  updateFish: (tankId: string, fishId: string, updates: Partial<Fish>) => void;
  removeFish: (tankId: string, fishId: string) => void;

  /** 특정 물고기에 먹이를 줘서 성장 가속. 승급 가능하면 즉시 다음 단계로. */
  feedFish: (tankId: string, fishId: string) => { newStage: FishGrowthStage | null } | null;
  /** 활성 수조의 모든 물고기 성장 상태를 검사하여 승급 처리. 승급된 fish id 목록 반환. */
  tickFishGrowth: (tankId: string) => string[];

  /** 시간 경과만큼 청결도 감쇠 + 모든 물고기 mood 재계산 */
  tickMoodAndCleanliness: (tankId: string) => void;
  /** 청결도를 100으로 복구 (비용 차감은 호출자가 책임) */
  cleanTank: (tankId: string) => void;
  /** 먹이 등으로 인한 오염 누적 — 청결도 감소 */
  contaminate: (tankId: string, amount?: number) => void;

  /** 현재 배치를 슬롯에 저장 (덮어쓰기). 저장된 decorations 스냅샷 반환 */
  savePreset: (tankId: string, slot: number) => DecorationPreset | null;
  /** 슬롯에서 불러와서 현재 decorations를 교체. 교체 전 기존 decorations 반환(인벤토리 복귀용) */
  loadPreset: (tankId: string, slot: number) => TankDecoration[] | null;
  /** 슬롯 삭제 */
  deletePreset: (tankId: string, slot: number) => void;
}

export const useTankStore = create<TankState>()(
  persist(
    (set, get) => ({
      tanks: [],
      activeTankId: null,

      setTanks: tanks => set({ tanks, activeTankId: tanks[0]?.id ?? null }),

      setActiveTank: tankId => set({ activeTankId: tankId }),

      getActiveTank: () => {
        const { tanks, activeTankId } = get();
        return tanks.find(t => t.id === activeTankId) ?? null;
      },

      applyServerTank: tank =>
        set(state => ({
          tanks: state.tanks.some(t => t.id === tank.id)
            ? state.tanks.map(t => (t.id === tank.id ? tank : t))
            : [...state.tanks, tank],
          activeTankId: state.activeTankId ?? tank.id,
        })),

      addTank: tank =>
        set(state => ({
          tanks: [...state.tanks, tank],
          activeTankId: state.activeTankId ?? tank.id,
        })),

      updateTank: (tankId, updates) =>
        set(state => ({
          tanks: state.tanks.map(t => (t.id === tankId ? { ...t, ...updates, updatedAt: Date.now() } : t)),
        })),

      setEnvironment: (tankId, env) =>
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId ? { ...t, environment: env, updatedAt: Date.now() } : t,
          ),
        })),

      setLightMode: (tankId, mode) =>
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId ? { ...t, lightMode: mode, updatedAt: Date.now() } : t,
          ),
        })),

      addDecoration: (tankId, decoration) =>
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId
              ? { ...t, decorations: [...t.decorations, decoration], updatedAt: Date.now() }
              : t,
          ),
        })),

      removeDecoration: (tankId, decorationId) =>
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId
              ? { ...t, decorations: t.decorations.filter(d => d.id !== decorationId), updatedAt: Date.now() }
              : t,
          ),
        })),

      updateDecoration: (tankId, decorationId, updates) =>
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId
              ? {
                  ...t,
                  decorations: t.decorations.map(d => (d.id === decorationId ? { ...d, ...updates } : d)),
                  updatedAt: Date.now(),
                }
              : t,
          ),
        })),

      addFishToTank: (tankId, fish) =>
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId
              ? { ...t, fish: [...t.fish, fish], updatedAt: Date.now() }
              : t,
          ),
        })),

      updateFish: (tankId, fishId, updates) =>
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId
              ? { ...t, fish: t.fish.map(f => (f.id === fishId ? { ...f, ...updates } : f)), updatedAt: Date.now() }
              : t,
          ),
        })),

      removeFish: (tankId, fishId) =>
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId
              ? { ...t, fish: t.fish.filter(f => f.id !== fishId), updatedAt: Date.now() }
              : t,
          ),
        })),

      feedFish: (tankId, fishId) => {
        const { tanks } = get();
        const tank = tanks.find(t => t.id === tankId);
        const target = tank?.fish.find(f => f.id === fishId);
        if (!tank || !target) return null;
        const now = Date.now();
        const boosted: Fish = {
          ...target,
          feedCount: target.feedCount + 1,
          lastFedAt: now,
          mood: 'happy',
          growthBoostSeconds: (target.growthBoostSeconds || 0) + FEED_GROWTH_BOOST_SECONDS,
        };
        const advanced = applyGrowthAdvance(boosted, now);
        const finalFish = advanced ?? boosted;
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId
              ? {
                  ...t,
                  fish: t.fish.map(f => (f.id === fishId ? finalFish : f)),
                  updatedAt: now,
                }
              : t,
          ),
        }));
        return { newStage: advanced ? advanced.growthStage : null };
      },

      savePreset: (tankId, slot) => {
        const { tanks } = get();
        const tank = tanks.find(t => t.id === tankId);
        if (!tank) return null;
        const snapshot: DecorationPreset = {
          slot,
          decorations: tank.decorations.map(d => ({ ...d, position: { ...d.position }, rotation: { ...d.rotation } })),
          savedAt: Date.now(),
        };
        const existing = tank.decorationPresets ?? [];
        const next = [...existing.filter(p => p.slot !== slot), snapshot];
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId ? { ...t, decorationPresets: next, updatedAt: Date.now() } : t,
          ),
        }));
        return snapshot;
      },

      loadPreset: (tankId, slot) => {
        const { tanks } = get();
        const tank = tanks.find(t => t.id === tankId);
        const preset = tank?.decorationPresets?.find(p => p.slot === slot);
        if (!tank || !preset) return null;
        const previous = tank.decorations;
        const restored = preset.decorations.map(d => ({
          ...d,
          // 새 id 부여로 충돌 회피
          id: `deco_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          position: { ...d.position },
          rotation: { ...d.rotation },
        }));
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId ? { ...t, decorations: restored, updatedAt: Date.now() } : t,
          ),
        }));
        return previous;
      },

      deletePreset: (tankId, slot) => {
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId
              ? {
                  ...t,
                  decorationPresets: (t.decorationPresets ?? []).filter(p => p.slot !== slot),
                  updatedAt: Date.now(),
                }
              : t,
          ),
        }));
      },

      tickMoodAndCleanliness: tankId => {
        const { tanks } = get();
        const tank = tanks.find(t => t.id === tankId);
        if (!tank) return;
        const now = Date.now();
        const lastTick = tank.lastCleanlinessTickAt ?? tank.updatedAt ?? now;
        const nextClean = decayCleanliness(tank.cleanliness, lastTick, now);
        const species = useFishStore.getState().allSpecies;
        // mood 계산용 임시 tank (감쇠된 청결도 반영)
        const tankForCalc: Tank = { ...tank, cleanliness: nextClean };
        let moodChanged = false;
        const nextFish = tank.fish.map(f => {
          const sp = species.find(s => s.id === f.speciesId);
          const comfort = computeFishComfort(f, tankForCalc, sp?.habitat, now);
          const mood = comfortToMood(comfort.total);
          if (mood === f.mood) return f;
          moodChanged = true;
          return { ...f, mood };
        });
        const cleanlinessChanged = Math.abs(nextClean - tank.cleanliness) > 0.01;
        if (!moodChanged && !cleanlinessChanged) {
          // tick 시각만 갱신 — 다음 호출에서 누적 감쇠 폭주 방지
          set(state => ({
            tanks: state.tanks.map(t =>
              t.id === tankId ? { ...t, lastCleanlinessTickAt: now } : t,
            ),
          }));
          return;
        }
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId
              ? { ...t, fish: nextFish, cleanliness: nextClean, lastCleanlinessTickAt: now }
              : t,
          ),
        }));
      },

      cleanTank: tankId =>
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId
              ? { ...t, cleanliness: 100, lastCleanlinessTickAt: Date.now(), updatedAt: Date.now() }
              : t,
          ),
        })),

      contaminate: (tankId, amount = CLEANLINESS_PER_FEED) =>
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId
              ? { ...t, cleanliness: Math.max(0, t.cleanliness - amount), updatedAt: Date.now() }
              : t,
          ),
        })),

      tickFishGrowth: tankId => {
        const { tanks } = get();
        const tank = tanks.find(t => t.id === tankId);
        if (!tank) return [];
        const now = Date.now();
        const advancedIds: string[] = [];
        const nextFish = tank.fish.map(f => {
          const advanced = applyGrowthAdvance(f, now);
          if (advanced) {
            advancedIds.push(f.id);
            return advanced;
          }
          return f;
        });
        if (advancedIds.length === 0) return [];
        set(state => ({
          tanks: state.tanks.map(t =>
            t.id === tankId ? { ...t, fish: nextFish, updatedAt: now } : t,
          ),
        }));
        return advancedIds;
      },
    }),
    {
      name: 'aquaworld-tank',
      // 게스트만 로컬 캐시. 클라우드 유저의 수조는 서버에서 복원한다.
      partialize: state => {
        const u = useUserStore.getState().user;
        const isGuest = !u || u.id.startsWith('guest_');
        return isGuest
          ? { tanks: state.tanks, activeTankId: state.activeTankId }
          : { tanks: [], activeTankId: null };
      },
    },
  ),
);
