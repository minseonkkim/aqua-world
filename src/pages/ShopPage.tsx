import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { useModalStore } from '@/store/useModalStore';
import { CURRENCY, EGG_HATCH_TIME, FEED_TICKET_PACKAGES } from '@/constants';
import { EggTier } from '@/types';
import { DECORATION_CATALOG } from '@/utils/decorationModels';
import {
  isCloudUser,
  optimistic,
  purchaseEgg,
  exchangePearl,
  purchaseDecoration,
  purchaseFeedTicket,
  prepareAdReward,
  claimAdReward,
} from '@/services/firebase/functions';
import { isAdsAvailable, preloadRewardedAd, showRewardedAd } from '@/services/ads';
import { playSFX } from '@/services/audio';
import { analytics } from '@/services/analytics';

type ShopTab = 'egg' | 'decoration' | 'pearl' | 'star_coral';

const EGG_ITEMS: {
  tier: EggTier;
  name: string;
  emoji: string;
  desc: string;
  currency: 'pearl' | 'star_coral';
  price: number;
  odds: string;
}[] = [
  {
    tier: 'basic',
    name: '기본 알',
    emoji: '🥚',
    desc: `부화 ${EGG_HATCH_TIME.basic / 60}분`,
    currency: 'pearl',
    price: 100,
    odds: '일반 70% / 레어 30%',
  },
  {
    tier: 'rare',
    name: '희귀 알',
    emoji: '💎',
    desc: `부화 ${EGG_HATCH_TIME.rare / 60}분`,
    currency: 'star_coral',
    price: 50,
    odds: '레어 60% / 에픽 30% / 전설 10%',
  },
  {
    tier: 'legendary',
    name: '전설 알',
    emoji: '✨',
    desc: `부화 ${EGG_HATCH_TIME.legendary / 3600}시간`,
    currency: 'star_coral',
    price: 150,
    odds: '에픽 50% / 전설 50%',
  },
];

const CURRENCY_ICON: Record<string, string> = { pearl: '🪙', star_coral: '🌸' };
const RARITY_BG: Record<EggTier, string> = {
  basic: 'var(--color-rarity-common)',
  rare: 'var(--color-rarity-rare)',
  legendary: 'var(--color-rarity-legendary)',
};

const TAB_LABEL: Record<ShopTab, string> = {
  egg: '🥚 알·먹이',
  decoration: '🪴 꾸미기',
  pearl: '🪙 코인',
  star_coral: '🌸 Star Coral',
};

const DECO_CATEGORY_LABEL: Record<string, string> = {
  plant: '🌿 수초',
  rock: '🪨 바위',
  driftwood: '🪵 유목',
  ornament: '🎁 장식',
};

