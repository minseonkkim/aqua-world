import React from 'react';
import { useUserStore } from '@/store/useUserStore';
import { CURRENCY } from '@/constants';

export default function ShopPage() {
  const { user, addStarCoral } = useUserStore();

  const buy = (pkg: (typeof CURRENCY.STAR_CORAL_PACKAGES)[number]) => {
    if (!confirm(`${pkg.name} 구매\n₩${pkg.priceKRW.toLocaleString()} → Star Coral ${pkg.amount + pkg.bonus}개`)) return;
    addStarCoral(pkg.amount + pkg.bonus);
    alert(`✅ Star Coral ${pkg.amount + pkg.bonus}개 획득!`);
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
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Star Coral 충전</p>
        {CURRENCY.STAR_CORAL_PACKAGES.map(pkg => (
          <button key={pkg.id} onClick={() => buy(pkg)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', borderRadius: 12, padding: 14, color: '#fff', textAlign: 'left' }}>
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
            <span style={{ background: 'var(--color-accent)', color: '#0a1628', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
              ₩{pkg.priceKRW.toLocaleString()}
            </span>
          </button>
        ))}

        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginTop: 12 }}>알 구매</p>
        {[
          { name: '기본 알 🥚', desc: '100 Pearl', bg: 'var(--color-rarity-common)' },
          { name: '희귀 알 🥚', desc: '50 Star Coral', bg: 'var(--color-rarity-rare)' },
          { name: '전설 알 🥚', desc: '150 Star Coral', bg: 'var(--color-rarity-legendary)' },
        ].map(item => (
          <button key={item.name} onClick={() => alert('IAP 연동 후 구매 가능합니다.')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', borderRadius: 12, padding: 14, color: '#fff' }}>
            <div style={{ fontWeight: 600 }}>{item.name}</div>
            <span style={{ background: item.bg, color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>{item.desc}</span>
          </button>
        ))}
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}
