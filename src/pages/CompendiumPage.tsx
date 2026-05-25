import React, { useState } from 'react';
import { useFishStore } from '@/store/useFishStore';
import { useUserStore } from '@/store/useUserStore';
import { COMPENDIUM_MILESTONES, COMPENDIUM_REWARDS, CompendiumReward } from '@/constants';

const RARITY_COLOR: Record<string, string> = {
  common: 'var(--color-rarity-common)', rare: 'var(--color-rarity-rare)',
  epic: 'var(--color-rarity-epic)', legendary: 'var(--color-rarity-legendary)',
};
const RARITY_LABEL: Record<string, string> = { common: '커먼', rare: '레어', epic: '에픽', legendary: '레전더리' };

function rewardLabel(r: CompendiumReward): string {
  if (r.type === 'pearl') return `🪙 ${r.amount}`;
  if (r.type === 'star_coral') return `🌸 ${r.amount}`;
  return r.tier === 'basic' ? '🥚 기본 알' : r.tier === 'rare' ? '💎 희귀 알' : '✨ 전설 알';
}

export default function CompendiumPage() {
  const { allSpecies } = useFishStore();
  const { user, claimCompendiumMilestone } = useUserStore();
  const [toast, setToast] = useState('');
  const collected = user?.collectedSpecies ?? [];
  const claimed = user?.claimedCompendiumMilestones ?? [];
  const pct = Math.round((collected.length / allSpecies.length) * 100);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleClaim = (milestone: number) => {
    const reward = claimCompendiumMilestone(milestone, collected.length, allSpecies.length);
    if (!reward) {
      showToast('아직 청구할 수 없습니다');
      return;
    }
    showToast(`🎉 ${milestone}% 보상 획득 · ${rewardLabel(reward)}`);
  };

  return (
    <div className="page">
      <div className="page-header">도감</div>
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{collected.length}/{allSpecies.length}</span>
        <div style={{ flex: 1, height: 6, background: 'var(--color-surface)', borderRadius: 3 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-accent)', borderRadius: 3 }} />
        </div>
        <span style={{ color: 'var(--color-accent)', fontSize: 13, fontWeight: 600 }}>{pct}%</span>
      </div>

      {/* 마일스톤 보상 트랙 */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
          마일스톤 보상
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {COMPENDIUM_MILESTONES.map(m => {
            const reward = COMPENDIUM_REWARDS[m];
            const isClaimed = claimed.includes(m);
            const isReachable = pct >= m;
            const canClaim = isReachable && !isClaimed;
            return (
              <button
                key={m}
                onClick={canClaim ? () => handleClaim(m) : undefined}
                disabled={!canClaim}
                style={{
                  flex: '0 0 auto', minWidth: 72, padding: '8px 6px',
                  background: isClaimed
                    ? 'rgba(76, 175, 80, 0.15)'
                    : canClaim
                      ? 'rgba(255, 215, 0, 0.18)'
                      : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isClaimed
                    ? 'rgba(76, 175, 80, 0.5)'
                    : canClaim
                      ? 'rgba(255, 215, 0, 0.6)'
                      : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 10, color: '#fff',
                  cursor: canClaim ? 'pointer' : 'default',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  opacity: isReachable || isClaimed ? 1 : 0.55,
                }}
              >
                <span style={{ fontSize: 11, color: canClaim ? '#ffd54f' : 'var(--color-text-secondary)', fontWeight: 700 }}>
                  {m}%
                </span>
                <span style={{ fontSize: 14 }}>{rewardLabel(reward)}</span>
                <span style={{
                  fontSize: 9,
                  color: isClaimed ? '#81c784' : canClaim ? '#ffd54f' : 'var(--color-text-disabled)',
                  fontWeight: 600,
                }}>
                  {isClaimed ? '✓ 수령' : canClaim ? '청구!' : '잠금'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px 16px' }}>
        {allSpecies.map(s => {
          const unlocked = collected.includes(s.id);
          return (
            <div key={s.id} className="card" style={{ cursor: 'pointer' }}>
              <div style={{ height: 100, background: unlocked ? 'var(--color-bg-light)' : 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, overflow: 'hidden' }}>
                {unlocked ? (
                  <img
                    src={`${import.meta.env.BASE_URL}${s.thumbnailPath}`}
                    alt={s.name}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent && !parent.querySelector('.thumb-fallback')) {
                        const span = document.createElement('span');
                        span.className = 'thumb-fallback';
                        span.textContent = '🐟';
                        span.style.fontSize = '48px';
                        parent.appendChild(span);
                      }
                    }}
                  />
                ) : '❓'}
              </div>
              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: unlocked ? '#fff' : 'var(--color-text-disabled)' }}>
                  {unlocked ? s.name : '???'}
                </span>
                <span style={{ display: 'inline-block', alignSelf: 'flex-start', background: RARITY_COLOR[s.rarity], color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                  {RARITY_LABEL[s.rarity]}
                </span>
                {unlocked && <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s.habitat}</span>}
              </div>
            </div>
          );
        })}
      </div>

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
