import React from 'react';
import { Fish } from '@/types';
import { useFishStore } from '@/store/useFishStore';

const RARITY_COLORS: Record<string, string> = {
  common: 'var(--color-rarity-common)',
  rare: 'var(--color-rarity-rare)',
  epic: 'var(--color-rarity-epic)',
  legendary: 'var(--color-rarity-legendary)',
};

const RARITY_LABELS: Record<string, string> = {
  common: '일반', rare: '레어', epic: '에픽', legendary: '전설',
};

const MOOD_EMOJI: Record<string, string> = {
  happy: '😊', normal: '😐', bored: '😴',
};

const GROWTH_LABELS: Record<string, string> = {
  egg: '알', fry: '치어', juvenile: '어린 물고기', adult: '성어', large: '대형어',
};

interface Props {
  fish: Fish;
  onClose: () => void;
}

export default function FishInfoCard({ fish, onClose }: Props) {
  const { getSpeciesById } = useFishStore();
  const species = getSpeciesById(fish.speciesId);

  const rarity = species?.rarity ?? 'common';
  const color = RARITY_COLORS[rarity];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 480,
          background: 'var(--color-bg-light)',
          borderRadius: '24px 24px 0 0',
          padding: '20px 20px 32px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 드래그 핸들 */}
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 20px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: `${color}33`,
            border: `2px solid ${color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>
            🐟
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{fish.name}</span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 6,
                background: color, color: '#fff', fontWeight: 600,
              }}>
                {RARITY_LABELS[rarity]}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
              {species?.scientificName}
            </div>
          </div>
          <div style={{ fontSize: 22 }}>{MOOD_EMOJI[fish.mood]}</div>
        </div>

        {/* 스탯 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: '성장 단계', value: GROWTH_LABELS[fish.growthStage] },
            { label: '서식지', value: species?.habitat ?? '-' },
            { label: '먹이 횟수', value: `${fish.feedCount}회` },
            { label: '기분', value: fish.mood === 'happy' ? '행복' : fish.mood === 'bored' ? '심심함' : '평범' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 10,
              padding: '10px 12px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* 설명 */}
        {species?.description && (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 10,
            padding: '12px',
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
            marginBottom: 16,
          }}>
            {species.description}
          </div>
        )}

        <button
          className="btn"
          style={{ width: '100%', background: 'rgba(255,255,255,0.08)' }}
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
