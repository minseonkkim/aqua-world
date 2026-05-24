import React, { useEffect, useMemo, useState } from 'react';
import { EggTier } from '@/types';
import { useFishStore } from '@/store/useFishStore';

type Phase = 'shake' | 'crack' | 'flash' | 'reveal';

const TIER_GLOW: Record<EggTier, string> = {
  basic: '#7ec8ff',
  rare: '#b48bff',
  legendary: '#ffd24a',
};

const TIER_EMOJI: Record<EggTier, string> = {
  basic: '🥚',
  rare: '💎',
  legendary: '✨',
};

const RARITY_LABEL: Record<string, string> = {
  common: '일반',
  rare: '레어',
  epic: '에픽',
  legendary: '전설',
};

const RARITY_COLOR: Record<string, string> = {
  common: 'var(--color-rarity-common)',
  rare: 'var(--color-rarity-rare)',
  epic: 'var(--color-rarity-epic)',
  legendary: 'var(--color-rarity-legendary)',
};

interface Props {
  speciesId: string;
  eggTier: EggTier;
  onComplete: () => void;
}

export default function HatchAnimationModal({ speciesId, eggTier, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('shake');
  const { getSpeciesById } = useFishStore();
  const species = useMemo(() => getSpeciesById(speciesId), [getSpeciesById, speciesId]);
  const glow = TIER_GLOW[eggTier];
  const rarity = species?.rarity ?? 'common';

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('crack'), 1200);
    const t2 = setTimeout(() => setPhase('flash'), 2100);
    const t3 = setTimeout(() => setPhase('reveal'), 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 방사형 광채 배경 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at center, ${glow}55 0%, transparent 60%)`,
          opacity: phase === 'flash' ? 1 : phase === 'reveal' ? 0.7 : 0.3,
          transition: 'opacity 0.4s',
          animation: phase === 'reveal' ? 'aw-spin 12s linear infinite' : 'none',
        }}
      />

      {/* 플래시 오버레이 */}
      {phase === 'flash' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#fff',
            animation: 'aw-flash 0.4s ease-out forwards',
          }}
        />
      )}

      {/* 알 (shake/crack 단계) */}
      {phase !== 'reveal' && (
        <div
          style={{
            fontSize: 120,
            filter: `drop-shadow(0 0 24px ${glow})`,
            animation:
              phase === 'shake'
                ? 'aw-shake 0.25s ease-in-out infinite'
                : phase === 'crack'
                  ? 'aw-crack 0.9s ease-in-out forwards'
                  : 'none',
          }}
        >
          {TIER_EMOJI[eggTier]}
        </div>
      )}

      {/* 종 공개 */}
      {phase === 'reveal' && species && (
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            animation: 'aw-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
            padding: '0 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${RARITY_COLOR[rarity]}66, ${RARITY_COLOR[rarity]}11)`,
              border: `3px solid ${RARITY_COLOR[rarity]}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 72,
              boxShadow: `0 0 36px ${RARITY_COLOR[rarity]}`,
            }}
          >
            🐟
          </div>

          <div style={{ fontSize: 13, opacity: 0.85, letterSpacing: 4, fontWeight: 600 }}>
            NEW DISCOVERY
          </div>

          <div style={{ fontSize: 30, fontWeight: 800, color: '#fff' }}>{species.name}</div>

          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 999,
              background: RARITY_COLOR[rarity],
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {RARITY_LABEL[rarity]}
          </div>

          <div
            style={{
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              fontStyle: 'italic',
              marginTop: -4,
            }}
          >
            {species.scientificName}
          </div>

          <div
            style={{
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              maxWidth: 320,
              lineHeight: 1.5,
            }}
          >
            {species.description}
          </div>

          <button
            onClick={onComplete}
            style={{
              marginTop: 8,
              background: 'var(--color-accent)',
              color: '#0a1628',
              border: 'none',
              borderRadius: 14,
              padding: '14px 32px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: `0 4px 18px ${glow}`,
            }}
          >
            수조에 추가하기 🌊
          </button>
        </div>
      )}

      <style>{`
        @keyframes aw-shake {
          0%, 100% { transform: rotate(-4deg) translateY(0); }
          50% { transform: rotate(4deg) translateY(-6px); }
        }
        @keyframes aw-crack {
          0% { transform: scale(1) rotate(0); }
          30% { transform: scale(1.15) rotate(-8deg); }
          60% { transform: scale(0.95) rotate(8deg); }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes aw-flash {
          0% { opacity: 0; }
          40% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes aw-pop {
          0% { transform: scale(0.4); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes aw-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