export default function ShopPage() {
  const {
    user,
    addPearl,
    addStarCoral,
    spendPearl,
    spendStarCoral,
    addEggToInventory,
    addDecorationInventory,
    addFeedTickets,
    recordAdStarCoral,
  } = useUserStore();
  const [toast, setToast] = useState('');
  const [watchingAd, setWatchingAd] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as ShopTab | null;
  const [tab, setTab] = useState<ShopTab>(tabFromUrl ?? 'egg');
  const [decoFilter, setDecoFilter] = useState<'all' | 'plant' | 'rock' | 'driftwood' | 'ornament'>(
    'all',
  );

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== tab) setTab(tabFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  // Star Coral 탭에 들어오면 광고를 백그라운드로 미리 받아 체감 지연을 없앤다.
  useEffect(() => {
    if (tab === 'star_coral' && isAdsAvailable()) void preloadRewardedAd();
  }, [tab]);

  // 오늘 광고로 받은 Star Coral 횟수 → 남은 횟수. 클라우드는 서버 카운터(setUser 로 갱신),
  // 게스트는 recordAdStarCoral 로 쌓인 로컬 카운터를 같은 구조로 읽는다.
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d
      .getDate()
      .toString()
      .padStart(2, '0')}`;
  })();
  const usedAdStarCoral = user?.adWatchCounters?.ad_star_coral?.[todayKey] ?? 0;
  const remainingAdStarCoral = Math.max(0, CURRENCY.AD_STAR_CORAL_MAX_PER_DAY - usedAdStarCoral);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const switchTab = (next: ShopTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  // 광고를 보고 Star Coral 을 받는다. (예전 유료 결제를 대체)
  // 흐름은 DailyRewardModal 의 보상형 광고 패턴과 동일:
  //   클라우드 → prepareAdReward(nonce) → 광고 시청 → claimAdReward(서버 권위 지급)
  //   게스트   → 광고 시청 → 로컬 지급 + 로컬 일일 카운터 증가
  const AD_AMOUNT = CURRENCY.AD_STAR_CORAL_AMOUNT;
  const watchAdForStarCoral = async () => {
    if (!user || watchingAd) return;
    if (!isAdsAvailable()) {
      playSFX('error');
      showToast('광고는 앱에서만 볼 수 있어요');
      return;
    }
    if (remainingAdStarCoral <= 0) {
      playSFX('error');
      showToast('오늘 광고 시청 횟수를 모두 사용했어요');
      return;
    }
    // 오프라인이면 광고/서버 호출이 ~10초 타임아웃 끝에 실패한다. 미리 즉시 안내.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      showToast('광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요');
      return;
    }

    setWatchingAd(true);
    try {
      if (isCloudUser()) {
        // 서버: nonce 발급(일일 한도 검증 포함) → 광고 시청 → claimAdReward 로 서버 권위 지급.
        let nonceId: string;
        try {
          ({ nonceId } = await prepareAdReward('ad_star_coral'));
        } catch {
          showToast('오늘 광고 시청 횟수를 모두 사용했거나 불러오지 못했어요');
          return;
        }
        const result = await showRewardedAd(nonceId, user.id);
        if (result === 'load_failed') {
          showToast('광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요');
          return;
        }
        if (result !== 'rewarded') return; // 중도 닫기 — 보상 없음, 안내도 없음
        try {
          await claimAdReward({ nonceId });
        } catch {
          // SSV 가 이미 처리한 경우 — user 상태는 setUser 로 자동 반영됨
        }
      } else {
        // 게스트: 로컬에서 즉시 지급하고 로컬 일일 카운터를 올린다.
        const result = await showRewardedAd('guest', user.id);
        if (result === 'load_failed') {
          showToast('광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요');
          return;
        }
        if (result !== 'rewarded') return;
        addStarCoral(AD_AMOUNT);
        recordAdStarCoral();
      }
      playSFX('reward');
      showToast(`🌸 Star Coral ${AD_AMOUNT}개 획득!`);
    } finally {
      setWatchingAd(false);
    }
  };

  const buyPearl = async (pkg: (typeof CURRENCY.PEARL_PACKAGES)[number]) => {
    const total = pkg.pearl + pkg.bonus;
    if ((user?.starCoral ?? 0) < pkg.starCoral) {
      playSFX('error');
      showToast(`🌸 Star Coral ${pkg.starCoral - (user?.starCoral ?? 0)} 부족`);
      return;
    }
    const ok = await useModalStore.getState().confirm({
      emoji: '🪙',
      title: `${pkg.name} 교환`,
      message: `🌸 ${pkg.starCoral} → 🪙 ${total.toLocaleString()}`,
      confirmText: '교환',
    });
    if (!ok) return;
    analytics.exchangePearl(pkg.id);
    if (isCloudUser()) {
      optimistic(
        () => {
          spendStarCoral(pkg.starCoral);
          addPearl(total);
          playSFX('coin');
          showToast(`🪙 코인 ${total.toLocaleString()}개 획득!`);
        },
        () => exchangePearl({ pkgId: pkg.id }),
        () => { playSFX('error'); showToast('교환에 실패했습니다'); },
      );
      return;
    }
    if (!spendStarCoral(pkg.starCoral)) return;
    addPearl(total);
    playSFX('coin');
    showToast(`🪙 코인 ${total.toLocaleString()}개 획득!`);
  };

  const buyEgg = async (item: (typeof EGG_ITEMS)[number]) => {
    const balance = item.currency === 'pearl' ? (user?.pearl ?? 0) : (user?.starCoral ?? 0);
    if (balance < item.price) {
      playSFX('error');
      showToast(`❌ ${item.currency === 'pearl' ? 'Pearl' : 'Star Coral'}이 부족합니다`);
      return;
    }
    const confirmed = await useModalStore.getState().confirm({
      emoji: item.emoji,
      title: `${item.name} 구매`,
      message: `${CURRENCY_ICON[item.currency]} ${item.price} 로 ${item.name}을(를) 구매할까요?`,
      confirmText: '구매',
    });
    if (!confirmed) return;
    analytics.purchaseEgg(item.tier, item.currency, item.price);
    if (isCloudUser()) {
      optimistic(
        () => {
          if (item.currency === 'pearl') spendPearl(item.price);
          else spendStarCoral(item.price);
          addEggToInventory(item.tier);
          playSFX('coin');
          showToast(`${item.emoji} ${item.name} 획득! 수조 화면에서 부화시키세요`);
        },
        () => purchaseEgg({ tier: item.tier }),
        () => { playSFX('error'); showToast('구매에 실패했습니다'); },
      );
      return;
    }
    const ok = item.currency === 'pearl' ? spendPearl(item.price) : spendStarCoral(item.price);
    if (!ok) return;
    addEggToInventory(item.tier);
    playSFX('coin');
    showToast(`${item.emoji} ${item.name} 획득! 수조 화면에서 부화시키세요`);
  };

  const buyFeedTicket = async (pkg: (typeof FEED_TICKET_PACKAGES)[number]) => {
    if ((user?.pearl ?? 0) < pkg.price) {
      playSFX('error');
      showToast(`🪙 코인 ${pkg.price - (user?.pearl ?? 0)} 부족`);
      return;
    }
    const confirmed = await useModalStore.getState().confirm({
      emoji: '🍖',
      title: `먹이 티켓 ${pkg.amount}장 구매`,
      message: `🪙 ${pkg.price} 로 먹이 티켓 ${pkg.amount}장을 구매할까요?`,
      confirmText: '구매',
    });
    if (!confirmed) return;
    analytics.purchaseFeedTicket(pkg.id, pkg.amount, pkg.price);
    if (isCloudUser()) {
      optimistic(
        () => {
          spendPearl(pkg.price);
          addFeedTickets(pkg.amount);
          playSFX('coin');
          showToast(`🍖 먹이 티켓 ${pkg.amount}장 획득!`);
        },
        () => purchaseFeedTicket({ pkgId: pkg.id }),
        () => { playSFX('error'); showToast('구매에 실패했습니다'); },
      );
      return;
    }
    if (!spendPearl(pkg.price)) return;
    addFeedTickets(pkg.amount);
    playSFX('coin');
    showToast(`🍖 먹이 티켓 ${pkg.amount}장 획득!`);
  };

  const buyDecoration = async (modelId: string, name: string, price: number, emoji: string) => {
    if ((user?.pearl ?? 0) < price) {
      playSFX('error');
      showToast(`🪙 Pearl ${price - (user?.pearl ?? 0)} 부족`);
      return;
    }
    const confirmed = await useModalStore.getState().confirm({
      emoji,
      title: `${name} 구매`,
      message: `🪙 ${price} 로 ${name}을(를) 구매할까요?`,
      confirmText: '구매',
    });
    if (!confirmed) return;
    analytics.purchaseDecoration(modelId, price);
    if (isCloudUser()) {
      optimistic(
        () => {
          spendPearl(price);
          addDecorationInventory(modelId, 1);
          playSFX('coin');
          showToast(`${emoji} ${name} 인벤토리 +1 · 수조에서 배치하세요`);
        },
        () => purchaseDecoration({ modelId }),
        () => { playSFX('error'); showToast('구매에 실패했습니다'); },
      );
      return;
    }
    if (!spendPearl(price)) return;
    addDecorationInventory(modelId, 1);
    playSFX('coin');
    showToast(`${emoji} ${name} 인벤토리 +1 · 수조에서 배치하세요`);
  };

  const decoItems = useMemo(
    () =>
      decoFilter === 'all'
        ? DECORATION_CATALOG
        : DECORATION_CATALOG.filter(d => d.type === decoFilter),
    [decoFilter],
  );
  const inventory = user?.decorationInventory ?? {};

  return (
    <div className="page">
      <div
        className="page-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        상점
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="currency-pill" style={{ fontSize: 13 }}>
            🪙 {user?.pearl ?? 0}
          </div>
          <div className="currency-pill" style={{ fontSize: 13 }}>
            🌸 {user?.starCoral ?? 0}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px' }}>
        {(['egg', 'decoration', 'pearl', 'star_coral'] as ShopTab[]).map(t => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            style={{
              flex: 1,
              background: tab === t ? 'rgba(77, 208, 225, 0.25)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${tab === t ? 'rgba(77, 208, 225, 0.6)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 12,
              padding: '8px 4px',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'egg' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 2 }}>🥚 부화 알</div>
          {EGG_ITEMS.map(item => (
            <div
              key={item.tier}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--color-surface)',
                borderRadius: 14,
                padding: '14px 16px',
                color: '#fff',
                textAlign: 'left',
                border: `1px solid ${RARITY_BG[item.tier]}44`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 36 }}>{item.emoji}</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
                  <div
                    style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}
                  >
                    {item.desc}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-disabled)' }}>
                    {item.odds}
                  </div>
                </div>
              </div>
              <button
                onClick={() => buyEgg(item)}
                style={{
                  background: RARITY_BG[item.tier],
                  color: '#fff',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {CURRENCY_ICON[item.currency]} {item.price}
              </button>
            </div>
          ))}

          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 12 }}>🍖 먹이 티켓</div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 10,
              padding: '8px 12px',
            }}
          >
            🎟️ 보유 티켓 {user?.feedTickets ?? 0}장 · 하루 무료 횟수를 다 쓰면 1장씩 사용돼요
          </div>
          {FEED_TICKET_PACKAGES.map(pkg => {
            const canAfford = (user?.pearl ?? 0) >= pkg.price;
            const unit = Math.round(pkg.price / pkg.amount);
            return (
              <div
                key={pkg.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--color-surface)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  color: '#fff',
                  textAlign: 'left',
                  border: '1px solid rgba(255,255,255,0.08)',
                  opacity: canAfford ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 36 }}>🍖</span>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>먹이 티켓 {pkg.amount}장</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      장당 🪙 {unit}
                      {pkg.amount > 1 && (
                        <span style={{ color: 'var(--color-success)', fontWeight: 600 }}> · 묶음 할인</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => buyFeedTicket(pkg)}
                  style={{
                    background: canAfford ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                    color: canAfford ? '#0a1628' : 'var(--color-text-disabled)',
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  🪙 {pkg.price}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'decoration' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 카테고리 필터 */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {(['all', 'plant', 'rock', 'driftwood', 'ornament'] as const).map(c => (
              <button
                key={c}
                onClick={() => setDecoFilter(c)}
                style={{
                  background:
                    decoFilter === c ? 'rgba(77, 208, 225, 0.25)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${decoFilter === c ? 'rgba(77, 208, 225, 0.6)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 14,
                  padding: '4px 10px',
                  color: '#fff',
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {c === 'all' ? '전체' : DECO_CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          {/* 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {decoItems.map(item => {
              const owned = inventory[item.modelId] ?? 0;
              const canAfford = (user?.pearl ?? 0) >= item.price;
              return (
                <div
                  key={item.modelId}
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: 12,
                    padding: 10,
                    color: '#fff',
                    textAlign: 'left',
                    border: '1px solid rgba(255,255,255,0.08)',
                    opacity: canAfford ? 1 : 0.6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    position: 'relative',
                  }}
                >
                  {owned > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: 'rgba(77, 208, 225, 0.85)',
                        color: '#0a1628',
                        borderRadius: 10,
                        padding: '2px 6px',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      보유 {owned}
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 32 }}>{item.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-disabled)' }}>
                        {DECO_CATEGORY_LABEL[item.type]}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => buyDecoration(item.modelId, item.name, item.price, item.emoji)}
                    style={{
                      alignSelf: 'flex-end',
                      background: canAfford ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                      color: canAfford ? '#0a1628' : 'var(--color-text-disabled)',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    🪙 {item.price}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'pearl' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CURRENCY.PEARL_PACKAGES.map(pkg => {
            const total = pkg.pearl + pkg.bonus;
            const canAfford = (user?.starCoral ?? 0) >= pkg.starCoral;
            return (
              <div
                key={pkg.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--color-surface)',
                  borderRadius: 12,
                  padding: 14,
                  color: '#fff',
                  textAlign: 'left',
                  border: '1px solid rgba(255,255,255,0.08)',
                  opacity: canAfford ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 36 }}>🪙</span>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{pkg.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      {pkg.pearl.toLocaleString()}개
                      {pkg.bonus > 0 && (
                        <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                          {' '}
                          +{pkg.bonus.toLocaleString()} 보너스
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => buyPearl(pkg)}
                  style={{
                    background: canAfford ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                    color: canAfford ? '#0a1628' : 'var(--color-text-disabled)',
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  🌸 {pkg.starCoral}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'star_coral' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              background: 'var(--color-surface)',
              borderRadius: 16,
              padding: '24px 16px',
              color: '#fff',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 56 }}>🌸</span>
            <div style={{ fontSize: 16, fontWeight: 700 }}>광고 보고 Star Coral 받기</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              광고 1회 시청당 🌸 {AD_AMOUNT}개를 받아요
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-disabled)' }}>
              오늘 남은 횟수 {remainingAdStarCoral} / {CURRENCY.AD_STAR_CORAL_MAX_PER_DAY}
            </div>
            <button
              onClick={watchAdForStarCoral}
              disabled={watchingAd || remainingAdStarCoral <= 0 || !isAdsAvailable()}
              style={{
                marginTop: 6,
                width: '100%',
                background:
                  watchingAd || remainingAdStarCoral <= 0 || !isAdsAvailable()
                    ? 'rgba(255,255,255,0.1)'
                    : 'var(--color-accent)',
                color:
                  watchingAd || remainingAdStarCoral <= 0 || !isAdsAvailable()
                    ? 'var(--color-text-disabled)'
                    : '#0a1628',
                padding: '12px 14px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                cursor:
                  watchingAd || remainingAdStarCoral <= 0 || !isAdsAvailable()
                    ? 'default'
                    : 'pointer',
              }}
            >
              {!isAdsAvailable()
                ? '앱에서만 이용할 수 있어요'
                : watchingAd
                  ? '광고 준비 중…'
                  : remainingAdStarCoral <= 0
                    ? '오늘 횟수를 모두 사용했어요'
                    : `📺 광고 보고 🌸 ${AD_AMOUNT}개 받기`}
            </button>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 10,
              padding: '10px 12px',
              lineHeight: 1.5,
            }}
          >
            💡 Star Coral 은 광고를 보면 무료로 받을 수 있어요. 매일 자정에 시청 횟수가 초기화됩니다.
          </div>
        </div>
      )}

      <div style={{ height: 24 }} />

      {/* 토스트 */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 20,
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            zIndex: 200,
            pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
