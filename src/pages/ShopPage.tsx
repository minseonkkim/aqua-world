import React, { useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { CURRENCY, EGG_HATCH_TIME } from '@/constants';
import { EggTier } from '@/types';

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

export default function ShopPage() {
  const { user, addStarCoral, spendPearl, spendStarCoral, addEggToInventory } = useUserStore();
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
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

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        상점
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="currency-pill" style={{ fontSize: 13 }}>🪙 {user?.pearl ?? 0}</div>
          <div className="currency-pill" style={{ fontSize: 13 }}>🌸 {user?.starCoral ?? 0}</div>
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* 알 구매 */}
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>
          알 구매
        </p>
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

        {/* Star Coral 충전 */}
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginTop: 12 }}>
          Star Coral 충전
        </p>
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
