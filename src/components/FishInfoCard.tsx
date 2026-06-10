import React, { useEffect, useState, useMemo } from 'react';
import { Fish } from '@/types';
import { useFishStore } from '@/store/useFishStore';
import { useTankStore } from '@/store/useTankStore';
import { computeGrowth, formatRemaining } from '@/utils/growth';
import { computeFishComfort, comfortToMood } from '@/utils/mood';

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

const GROWTH_EMOJI: Record<string, string> = {
  egg: '🥚', fry: '🐟', juvenile: '🐠', adult: '🐡', large: '🦈',
};

interface Props {
  fish: Fish;
  feedRemaining: number;
  /** 오늘 무료 먹이 최대 횟수(수조 규모 기반) */
  feedMax: number;
  /** 보유 먹이 티켓 수 */
  feedTickets: number;
  onClose: () => void;
  onFeed: () => void;
  /** 이 물고기를 수조에서 빼서 보관함으로 이동 */
  onStore?: () => void;
}

export default function FishInfoCard({ fish, feedRemaining, feedMax, feedTickets, onClose, onFeed, onStore }: Props) {
  const { getSpeciesById } = useFishStore();
  const species = getSpeciesById(fish.speciesId);
  const activeTank = useTankStore(s => s.tanks.find(t => t.id === s.activeTankId) ?? null);

  const rarity = species?.rarity ?? 'common';
  const color = RARITY_COLORS[rarity];

  // 매초 성장 진행도 갱신
  const [snapshot, setSnapshot] = useState(() => computeGrowth(fish));
  useEffect(() => {
    setSnapshot(computeGrowth(fish));
    const id = setInterval(() => setSnapshot(computeGrowth(fish)), 1000);
    return () => clearInterval(id);
  }, [fish]);

  // 쾌적도 — 카드 열 때 한 번 계산 (tank/fish 의존성으로 갱신)
  const comfort = useMemo(
    () => activeTank ? computeFishComfort(fish, activeTank) : null,
    [fish, activeTank],
  );
  const displayMood = comfort ? comfortToMood(comfort.total) : fish.mood;
  const comfortColor =
    !comfort ? '#888'
    : comfort.total >= 70 ? '#4caf50'
    : comfort.total >= 35 ? '#ffb74d'
    : '#e57373';

  const isMax = fish.growthStage === 'large';
  const usingTicket = feedRemaining <= 0 && feedTickets > 0;
  // large(최종 단계)도 먹일 수 있다 — 성장은 멈췄지만 배고픔/기분에 영향을 준다.
  const canFeed = feedRemaining > 0 || feedTickets > 0;

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
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 20px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: `${color}33`,
            border: `2px solid ${color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, overflow: 'hidden',
          }}>
            {species?.thumbnailPath ? (
              <img
                src={`${import.meta.env.BASE_URL}${species.thumbnailPath}`}
                alt={species.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = 'none';
                  const parent = img.parentElement;
                  if (parent && !parent.querySelector('.fish-icon-fallback')) {
                    const span = document.createElement('span');
                    span.className = 'fish-icon-fallback';
                    span.textContent = GROWTH_EMOJI[fish.growthStage];
                    parent.appendChild(span);
                  }
                }}
              />
            ) : GROWTH_EMOJI[fish.growthStage]}
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
          <div style={{ fontSize: 22 }}>{MOOD_EMOJI[displayMood]}</div>
        </div>

        {/* 쾌적도 게이지 */}
        {comfort && (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                쾌적도 — <span style={{ color: comfortColor, fontWeight: 700 }}>{comfort.total}</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>/100</span>
              </div>
              <div style={{ fontSize: 11, color: comfortColor, fontWeight: 600 }}>
                {displayMood === 'happy' ? '행복' : displayMood === 'bored' ? '심심함' : '평범'}
              </div>
            </div>
            <div style={{
              height: 8, borderRadius: 4,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${comfort.total}%`,
                background: comfortColor,
                transition: 'width 0.4s ease',
              }} />
            </div>
            {comfort.tips.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {comfort.tips.slice(0, 2).map((tip, idx) => (
                  <div key={idx} style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    💡 {tip}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 성장 진행도 */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              성장 단계 — <span style={{ color: '#fff', fontWeight: 600 }}>{GROWTH_LABELS[fish.growthStage]}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {isMax ? '최대 단계' : formatRemaining(snapshot.remainingSeconds)}
            </div>
          </div>
          <div style={{
            height: 8, borderRadius: 4,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${snapshot.progress}%`,
              background: isMax
                ? 'linear-gradient(90deg, var(--color-accent), #ff8f00)'
                : `linear-gradient(90deg, var(--color-primary-light), var(--color-secondary))`,
              transition: 'width 1s linear',
            }} />
          </div>
        </div>

        {/* 스탯 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: '서식지', value: species?.habitat ?? '-' },
            { label: '먹이 횟수', value: `${fish.feedCount}회` },
            { label: '기분', value: displayMood === 'happy' ? '행복' : displayMood === 'bored' ? '심심함' : '평범' },
            { label: '성장 가속', value: `+${Math.floor((fish.growthBoostSeconds || 0) / 60)}분` },
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

        {onStore && (
          <button
            className="btn"
            onClick={onStore}
            style={{
              width: '100%', marginBottom: 8,
              background: 'rgba(255,255,255,0.08)',
              color: 'var(--color-text-secondary)',
            }}
          >
            📦 보관함에 넣기
          </button>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            disabled={!canFeed}
            onClick={onFeed}
            style={{
              flex: 1,
              background: canFeed ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)',
              color: canFeed ? '#fff' : 'var(--color-text-disabled)',
              cursor: canFeed ? 'pointer' : 'not-allowed',
            }}
          >
            {usingTicket
              ? `🎟️ 티켓 먹이주기 (${feedTickets}장)`
              : `🍖 먹이주기 (${feedRemaining}/${feedMax})`}
          </button>
          <button
            className="btn"
            style={{ flex: 1, background: 'rgba(255,255,255,0.08)' }}
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
