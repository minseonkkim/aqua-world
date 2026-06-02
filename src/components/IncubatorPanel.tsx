import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { Egg, EggTier } from '@/types';
import { isCloudUser, optimistic, startHatching as startHatchingServer } from '@/services/firebase/functions';

const TIER_EMOJI: Record<string, string> = { basic: '🥚', rare: '💎', legendary: '✨' };
const TIER_LABEL: Record<string, string> = { basic: '기본 알', rare: '희귀 알', legendary: '전설 알' };
const TIER_COLOR: Record<string, string> = {
  basic: 'var(--color-rarity-common)',
  rare: 'var(--color-rarity-rare)',
  legendary: 'var(--color-rarity-legendary)',
};

function formatTime(sec: number): string {
  if (sec <= 0) return '완료!';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

interface EggCardProps {
  egg: Egg;
  onStart: () => void;
  onCollect: () => void;
}

function EggCard({ egg, onStart, onCollect }: EggCardProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!egg.isHatching) return;
    const tick = () => {
      const elapsed = (Date.now() - egg.startedAt) / 1000;
      setRemaining(Math.max(0, egg.hatchDuration - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [egg.isHatching, egg.startedAt, egg.hatchDuration]);

  const isReady = egg.isHatching && remaining <= 0;
  const pct = egg.isHatching
    ? Math.min(100, ((Date.now() - egg.startedAt) / 1000 / egg.hatchDuration) * 100)
    : 0;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.06)',
      borderRadius: 12,
      padding: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{ fontSize: 32 }}>{TIER_EMOJI[egg.tier]}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>{TIER_LABEL[egg.tier]}</span>
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: TIER_COLOR[egg.tier], color: '#fff',
          }}>
            {egg.tier.toUpperCase()}
          </span>
        </div>

        {egg.isHatching && (
          <>
            <div style={{
              height: 4, borderRadius: 2,
              background: 'rgba(255,255,255,0.1)',
              overflow: 'hidden',
              marginBottom: 4,
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${pct}%`,
                background: isReady ? 'var(--color-success)' : 'var(--color-accent)',
                transition: 'width 1s linear',
              }} />
            </div>
            <div style={{ fontSize: 12, color: isReady ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
              {isReady ? '🎉 부화 완료!' : `⏳ ${formatTime(remaining)}`}
            </div>
          </>
        )}
      </div>

      {!egg.isHatching && (
        <button onClick={onStart} style={{
          background: 'var(--color-primary)', color: '#fff',
          border: 'none', borderRadius: 8, padding: '6px 12px',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          부화 시작
        </button>
      )}
      {isReady && (
        <button onClick={onCollect} style={{
          background: 'var(--color-success)', color: '#fff',
          border: 'none', borderRadius: 8, padding: '6px 12px',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          animation: 'pulse 1s infinite',
        }}>
          수확! 🐟
        </button>
      )}
    </div>
  );
}

interface Props {
  /** 알이 부화 가능 상태에서 수확 버튼이 눌렸을 때. 종 추첨 + 인벤토리 제거는 부모에서 처리. */
  onCollect: (eggId: string, eggTier: EggTier) => void;
}

export default function IncubatorPanel({ onCollect }: Props) {
  const [open, setOpen] = useState(false);
  const { user, startHatching } = useUserStore();

  const handleStart = (eggId: string) => {
    if (isCloudUser()) {
      optimistic(
        () => startHatching(eggId),
        () => startHatchingServer({ eggId }),
      );
      return;
    }
    startHatching(eggId);
  };

  const inventory = user?.inventory ?? [];

  if (inventory.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'absolute', left: 12, bottom: 80,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 12, padding: '8px 14px',
          color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        🥚 {inventory.length}
      </button>

      {open && (
        <div style={{
          position: 'absolute', left: 12, bottom: 130,
          width: 300,
          background: 'rgba(10,22,40,0.95)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16,
          padding: 16,
          backdropFilter: 'blur(12px)',
          maxHeight: 340,
          overflowY: 'auto',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>
            🥚 인큐베이터 ({inventory.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inventory.map(egg => (
              <EggCard
                key={egg.id}
                egg={egg}
                onStart={() => handleStart(egg.id)}
                onCollect={() => {
                  onCollect(egg.id, egg.tier);
                  if (inventory.length <= 1) setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
