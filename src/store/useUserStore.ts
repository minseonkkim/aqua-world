import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Egg, EggTier, FishRarity, Fish, Tank } from '../types';
import { serverNow } from '../services/clock';
import { isNewDayKst } from '../utils/day';
import {
  COMPENDIUM_REWARDS,
  CompendiumReward,
  CURRENCY,
  DAILY_LOGIN_REWARDS,
  LEVEL_EXP_TABLE,
  RARITY_BY_EGG,
  SPECIES_BY_RARITY,
  computeFeedMaxPerDay,
  BREED_EGG_TIER_BY_RARITY,
  EGG_HATCH_TIME,
  getSpeciesRarity,
  rollBreedingSpecies,
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
  /**
   * 튜토리얼 진행도는 "클라 UI 권위" 필드라 서버에 동기화하지 않는다.
   * 클라우드 유저는 user 객체 자체가 localStorage 에 남지 않으므로,
   * 앱 재시작 후 서버의 stale 값(0)이 들어와 튜토리얼이 다시 뜨는 것을 막기 위해
   * uid 별로 마지막 단계를 별도 영속화한다.
   */
  persistedTutorialStep: { uid: string; step: number } | null;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  clearPendingReward: () => void;
  setPendingReward: (reward: DailyRewardResult | null) => void;

  addPearl: (amount: number) => void;
  spendPearl: (amount: number) => boolean;
  addStarCoral: (amount: number) => void;
  spendStarCoral: (amount: number) => boolean;
  /** 게스트용: 광고로 Star Coral 받은 횟수를 오늘 카운터에 +1 (일일 한도 표시/검증용) */
  recordAdStarCoral: () => void;

  addEggToInventory: (tier: EggTier, overrideHatchSeconds?: number) => void;
  /** 번식(짝짓기)으로 얻은 알을 인벤토리에 추가. 부모 종을 기억해 부화 시 같은 종으로 추첨. */
  addBreedingEgg: (parentSpeciesId: string) => void;
  removeEggFromInventory: (eggId: string) => void;
  startHatching: (eggId: string) => void;
  // returns speciesId on success, null if not ready
  collectHatchedEgg: (eggId: string) => string | null;

  addExperience: (exp: number) => void;
  claimDailyLogin: () => void;
  // 먹이 한도는 수조 규모(모든 수조 합산)에 의존한다. 스토어 간 순환참조를 피하려고
  // 호출 측(수조 보유)이 tanks 를 넘긴다.
  recordFeed: (tanks: Tank[]) => boolean;
  /** 보유 수조 규모로 결정되는 하루 무료 먹이 횟수 */
  feedMax: (tanks: Tank[]) => number;
  /** 날짜 변경(자정 리셋)을 반영한 오늘 남은 무료 먹이주기 횟수 */
  feedRemaining: (tanks: Tank[]) => number;
  /** 먹이 티켓 추가 (상점 구매) */
  addFeedTickets: (n: number) => void;

  addCollectedSpecies: (speciesId: string) => void;

  setTutorialStep: (step: number) => void;

  /** 물고기 보관함에 추가 (수조 가득 참 / 수조에서 빼기) */
  addFishToInventory: (fish: Fish) => void;
  /** 보관함에서 물고기 1마리 제거하고 그 객체를 반환. 없으면 null */
  removeFishFromInventory: (fishId: string) => Fish | null;

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
      persistedTutorialStep: null,

      setUser: user => {
        if (!user) {
          set({ user: null, isAuthenticated: false, isLoading: false, persistedTutorialStep: null });
          return;
        }
        const persisted = get().persistedTutorialStep;
        const next = persisted && persisted.uid === user.id
          ? { ...user, tutorialStep: persisted.step }
          : user;
        set({ user: next, isAuthenticated: true, isLoading: false });
      },

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

      recordAdStarCoral: () =>
        set(state => {
          if (!state.user) return {};
          const d = new Date();
          const today = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d
            .getDate()
            .toString()
            .padStart(2, '0')}`;
          const counters = { ...(state.user.adWatchCounters || {}) };
          const t = { ...(counters.ad_star_coral || {}) };
          t[today] = (t[today] || 0) + 1;
          counters.ad_star_coral = t;
          return { user: { ...state.user, adWatchCounters: counters } };
        }),

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

      addBreedingEgg: parentSpeciesId => {
        const { user } = get();
        if (!user) return;
        const tier = BREED_EGG_TIER_BY_RARITY[getSpeciesRarity(parentSpeciesId)];
        const newEgg: Egg = {
          id: `egg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          tier,
          hatchDuration: EGG_HATCH_TIME[tier],
          startedAt: 0,
          isHatching: false,
          breedSpeciesId: parentSpeciesId,
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
        // UI 게이트(IncubatorPanel)와 같은 시계 기준으로 판정 — 게스트는 오프셋 0.
        const elapsed = (serverNow() - egg.startedAt) / 1000;
        if (elapsed < egg.hatchDuration) return null;

        // 번식 알은 부모 종(낮은 확률로 상위 등급)으로, 일반 알은 tier 풀에서 추첨
        const speciesId = egg.breedSpeciesId
          ? rollBreedingSpecies(egg.breedSpeciesId)
          : rollSpecies(egg.tier);
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
        if (!isNewDayKst(user.lastLoginAt, now)) return;

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

      recordFeed: tanks => {
        const { user } = get();
        if (!user) return false;
        const now = Date.now();
        const isNewDay = isNewDayKst(user.lastFeedResetAt, now);

        const count = isNewDay ? 0 : user.feedCountToday;
        const max = computeFeedMaxPerDay(tanks);

        // 무료 횟수가 남았으면 무료 우선 소비
        if (count < max) {
          set({
            user: {
              ...user,
              feedCountToday: count + 1,
              lastFeedResetAt: isNewDay ? now : user.lastFeedResetAt,
            },
          });
          return true;
        }
        // 무료 소진 → 먹이 티켓 소비
        if ((user.feedTickets ?? 0) > 0) {
          set({
            user: {
              ...user,
              feedTickets: (user.feedTickets ?? 0) - 1,
              // 새 날이면 무료 카운터도 리셋해 둔다(이후 무료부터 소비)
              feedCountToday: isNewDay ? 0 : user.feedCountToday,
              lastFeedResetAt: isNewDay ? now : user.lastFeedResetAt,
            },
          });
          return true;
        }
        return false;
      },

      feedMax: tanks => computeFeedMaxPerDay(tanks),

      feedRemaining: tanks => {
        const { user } = get();
        if (!user) return 0;
        const isNewDay = isNewDayKst(user.lastFeedResetAt, Date.now());
        const count = isNewDay ? 0 : user.feedCountToday;
        const max = computeFeedMaxPerDay(tanks);
        return Math.max(0, max - count);
      },

      addFeedTickets: n => {
        const { user } = get();
        if (!user) return;
        set({ user: { ...user, feedTickets: (user.feedTickets ?? 0) + n } });
      },

      addCollectedSpecies: speciesId => {
        const { user } = get();
        if (!user || user.collectedSpecies.includes(speciesId)) return;
        set({ user: { ...user, collectedSpecies: [...user.collectedSpecies, speciesId] } });
      },

      setTutorialStep: step => {
        const { user } = get();
        if (!user) return;
        set({
          user: { ...user, tutorialStep: step },
          persistedTutorialStep: { uid: user.id, step },
        });
      },

      addFishToInventory: fish => {
        const { user } = get();
        if (!user) return;
        set({ user: { ...user, fishInventory: [...(user.fishInventory ?? []), fish] } });
      },

      removeFishFromInventory: fishId => {
        const { user } = get();
        if (!user) return null;
        const target = (user.fishInventory ?? []).find(f => f.id === fishId);
        if (!target) return null;
        set({
          user: { ...user, fishInventory: (user.fishInventory ?? []).filter(f => f.id !== fishId) },
        });
        return target;
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
      // 게스트만 로컬 캐시. 클라우드(로그인) 유저는 서버가 권위 — localStorage에 남기지 않는다.
      partialize: state => {
        const u = state.user;
        const isGuest = !u || u.id.startsWith('guest_');
        // persistedTutorialStep 은 클라 UI 권위 필드라 클라우드 유저에도 항상 영속화한다.
        return isGuest
          ? {
              user: state.user,
              isAuthenticated: state.isAuthenticated,
              persistedTutorialStep: state.persistedTutorialStep,
            }
          : {
              user: null,
              isAuthenticated: false,
              persistedTutorialStep: state.persistedTutorialStep,
            };
      },
    },
  ),
);
