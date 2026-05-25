import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { CURRENCY, EGG_HATCH_TIME } from '@/constants';
import { EggTier } from '@/types';
import { DECORATION_CATALOG } from '@/utils/decorationModels';

type ShopTab = 'egg' | 'decoration' | 'star_coral';

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
  egg: '🥚 알',
  decoration: '🪴 꾸미기',
  star_coral: '🌸 Star Coral',
};

const DECO_CATEGORY_LABEL: Record<string, string> = {
  plant: '🌿 수초',
  rock: '🪨 바위',
  driftwood: '🪵 유목',
  ornament: '🎁 장식',
};

export default function ShopPage() {
  const { user, addStarCoral, spendPearl, spendStarCoral, addEggToInventory, addDecorationInventory } = useUserStore();
  const [toast, setToast] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = (searchParams.get('tab') as ShopTab | null);
  const [tab, setTab] = useState<ShopTab>(tabFromUrl ?? 'egg');
  const [decoFilter, setDecoFilter] = useState<'all' | 'plant' | 'rock' | 'driftwood' | 'ornament'>('all');

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

  const buyStarCoral = (pkg: (typeof CURRENCY.STAR_CORAL_PACKAGES)[number]) => {
    if (!confirm(`${pkg.name} 구매\n₩${pkg.priceKRW.toLocaleString()} → Star Coral ${pkg.amount + pkg.bonus}개`)) return;
    addStarCoral(pkg.amount + pkg.bonus);
    showToast(`🌸 Star Coral ${pkg.amount + pkg.bonus}개 획득!`);
  };

  const buyEgg = (item: typeof EGG_ITEMS[number]) => {
    const balance = item.currency === 'pearl' ? (user?.pearl ?? 0) : (user?.starCoral ?? 0);
    if (balance < item.price) {
      showToast(`❌ ${item.currency === 'pearl' ? 'Pearl' : 'Star Coral'}이 부족합니다`);
      return;
    }
    const ok = item.currency === 'pearl' ? spendPearl(item.price) : spendStarCoral(item.price);
    if (!ok) return;
    addEggToInventory(item.tier);
    showToast(`${item.emoji} ${item.name} 획득! 수조 화면에서 부화시키세요`);
  };

  const buyDecoration = (modelId: string, name: string, price: number, emoji: string) => {
    if ((user?.pearl ?? 0) < price) {
      showToast(`🪙 Pearl ${price - (user?.pearl ?? 0)} 부족`);
      return;
    }
    if (!spendPearl(price)) return;
    addDecorationInventory(modelId, 1);
    showToast(`${emoji} ${name} 인벤토리 +1 · 수조에서 배치하세요`);
  };

  const decoItems = useMemo(
    () => (decoFilter === 'all' ? DECORATION_CATALOG : DECORATION_CATALOG.filter(d => d.type === decoFilter)),
    [decoFilter],
  );
  const inventory = user?.decorationInventory ?? {};

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        상점
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="currency-pill" style={{ fontSize: 13 }}>🪙 {user?.pearl ?? 0}</div>
          <div className="currency-pill" style={{ fontSize: 13 }}>🌸 {user?.starCoral ?? 0}</div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px' }}>
        {(['egg', 'decoration', 'star_coral'] as ShopTab[]).map(t => (
          <button key={t} onClick={() => switchTab(t)} style={{
            flex: 1,
            background: tab === t ? 'rgba(77, 208, 225, 0.25)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${tab === t ? 'rgba(77, 208, 225, 0.6)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 12, padding: '8px 4px', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'egg' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {EGG_ITEMS.map(item => (
            <button
              key={item.tier}
              onClick={() => buyEgg(item)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--color-surface)', borderRadius: 14, padding: '14px 16px',
                color: '#fff', textAlign: 'left', border: `1px solid ${RARITY_BG[item.tier]}44`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 36 }}>{item.emoji}</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>{item.desc}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-disabled)' }}>{item.odds}</div>
                </div>
              </div>
              <span style={{
                background: RARITY_BG[item.tier], color: '#fff',
                padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
              }}>
                {CURRENCY_ICON[item.currency]} {item.price}
              </span>
            </button>
          ))}
        </div>
      )}

      {tab === 'decoration' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 카테고리 필터 */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {(['all', 'plant', 'rock', 'driftwood', 'ornament'] as const).map(c => (
              <button key={c} onClick={() => setDecoFilter(c)} style={{
                background: decoFilter === c ? 'rgba(77, 208, 225, 0.25)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${decoFilter === c ? 'rgba(77, 208, 225, 0.6)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 14, padding: '4px 10px', color: '#fff', fontSize: 11,
                whiteSpace: 'nowrap', cursor: 'pointer',
              }}>
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
                <button
                  key={item.modelId}
                  onClick={() => buyDecoration(item.modelId, item.name, item.price, item.emoji)}
                  style={{
                    background: 'var(--color-surface)', borderRadius: 12, padding: 10,
                    color: '#fff', textAlign: 'left',
                    border: '1px solid rgba(255,255,255,0.08)',
                    opacity: canAfford ? 1 : 0.6, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 4, position: 'relative',
                  }}
                >
                  {owned > 0 && (
                    <span style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(77, 208, 225, 0.85)', color: '#0a1628',
                      borderRadius: 10, padding: '2px 6px', fontSize: 10, fontWeight: 700,
                    }}>보유 {owned}</span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 32 }}>{item.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-disabled)' }}>
                        {DECO_CATEGORY_LABEL[item.type]}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    alignSelf: 'flex-end',
                    background: canAfford ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                    color: canAfford ? '#0a1628' : 'var(--color-text-disabled)',
                    padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  }}>
                    🪙 {item.price}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'star_coral' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CURRENCY.STAR_CORAL_PACKAGES.map(pkg => (
            <button key={pkg.id} onClick={() => buyStarCoral(pkg)} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--color-surface)', borderRadius: 12, padding: 14, color: '#fff', textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 36 }}>🌸</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{pkg.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {pkg.amount}개
                    {pkg.bonus > 0 && <span style={{ color: 'var(--color-success)', fontWeight: 600 }}> +{pkg.bonus} 보너스</span>}
                  </div>
                </div>
              </div>
              <span style={{
                background: 'var(--color-accent)', color: '#0a1628',
                padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              }}>
                ₩{pkg.priceKRW.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}

      <div style={{ height: 24 }} />

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '10px 20px',
          borderRadius: 20, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
          zIndex: 200, pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
