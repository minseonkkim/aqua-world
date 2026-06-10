import React, { useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useFishStore } from '@/store/useFishStore';
import { Fish } from '@/types';

const RARITY_COLOR: Record<string, string> = {
  common: 'var(--color-rarity-common)',
  rare: 'var(--color-rarity-rare)',
  epic: 'var(--color-rarity-epic)',
  legendary: 'var(--color-rarity-legendary)',
};

const RARITY_LABEL: Record<string, string> = {
  common: '일반', rare: '레어', epic: '에픽', legendary: '전설',
};

const STAGE_EMOJI: Record<string, string> = {
  egg: '🥚', fry: '🐟', juvenile: '🐠', adult: '🐡', large: '🦈',
};

const STAGE_LABEL: Record<string, string> = {
  egg: '알', fry: '치어', juvenile: '어린 물고기', adult: '성어', large: '대형어',
};

// 안정적인 빈 배열 — 셀렉터에서 매번 새 []를 반환하면 무한 렌더 발생
const EMPTY_FISH: Fish[] = [];

interface Props {
  /** 보관함 → 수조 배치. 용량 검증/토스트는 부모가 처리. */
  onPlace: (fishId: string) => void;
  /** 수조 확장 */
  onExpand: () => void;
  /** 현재 활성 수조의 물고기 수 */
  tankFishCount: number;
  /** 현재 수조 마릿수 상한 */
  capacity: number;
  /** 더 확장 가능한지 */
  canExpand: boolean;
  /** 확장 비용(Pearl). canExpand=false면 null */
  expandCost: number | null;
  /** 패널 열림 상태 (부모가 제어 — 좌측 패널 상호 배타) */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FishRow({ fish, full, onPlace }: { fish: Fish; full: boolean; onPlace: () => void }) {
  const species = useFishStore(s => s.getSpeciesById(fish.speciesId));
  const rarity = species?.rarity ?? 'common';
  const color = RARITY_COLOR[rarity];
  // 도감 썸네일 우선 표시 — 누락/로드 실패 시 성장단계 이모지로 폴백 (FishInfoCard 와 동일 규칙)
  const [imgError, setImgError] = useState(false);
  const showImage = !!species?.thumbnailPath && !imgError;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.06)',
      borderRadius: 12,
      padding: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
        background: `${color}33`, border: `2px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>
        {showImage ? (
          <img
            src={`${import.meta.env.BASE_URL}${species!.thumbnailPath}`}
            alt={species!.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={() => setImgError(true)}
          />
        ) : STAGE_EMOJI[fish.growthStage]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {fish.name}
          </span>
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: color, color: '#fff', flexShrink: 0 }}>
            {RARITY_LABEL[rarity]}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {STAGE_LABEL[fish.growthStage]}
        </div>
      </div>
      <button
        onClick={onPlace}
        disabled={full}
        style={{
          background: full ? 'rgba(255,255,255,0.08)' : 'var(--color-primary)',
          color: full ? 'var(--color-text-disabled)' : '#fff',
          border: 'none', borderRadius: 8, padding: '6px 10px',
          fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
          cursor: full ? 'not-allowed' : 'pointer',
        }}
      >
        넣기
      </button>
    </div>
  );
}

export default function FishInventoryPanel({ onPlace, onExpand, tankFishCount, capacity, canExpand, expandCost, open, onOpenChange }: Props) {
  const fishInventory = useUserStore(s => s.user?.fishInventory) ?? EMPTY_FISH;

  const full = tankFishCount >= capacity;

  return (
    <>
      <button
        onClick={() => onOpenChange(!open)}
        style={{
          position: 'absolute', left: 12, bottom: 130,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 12, padding: '8px 14px',
          color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          zIndex: open ? 71 : 'auto',
        }}
      >
        📦 {fishInventory.length}
      </button>

      {open && (
        <div style={{
          position: 'absolute', left: 12, bottom: 180,
          width: 280,
          background: 'rgba(10,22,40,0.95)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 14,
          padding: 14,
          backdropFilter: 'blur(12px)',
          maxHeight: 380,
          display: 'flex', flexDirection: 'column',
          zIndex: 70,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📦 보관함 ({fishInventory.length})</div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: full ? '#e57373' : 'var(--color-text-secondary)',
            }}>
              수조 🐟 {tankFishCount}/{capacity}
            </div>
          </div>

          {/* 수조 확장 */}
          <button
            onClick={onExpand}
            disabled={!canExpand}
            style={{
              width: '100%', marginBottom: 10,
              background: canExpand ? 'rgba(77,208,225,0.18)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${canExpand ? 'rgba(77,208,225,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 10, padding: '8px 12px',
              color: canExpand ? '#fff' : 'var(--color-text-disabled)',
              fontSize: 12, fontWeight: 600,
              cursor: canExpand ? 'pointer' : 'not-allowed',
            }}
          >
            {canExpand ? `🔧 수조 확장 · ${expandCost} 🪙` : '🔧 최대 크기예요'}
          </button>

          {fishInventory.length === 0 ? (
            <div style={{
              fontSize: 12, color: 'var(--color-text-secondary)',
              textAlign: 'center', padding: '16px 8px', lineHeight: 1.6,
            }}>
              보관 중인 물고기가 없어요.<br />
              수조가 가득 차면 새 물고기가<br />여기에 보관돼요.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              {fishInventory.map(fish => (
                <FishRow key={fish.id} fish={fish} full={full} onPlace={() => onPlace(fish.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
