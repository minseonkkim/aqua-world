import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Egg, EggTier, FishRarity } from '../types';
import {
  COMPENDIUM_REWARDS,
  CompendiumReward,
  CURRENCY,
  DAILY_LOGIN_REWARDS,
  LEVEL_EXP_TABLE,
  RARITY_BY_EGG,
  SPECIES_BY_RARITY,
} from '../constants';

export interface DailyRewardResult {
  type: 'pearl' | 'star_coral' | 'egg';
  amount?: number;
  tier?: EggTier;
  day: number;
}

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingDailyReward: DailyRewardResult | null;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  clearPendingReward: () => void;
  setPendingReward: (reward: DailyRewardResult | null) => void;

  addPearl: (amount: number) => void;
  spendPearl: (amount: number) => boolean;
  addStarCoral: (amount: number) => void;
  spendStarCoral: (amount: number) => boolean;

  addEggToInventory: (tier: EggTier, overrideHatchSeconds?: number) => void;
  removeEggFromInventory: (eggId: string) => void;
  startHatching: (eggId: string) => void;
  // returns speciesId on success, null if not ready
  collectHatchedEgg: (eggId: string) => string | null;

  addExperience: (exp: number) => void;
  claimDailyLogin: () => void;
  recordFeed: () => boolean;

  addCollectedSpecies: (speciesId: string) => void;

  setTutorialStep: (step: number) => void;

  /** 데코 인벤토리 보유 수량 조회 */
  getDecorationCount: (modelId: string) => number;
  /** 인벤토리에 추가 (상점 구매 / 데코 삭제 복귀) */
  addDecorationInventory: (modelId: string, count?: number) => void;
  /** 인벤토리에서 1개 소비 (배치). 보유 0이면 false */
  consumeDecorationInventory: (modelId: string) => boolean;

  /** 마일스톤(%) 청구. 조건 미달이면 null, 성공 시 지급된 보상 반환 */
  claimCompendiumMilestone: (pct: number, currentCollectedCount: number, totalSpecies: number) => CompendiumReward | null;
}

