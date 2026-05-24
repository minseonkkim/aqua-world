import React from 'react';
import { useFishStore } from '@/store/useFishStore';
import { useUserStore } from '@/store/useUserStore';

const RARITY_COLOR: Record<string, string> = {
  common: 'var(--color-rarity-common)', rare: 'var(--color-rarity-rare)',
  epic: 'var(--color-rarity-epic)', legendary: 'var(--color-rarity-legendary)',
};
const RARITY_LABEL: Record<string, string> = { common: '커먼', rare: '레어', epic: '에픽', legendary: '레전더리' };

export default function CompendiumPage() {
  const { allSpecies } = useFishStore();
  const { user } = useUserStore();
  const collected = user?.collectedSpecies ?? [];
  const pct = Math.round((collected.length / allSpecies.length) * 100);

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px 16px' }}>
        {allSpecies.map(s => {
          const unlocked = collected.includes(s.id);
          return (
            <div key={s.id} className="card" style={{ cursor: 'pointer' }}>
              <div style={{ height: 100, background: unlocked ? 'var(--color-bg-light)' : 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: unlocked ? 48 : 36 }}>
                {unlocked ? '🐟' : '❓'}
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
    </div>
  );
}
