import React, { useEffect, useMemo, useState } from 'react';
import { Fish } from '@/types';
import { useFishStore } from '@/store/useFishStore';
import { serverNow } from '@/services/clock';
import { isBreedable, breedCooldownRemaining, canPair } from '@/utils/breeding';
import { BREEDABLE_STAGES } from '@/constants';

const STAGE_EMOJI: Record<string, string> = { adult: '🐡', large: '🦈' };

function formatCooldown(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m >= 1) return `${m}m`;
  return `${Math.floor(sec)}s`;
}

interface Props {
  /** 활성 수조의 물고기들 (부모 후보) */
  fish: Fish[];
  /** 짝짓기 1회 비용 (Pearl) */
  costPearl: number;
  /** 보유 Pearl */
  pearl: number;
  /** 두 부모로 짝짓기 실행 */
  onBreed: (a: Fish, b: Fish) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BreedingPanel({ fish, costPearl, pearl, onBreed, open, onOpenChange }: Props) {
  const { getSpeciesById } = useFishStore();
  const [pickA, setPickA] = useState<string | null>(null);
  const [pickB, setPickB] = useState<string | null>(null);
  // 쿨다운 표시를 위해 1초마다 리렌더 (패널이 열려 있을 때만)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [open]);

  // 성어/대형어만 후보. 선택이 사라진 물고기(성장·보관 등)는 자동 해제.
  const candidates = useMemo(
    () => fish.filter(f => BREEDABLE_STAGES.includes(f.growthStage)),
    [fish],
  );
  useEffect(() => {
    if (pickA && !candidates.some(f => f.id === pickA)) setPickA(null);
    if (pickB && !candidates.some(f => f.id === pickB)) setPickB(null);
  }, [candidates, pickA, pickB]);

  // 수조에 물고기가 2마리 미만이면 버튼 자체를 숨긴다(짝짓기가 아직 무의미).
  // 성어가 부족한 경우엔 버튼은 보이되 패널 안에서 안내한다(발견 가능성 ↑).
  if (fish.length < 2) return null;
  const enoughAdults = candidates.length >= 2;

  const now = serverNow();
  const parentA = candidates.find(f => f.id === pickA) ?? null;
  const parentB = candidates.find(f => f.id === pickB) ?? null;

  const toggle = (f: Fish) => {
    if (pickA === f.id) { setPickA(null); return; }
    if (pickB === f.id) { setPickB(null); return; }
    if (!pickA) { setPickA(f.id); return; }
    if (!pickB) { setPickB(f.id); return; }
    // 둘 다 찼으면 A 를 교체
    setPickA(f.id);
  };

  const ready = parentA && parentB && canPair(parentA, parentB, now);
  const affordable = pearl >= costPearl;
  const canBreed = ready && affordable;

  const handleBreed = () => {
    if (!parentA || !parentB || !canBreed) return;
    onBreed(parentA, parentB);
    setPickA(null);
    setPickB(null);
  };

  // 선택 가능 여부: 이미 A 가 다른 종이면 다른 종은 비활성. 쿨다운/미성숙도 비활성.
  const selectable = (f: Fish): boolean => {
    if (!isBreedable(f, now)) return false;
    const other = pickA && pickA !== f.id ? parentA : pickB && pickB !== f.id ? parentB : null;
    if (other && other.speciesId !== f.speciesId) return false;
    return true;
  };

  return (
    <>
      <button
        onClick={() => onOpenChange(!open)}
        style={{
          position: 'absolute', left: 12, bottom: 30,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(255,107,157,0.5)',
          borderRadius: 12, padding: '8px 14px',
          color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          zIndex: open ? 71 : 'auto',
        }}
      >
        💞 짝짓기
      </button>

      {open && (
        <div style={{
          position: 'absolute', left: 12, bottom: 80,
          width: 288,
          background: 'rgba(10,22,40,0.95)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 14,
          padding: 14,
          backdropFilter: 'blur(12px)',
          maxHeight: 360,
          overflowY: 'auto',
          zIndex: 70,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>💞 짝짓기</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.4 }}>
            같은 종 성어 2마리를 골라 알을 얻어요. 부모는 사라지지 않고 잠시 쉬어요.
          </div>

          {/* 선택된 부모 슬롯 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <ParentSlot fish={parentA} label="부모 1" name={parentA ? getSpeciesById(parentA.speciesId)?.name : undefined} />
            <div style={{ fontSize: 18 }}>➕</div>
            <ParentSlot fish={parentB} label="부모 2" name={parentB ? getSpeciesById(parentB.speciesId)?.name : undefined} />
          </div>

          {/* 성어 후보가 부족하면 안내 */}
          {!enoughAdults && (
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 10, padding: '12px 12px',
              fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5,
              marginBottom: 10, textAlign: 'center',
            }}>
              같은 종 <b style={{ color: '#fff' }}>성어(🐡)</b> 이상 물고기가 <b style={{ color: '#fff' }}>2마리</b> 필요해요.<br />
              먹이를 줘서 성어까지 키워보세요!
            </div>
          )}

          {/* 후보 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {candidates.map(f => {
              const picked = pickA === f.id || pickB === f.id;
              const cd = breedCooldownRemaining(f, now);
              const enabled = selectable(f) || picked;
              const species = getSpeciesById(f.speciesId);
              return (
                <button
                  key={f.id}
                  disabled={!enabled}
                  onClick={() => toggle(f)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: picked ? 'rgba(255,107,157,0.22)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${picked ? 'rgba(255,107,157,0.7)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 10, padding: '7px 10px',
                    color: '#fff', textAlign: 'left',
                    cursor: enabled ? 'pointer' : 'not-allowed',
                    opacity: enabled ? 1 : 0.4,
                    width: '100%',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{STAGE_EMOJI[f.growthStage] ?? '🐟'}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.name}
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                      {species?.name}
                    </span>
                  </span>
                  {cd > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      ⏳ {formatCooldown(cd)}
                    </span>
                  )}
                  {picked && cd <= 0 && (
                    <span style={{ fontSize: 11, color: 'var(--color-star-coral)', fontWeight: 700 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {enoughAdults && (
            <button
              onClick={handleBreed}
              disabled={!canBreed}
              style={{
                width: '100%',
                background: canBreed ? 'var(--color-star-coral)' : 'rgba(255,255,255,0.08)',
                color: canBreed ? '#fff' : 'var(--color-text-disabled)',
                border: 'none', borderRadius: 10, padding: '10px 12px',
                fontSize: 13, fontWeight: 700,
                cursor: canBreed ? 'pointer' : 'not-allowed',
              }}
            >
              {!ready
                ? '같은 종 2마리를 선택하세요'
                : !affordable
                  ? `Pearl 부족 (${costPearl} 🪙 필요)`
                  : `💞 짝짓기 · ${costPearl} 🪙`}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function ParentSlot({ fish, label, name }: { fish: Fish | null; label: string; name?: string }) {
  return (
    <div style={{
      flex: 1,
      background: 'rgba(255,255,255,0.05)',
      border: `1px dashed ${fish ? 'rgba(255,107,157,0.6)' : 'rgba(255,255,255,0.15)'}`,
      borderRadius: 10, padding: '8px 6px',
      textAlign: 'center', minWidth: 0,
    }}>
      <div style={{ fontSize: 20 }}>{fish ? (STAGE_EMOJI[fish.growthStage] ?? '🐟') : '➖'}</div>
      <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {fish ? fish.name : label}
      </div>
      {fish && name && (
        <div style={{ fontSize: 9, color: 'var(--color-text-secondary)' }}>{name}</div>
      )}
    </div>
  );
}
