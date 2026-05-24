import { create } from 'zustand';
import { User, Egg, EggTier } from '../types';
import { CURRENCY, DAILY_LOGIN_REWARDS, LEVEL_EXP_TABLE } from '../constants';

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;

  addPearl: (amount: number) => void;
  spendPearl: (amount: number) => boolean;
  addStarCoral: (amount: number) => void;
  spendStarCoral: (amount: number) => boolean;

  addEggToInventory: (tier: EggTier) => void;
  removeEggFromInventory: (eggId: string) => void;

  addExperience: (exp: number) => void;
  claimDailyLogin: () => void;
  recordFeed: () => boolean; // returns true if feed was allowed (< 3/day)

  addCollectedSpecies: (speciesId: string) => void;
}

const createDefaultUser = (): User => ({
  id: '',
  displayName: '',
  email: '',
  pearl: 0,
  starCoral: 0,
  level: 1,
  experience: 0,
  loginStreak: 0,
  lastLoginAt: 0,
  createdAt: Date.now(),
  tanks: [],
  inventory: [],
  collectedSpecies: [],
  feedCountToday: 0,
  lastFeedResetAt: Date.now(),
});

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: user =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    }),

  setLoading: isLoading => set({ isLoading }),

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
      user: state.user
        ? { ...state.user, starCoral: state.user.starCoral + amount }
        : null,
    })),

  spendStarCoral: amount => {
    const { user } = get();
    if (!user || user.starCoral < amount) return false;
    set({ user: { ...user, starCoral: user.starCoral - amount } });
    return true;
  },

  addEggToInventory: tier => {
    const { user } = get();
    if (!user) return;
    const newEgg: Egg = {
      id: `egg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      tier,
      hatchDuration: tier === 'basic' ? 300 : tier === 'rare' ? 1800 : 7200,
      startedAt: 0,
      isHatching: false,
    };
    set({ user: { ...user, inventory: [...user.inventory, newEgg] } });
  },

  removeEggFromInventory: eggId => {
    const { user } = get();
    if (!user) return;
    set({
      user: { ...user, inventory: user.inventory.filter(e => e.id !== eggId) },
    });
  },

  addExperience: exp => {
    const { user } = get();
    if (!user) return;
    let { experience, level } = user;
    experience += exp;

    while (level < LEVEL_EXP_TABLE.length) {
      const nextLevel = LEVEL_EXP_TABLE[level]; // index = level (1-indexed in array)
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
      user: state.user
        ? {
            ...state.user,
            loginStreak: streak,
            lastLoginAt: now,
          }
        : null,
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
    set({
      user: {
        ...user,
        collectedSpecies: [...user.collectedSpecies, speciesId],
      },
    });
  },
}));
