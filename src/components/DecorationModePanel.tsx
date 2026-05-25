import React, { useState, useMemo } from 'react';
import { DECORATION_CATALOG, DecorationMeta } from '@/utils/decorationModels';
import { TankDecoration } from '@/types';

type CategoryFilter = 'all' | 'plant' | 'rock' | 'driftwood' | 'ornament';

const CATEGORY_LABEL: Record<CategoryFilter, string> = {
  all: '전체',
  plant: '🌿 수초',
  rock: '🪨 바위',
  driftwood: '🪵 유목',
  ornament: '🎁 장식',
};

interface Props {
  selectedDecoration: TankDecoration | null;
  onAdd: (modelId: string) => void;
  onExit: () => void;
  onDelete: (id: string) => void;
  onRotate: (id: string, deltaY: number) => void;
  onScale: (id: string, delta: number) => void;
}

export default function DecorationModePanel({
  selectedDecoration, onAdd, onExit, onDelete, onRotate, onScale,
}: Props) {
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const items: DecorationMeta[] = useMemo(
    () => (filter === 'all' ? DECORATION_CATALOG : DECORATION_CATALOG.filter(d => d.type === filter)),
    [filter],
  );

  return (
    <>
      {/* 상단 헤더 — 모드 진입 표시 + 종료 */}
      <div style={{
        position: 'absolute', top: 'calc(var(--safe-top) + 56px)', left: '50%',
        transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(20, 30, 50, 0.85)', borderRadius: 24, padding: '6px 14px',
        border: '1px solid rgba(77, 208, 225, 0.5)', backdropFilter: 'blur(8px)',
        zIndex: 50,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#4dd0e1' }}>🪴 꾸미기 모드</span>
        <button onClick={onExit} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 16,
          padding: '4px 12px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>완료</button>
      </div>

      {/* 선택된 데코 조작 패널 (우측) */}
      {selectedDecoration && (
        <div style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', gap: 6,
          background: 'rgba(0,0,0,0.75)', borderRadius: 12, padding: 8,
          border: '1px solid rgba(77, 208, 225, 0.4)', zIndex: 50,
        }}>
          {[
            { icon: '↻', label: '회전', action: () => onRotate(selectedDecoration.id, Math.PI / 8) },
            { icon: '＋', label: '크게', action: () => onScale(selectedDecoration.id, 0.1) },
            { icon: '－', label: '작게', action: () => onScale(selectedDecoration.id, -0.1) },
            { icon: '🗑', label: '삭제', action: () => onDelete(selectedDecoration.id) },
          ].map(btn => (
            <button key={btn.icon} onClick={btn.action} style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 11,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              cursor: 'pointer', minWidth: 48,
            }}>
              <span style={{ fontSize: 18 }}>{btn.icon}</span>
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* 하단 카탈로그 */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'rgba(10, 22, 40, 0.95)', borderTop: '1px solid rgba(77, 208, 225, 0.3)',
        padding: '8px 8px calc(var(--safe-bottom, 0px) + 8px)',
        zIndex: 50,
      }}>
        {/* 카테고리 탭 */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
          {(['all', 'plant', 'rock', 'driftwood', 'ornament'] as CategoryFilter[]).map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{
              background: filter === c ? 'rgba(77, 208, 225, 0.25)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${filter === c ? 'rgba(77, 208, 225, 0.6)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 16, padding: '5px 12px', color: '#fff', fontSize: 12,
              whiteSpace: 'nowrap', cursor: 'pointer',
            }}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        {/* 아이템 가로 스크롤 */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 4 }}>
          {items.map(item => (
            <button key={item.modelId} onClick={() => onAdd(item.modelId)} style={{
              flex: '0 0 auto', width: 76, height: 92,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, padding: '6px 4px', color: '#fff',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer',
            }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>{item.emoji}</span>
              <span style={{ fontSize: 10, textAlign: 'center', lineHeight: 1.2 }}>{item.name}</span>
              <span style={{ fontSize: 10, color: '#ffd54f' }}>🪙 {item.price}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
