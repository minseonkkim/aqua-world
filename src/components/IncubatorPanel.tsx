import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { Egg, EggTier } from '@/types';
import {
  isCloudUser,
  optimistic,
  startHatching as startHatchingServer,
  prepareAdReward,
  claimAdReward,
} from '@/services/firebase/functions';
import { analytics } from '@/services/analytics';
import { isAdsAvailable, preloadRewardedAd, showRewardedAd } from '@/services/ads';
import { serverNow } from '@/services/clock';

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
  onBoostAd: () => void;
  boostInFlight: boolean;
}

function EggCard({ egg, onStart, onCollect, onBoostAd, boostInFlight }: EggCardProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!egg.isHatching) return;
    const tick = () => {
      const elapsed = (serverNow() - egg.startedAt) / 1000;
      setRemaining(Math.max(0, egg.hatchDuration - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [egg.isHatching, egg.startedAt, egg.hatchDuration]);

  const isReady = egg.isHatching && remaining <= 0;
  const pct = egg.isHatching
    ? Math.min(100, ((serverNow() - egg.startedAt) / 1000 / egg.hatchDuration) * 100)
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
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
            }}>
              <div style={{ fontSize: 12, color: isReady ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                {isReady ? '🎉 부화 완료!' : `⏳ ${formatTime(remaining)}`}
              </div>
              {!isReady && isAdsAvailable() && (
                <button
                  onClick={onBoostAd}
                  disabled={boostInFlight}
                  style={{
                    background: 'rgba(255,193,7,0.15)',
                    border: '1px solid rgba(255,193,7,0.4)',
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontSize: 11, fontWeight: 600,
                    color: '#ffd54a',
                    cursor: boostInFlight ? 'wait' : 'pointer',
                    opacity: boostInFlight ? 0.5 : 1,
                    whiteSpace: 'nowrap',
                  }}
                  title="광고를 보고 부화 시간을 5분 단축합니다"
                >
                  {boostInFlight ? '⏳' : '🎬 -5분'}
                </button>
              )}
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
  /** 패널 열림 상태 (부모가 제어 — 좌측 패널 상호 배타) */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function IncubatorPanel({ onCollect, open, onOpenChange }: Props) {
  const { user, startHatching, setUser } = useUserStore();
  const [boostingEggId, setBoostingEggId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // 패널이 열리고 부화 중인 알이 있으면 백그라운드로 광고 미리 받기 — 체감 지연 제거
  const hasHatchingEgg = (user?.inventory ?? []).some(e => e.isHatching);
  useEffect(() => {
    if (!open || !hasHatchingEgg || !isAdsAvailable()) return;
    void preloadRewardedAd();
  }, [open, hasHatchingEgg]);

  const handleStart = (eggId: string) => {
    const egg = user?.inventory.find(e => e.id === eggId);
    if (egg) analytics.startHatching(egg.tier);
    if (isCloudUser()) {
      optimistic(
        () => startHatching(eggId),
        () => startHatchingServer({ eggId }),
      );
      return;
    }
    startHatching(eggId);
  };

  const handleBoostAd = async (eggId: string) => {
    if (!user || boostingEggId) return;
    // 오프라인이면 광고/서버 호출이 ~10초 타임아웃 끝에 실패한다. 미리 즉시 안내.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      showToast('광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요');
      return;
    }
    setBoostingEggId(eggId);
    try {
      if (isCloudUser()) {
        // 서버: nonce 발급 → 광고 시청 → SSV 우선, 폴백으로 claimAdReward
        // 오프라인 등으로 nonce 발급(서버 호출)이 실패하면 광고를 띄울 수 없으므로
        // 광고 로드 실패와 동일하게 재시도 안내한다.
        let nonceId: string;
        try {
          ({ nonceId } = await prepareAdReward('hatch_boost', { eggId }));
        } catch {
          showToast('광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요');
          return;
        }
        const result = await showRewardedAd(nonceId, user.id);
        if (result === 'load_failed') {
          showToast('광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요');
          return;
        }
        if (result !== 'rewarded') return; // 중도 닫기 — 보상 없음, 안내도 없음
        // SSV 가 먼저 nonce 를 소비했어도 Callable 은 멱등(이미 used → 실패) 이므로
        // 시도 후 무시. 성공 응답이 오면 user 상태가 setUser 로 자동 반영됨.
        try {
          await claimAdReward({ nonceId });
        } catch {
          // SSV 가 이미 처리 — user 상태는 다음 동기화 사이클에 반영
        }
      } else {
        // 게스트: 서버 검증 없이 로컬에서만 적용
        if (!isAdsAvailable()) return;
        const result = await showRewardedAd('guest', user.id);
        if (result === 'load_failed') {
          showToast('광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요');
          return;
        }
        if (result !== 'rewarded') return;
        setUser({
          ...user,
          inventory: user.inventory.map(e =>
            e.id === eggId ? { ...e, hatchDuration: Math.max(1, e.hatchDuration - 300) } : e,
          ),
        });
      }
    } finally {
      setBoostingEggId(null);
    }
  };

  const inventory = user?.inventory ?? [];

  if (inventory.length === 0) return null;

  return (
    <>
      <button
        onClick={() => onOpenChange(!open)}
        style={{
          position: 'absolute', left: 12, bottom: 80,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 12, padding: '8px 14px',
          color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          zIndex: open ? 71 : 'auto',
        }}
      >
        🥚 {inventory.length}
      </button>

      {open && (
        <div style={{
          position: 'absolute', left: 12, bottom: 130,
          width: 280,
          background: 'rgba(10,22,40,0.95)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 14,
          padding: 14,
          backdropFilter: 'blur(12px)',
          maxHeight: 320,
          overflowY: 'auto',
          zIndex: 70,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
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
                  if (inventory.length <= 1) onOpenChange(false);
                }}
                onBoostAd={() => handleBoostAd(egg.id)}
                boostInFlight={boostingEggId === egg.id}
              />
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', color: '#fff',
          padding: '10px 20px', borderRadius: 20, fontSize: 14, fontWeight: 600,
          whiteSpace: 'nowrap', zIndex: 200, pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