function rollSpecies(tier: EggTier): string {
  const rarityPool = RARITY_BY_EGG[tier];
  const rarity: FishRarity = rarityPool[Math.floor(Math.random() * rarityPool.length)];
  const pool = SPECIES_BY_RARITY[rarity];
  return pool[Math.floor(Math.random() * pool.length)];
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      pendingDailyReward: null,

      setUser: user =>
        set({ user, isAuthenticated: !!user, isLoading: false }),

      setLoading: isLoading => set({ isLoading }),

      clearPendingReward: () => set({ pendingDailyReward: null }),

      setPendingReward: reward => set({ pendingDailyReward: reward }),

      addPearl: amount =>
        set(state => ({
          user: state.user ? { ...state.user, pearl: state.user.pearl + amount } : null,
        })),

      spendPearl: amount => {
        const { user } = get();
        if (!user || user.pearl < amount) return false;
        set({ user: { ...user, pearl: user.pearl - amount } });
        return true;
      },

      addStarCoral: amount =>
        set(state => ({
          user: state.user ? { ...state.user, starCoral: state.user.starCoral + amount } : null,
        })),

      spendStarCoral: amount => {
        const { user } = get();
        if (!user || user.starCoral < amount) return false;
        set({ user: { ...user, starCoral: user.starCoral - amount } });
        return true;
      },

      addEggToInventory: (tier, overrideHatchSeconds) => {
        const { user } = get();
        if (!user) return;
        const defaultDuration = tier === 'basic' ? 300 : tier === 'rare' ? 1800 : 7200;
        const newEgg: Egg = {
          id: `egg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          tier,
          hatchDuration: overrideHatchSeconds ?? defaultDuration,
          startedAt: 0,
          isHatching: false,
        };
        set({ user: { ...user, inventory: [...user.inventory, newEgg] } });
      },

      removeEggFromInventory: eggId => {
        const { user } = get();
        if (!user) return;
        set({ user: { ...user, inventory: user.inventory.filter(e => e.id !== eggId) } });
      },

      startHatching: eggId => {
        const { user } = get();
        if (!user) return;
        set({
          user: {
            ...user,
            inventory: user.inventory.map(e =>
              e.id === eggId ? { ...e, startedAt: Date.now(), isHatching: true } : e,
            ),
          },
        });
      },

      collectHatchedEgg: eggId => {
        const { user } = get();
        if (!user) return null;
        const egg = user.inventory.find(e => e.id === eggId);
        if (!egg || !egg.isHatching) return null;
        const elapsed = (Date.now() - egg.startedAt) / 1000;
        if (elapsed < egg.hatchDuration) return null;

        const speciesId = rollSpecies(egg.tier);
        set({ user: { ...user, inventory: user.inventory.filter(e => e.id !== eggId) } });
        return speciesId;
      },

      addExperience: exp => {
        const { user } = get();
        if (!user) return;
        let { experience, level } = user;
        experience += exp;
        while (level < LEVEL_EXP_TABLE.length) {
          const nextLevel = LEVEL_EXP_TABLE[level];
          if (!nextLevel || experience < nextLevel.requiredExp) break;
          experience -= nextLevel.requiredExp;
          level++;
        }
        set({ user: { ...user, experience, level } });
      },

      claimDailyLogin: () => {
        const { user, addPearl, addStarCoral, addEggToInventory } = get();
        if (!user) return;

        const now = Date.now();
        const lastLogin = new Date(user.lastLoginAt);
        const today = new Date(now);
        const isNewDay =
          lastLogin.getDate() !== today.getDate() ||
          lastLogin.getMonth() !== today.getMonth() ||
          lastLogin.getFullYear() !== today.getFullYear();

        if (!isNewDay) return;

        const streak = (user.loginStreak % 7) + 1;
        const reward = DAILY_LOGIN_REWARDS[streak - 1];

        if (reward.type === 'pearl') addPearl(reward.amount ?? CURRENCY.DAILY_LOGIN_PEARL);
        else if (reward.type === 'star_coral') addStarCoral(reward.amount ?? 10);
        else if (reward.type === 'egg' && reward.tier) addEggToInventory(reward.tier);

        set(state => ({
          user: state.user ? { ...state.user, loginStreak: streak, lastLoginAt: now } : null,
          pendingDailyReward: { type: reward.type, amount: reward.amount, tier: reward.tier, day: streak },
        }));
      },

      recordFeed: () => {
        const { user } = get();
        if (!user) return false;
        const now = Date.now();
        const lastReset = new Date(user.lastFeedResetAt);
        const today = new Date(now);
        const isNewDay =
          lastReset.getDate() !== today.getDate() ||
          lastReset.getMonth() !== today.getMonth() ||
          lastReset.getFullYear() !== today.getFullYear();

        const count = isNewDay ? 0 : user.feedCountToday;
        if (count >= CURRENCY.FEED_MAX_PER_DAY) return false;

        set({
          user: {
            ...user,
            feedCountToday: count + 1,
            lastFeedResetAt: isNewDay ? now : user.lastFeedResetAt,
          },
        });
        return true;
      },

      addCollectedSpecies: speciesId => {
        const { user } = get();
        if (!user || user.collectedSpecies.includes(speciesId)) return;
        set({ user: { ...user, collectedSpecies: [...user.collectedSpecies, speciesId] } });
      },

      setTutorialStep: step => {
        const { user } = get();
        if (!user) return;
        set({ user: { ...user, tutorialStep: step } });
      },

      getDecorationCount: modelId => {
        const { user } = get();
        return user?.decorationInventory?.[modelId] ?? 0;
      },

      addDecorationInventory: (modelId, count = 1) => {
        const { user } = get();
        if (!user) return;
        const inv = { ...(user.decorationInventory ?? {}) };
        inv[modelId] = (inv[modelId] ?? 0) + count;
        set({ user: { ...user, decorationInventory: inv } });
      },

      consumeDecorationInventory: modelId => {
        const { user } = get();
        if (!user) return false;
        const current = user.decorationInventory?.[modelId] ?? 0;
        if (current <= 0) return false;
        const inv = { ...(user.decorationInventory ?? {}) };
        inv[modelId] = current - 1;
        if (inv[modelId] === 0) delete inv[modelId];
        set({ user: { ...user, decorationInventory: inv } });
        return true;
      },

      claimCompendiumMilestone: (pct, collectedCount, totalSpecies) => {
        const { user, addPearl, addStarCoral, addEggToInventory } = get();
        if (!user) return null;
        const reward = COMPENDIUM_REWARDS[pct];
        if (!reward) return null;
        const claimed = user.claimedCompendiumMilestones ?? [];
        if (claimed.includes(pct)) return null;
        // 조건 검증: 현재 진행도가 마일스톤 이상이어야 함
        const actualPct = Math.floor((collectedCount / totalSpecies) * 100);
        if (actualPct < pct) return null;

        if (reward.type === 'pearl') addPearl(reward.amount);
        else if (reward.type === 'star_coral') addStarCoral(reward.amount);
        else if (reward.type === 'egg') addEggToInventory(reward.tier);

        set(state => ({
          user: state.user
            ? { ...state.user, claimedCompendiumMilestones: [...claimed, pct] }
            : null,
        }));
        return reward;
      },
    }),
    {
      name: 'aquaworld-user',
      partialize: state => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
