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
} from '@/services/firebase/functions';
import {
  isBillingAvailable,
  purchaseStarCoral as billingPurchaseStarCoral,
  PurchaseCancelledError,
} from '@/services/billing';
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
  } = useUserStore();
  const [toast, setToast] = useState('');
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

  const buyStarCoral = async (pkg: (typeof CURRENCY.STAR_CORAL_PACKAGES)[number]) => {
    const total = pkg.amount + pkg.bonus;
    // Star Coral 은 실화폐 재화 — 인앱결제(네이티브 앱)에서만 살 수 있다.
    // 웹은 Play Billing 인벤토리가 없으므로 게스트/클라우드 구분 없이 차단한다.
    // (예전엔 게스트가 웹에서도 무료로 지급받는 우회로가 있었다.)
    if (!isBillingAvailable()) {
      playSFX('error');
      showToast('결제는 앱에서만 가능합니다');
      return;
    }

    const ok = await useModalStore.getState().confirm({
      emoji: '🌸',
      title: `${pkg.name} 구매`,
      message: `₩${pkg.priceKRW.toLocaleString()} → Star Coral ${total}개`,
      confirmText: '구매',
    });
    if (!ok) return;

    // 클라우드 유저: 실제 Google Play Billing 결제 → 서버 검증 후 지급.
    if (isCloudUser()) {
      showToast('결제를 처리하고 있어요…');
      try {
        // 성공 시 서버 검증이 끝나며 user 스토어가 권위 상태로 이미 갱신됨(낙관적 선지급 없음).
        await billingPurchaseStarCoral(pkg);
        // 실제 결제+검증이 완료된 뒤에만 매출 이벤트 발화(취소는 집계 제외).
        analytics.purchaseStarCoral(pkg.id, total, pkg.priceKRW);
        playSFX('coin');
        showToast(`🌸 Star Coral ${total}개 획득!`);
      } catch (err) {
        if (err instanceof PurchaseCancelledError) {
          showToast('');
          return; // 사용자 취소 — 조용히 종료
        }
        playSFX('error');
        showToast('결제에 실패했습니다');
      }
      return;
    }

    // 게스트(로컬/오프라인): 실결제 아님 — 본인 단말 데이터에 그대로 지급.
    analytics.purchaseStarCoral(pkg.id, total, pkg.priceKRW);
    addStarCoral(total);
    playSFX('coin');
    showToast(`🌸 Star Coral ${total}개 획득!`);
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
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CURRENCY.STAR_CORAL_PACKAGES.map(pkg => (
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
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 36 }}>🌸</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{pkg.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {pkg.amount}개
                    {pkg.bonus > 0 && (
                      <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                        {' '}
                        +{pkg.bonus} 보너스
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => buyStarCoral(pkg)}
                style={{
                  background: 'var(--color-accent)',
                  color: '#0a1628',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                ₩{pkg.priceKRW.toLocaleString()}
              </button>
            </div>
          ))}
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
