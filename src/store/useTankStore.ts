import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Tank, TankEnvironment, TankDecoration, Fish, FishGrowthStage } from '../types';
import { FEED_GROWTH_BOOST_SECONDS } from '../constants';
import { applyGrowthAdvance } from '../utils/growth';

interface TankState {
  tanks: Tank[];
  activeTankId: string | null;

  setTanks: (tanks: Tank[]) => void;
  setActiveTank: (tankId: string) => void;
  getActiveTank: () => Tank | null;

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
    { name: 'aquaworld-tank' },
  ),
);
