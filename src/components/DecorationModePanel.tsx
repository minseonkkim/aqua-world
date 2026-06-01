import React, { useState, useMemo } from 'react';
import { DECORATION_CATALOG, DecorationMeta } from '@/utils/decorationModels';
import { TankDecoration, DecorationPreset } from '@/types';
import { useUserStore } from '@/store/useUserStore';
import { playSFX } from '@/services/audio';

type CategoryFilter = 'all' | 'plant' | 'rock' | 'driftwood' | 'ornament';

// 모듈 레벨 상수 — 매 렌더마다 새 객체 생성 방지 (zustand 셀렉터 안정성)
const EMPTY_INVENTORY: Record<string, number> = {};

const CATEGORY_LABEL: Record<CategoryFilter, string> = {
  all: '전체',
  plant: '🌿 수초',
  rock: '🪨 바위',
  driftwood: '🪵 유목',
  ornament: '🎁 장식',
};

interface Props {
  selectedDecoration: TankDecoration | null;
  presets: DecorationPreset[];
  onAdd: (modelId: string) => void;
  onExit: () => void;
  onDelete: (id: string) => void;
  onRotate: (id: string, deltaY: number) => void;
  onScale: (id: string, delta: number) => void;
  onSavePreset: (slot: number) => void;
  onLoadPreset: (slot: number) => void;
  onDeletePreset: (slot: number) => void;
  onShopRedirect: () => void;
}

export default function DecorationModePanel({
  selectedDecoration, presets, onAdd, onExit, onDelete, onRotate, onScale,
  onSavePreset, onLoadPreset, onDeletePreset, onShopRedirect,
}: Props) {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [presetsOpen, setPresetsOpen] = useState(false);
  const inventory = useUserStore(s => s.user?.decorationInventory) ?? EMPTY_INVENTORY;

  const items: DecorationMeta[] = useMemo(
    () => (filter === 'all' ? DECORATION_CATALOG : DECORATION_CATALOG.filter(d => d.type === filter)),
    [filter],
  );

  return (
    <>
      {/* 상단 헤더 — 모드 진입 표시 + 프리셋 토글 + 종료 */}
      <div style={{
        position: 'absolute', top: 'calc(var(--safe-top) + 56px)', left: '50%',
        transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8,
        flexWrap: 'nowrap', whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 16px)',
        background: 'rgba(20, 30, 50, 0.85)', borderRadius: 24, padding: '6px 14px',
        border: '1px solid rgba(77, 208, 225, 0.5)', backdropFilter: 'blur(8px)',
        zIndex: 50,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#4dd0e1', whiteSpace: 'nowrap', flexShrink: 0 }}>🪴 꾸미기 모드</span>
        <button onClick={() => setPresetsOpen(v => !v)} style={{
          background: presetsOpen ? 'rgba(77, 208, 225, 0.3)' : 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 16,
          padding: '4px 12px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>💾 프리셋</button>
        <button onClick={onExit} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 16,
          padding: '4px 12px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>완료</button>
      </div>

      {/* 프리셋 슬롯 패널 */}
      {presetsOpen && (
        <div style={{
          position: 'absolute', top: 'calc(var(--safe-top) + 100px)', left: '50%',
          transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 6,
          background: 'rgba(10, 22, 40, 0.95)', borderRadius: 12, padding: 10,
          border: '1px solid rgba(77, 208, 225, 0.4)', minWidth: 260, zIndex: 50,
        }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: 2 }}>
            현재 배치를 슬롯에 저장하거나 불러옵니다
          </div>
          {[0, 1, 2].map(slot => {
            const preset = presets.find(p => p.slot === slot);
            return (
              <div key={slot} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 8px',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', minWidth: 50 }}>
                  슬롯 {slot + 1}
                </span>
                {preset ? (
                  <>
                    <span style={{ flex: 1, fontSize: 10, color: 'var(--color-text-secondary)' }}>
                      🪴 {preset.decorations.length}개 · {formatRelative(preset.savedAt)}
                    </span>
                    <button onClick={() => onLoadPreset(slot)} style={presetBtn('#4dd0e1')}>불러오기</button>
                    <button onClick={() => onSavePreset(slot)} style={presetBtn('#ffd54f')}>덮어쓰기</button>
                    <button onClick={() => onDeletePreset(slot)} style={presetBtn('#ef5350')}>🗑</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 10, color: 'var(--color-text-disabled)' }}>(비어있음)</span>
                    <button onClick={() => onSavePreset(slot)} style={presetBtn('#4dd0e1')}>저장</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

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
        {/* 아이템 가로 스크롤 — 보유 수량 표시, 미보유는 상점 안내 */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 4 }}>
          {items.map(item => {
            const count = inventory[item.modelId] ?? 0;
            const owned = count > 0;
            return (
              <button
                key={item.modelId}
                onClick={owned ? () => { playSFX('place'); onAdd(item.modelId); } : onShopRedirect}
                style={{
                  flex: '0 0 auto', width: 76, height: 96, position: 'relative',
                  background: owned ? 'rgba(77, 208, 225, 0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${owned ? 'rgba(77, 208, 225, 0.35)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12, padding: '6px 4px',
                  color: owned ? '#fff' : 'var(--color-text-disabled)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', opacity: owned ? 1 : 0.7,
                }}
              >
                <span style={{ fontSize: 28, lineHeight: 1, filter: owned ? 'none' : 'grayscale(80%)' }}>
                  {item.emoji}
                </span>
                <span style={{ fontSize: 10, textAlign: 'center', lineHeight: 1.2 }}>{item.name}</span>
                {owned ? (
                  <span style={{ fontSize: 10, color: '#4dd0e1', fontWeight: 700 }}>×{count}</span>
                ) : (
                  <span style={{ fontSize: 9, color: '#ffd54f' }}>🛒 상점</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function presetBtn(color: string): React.CSSProperties {
  return {
    background: `${color}22`, border: `1px solid ${color}55`, color,
    borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}
