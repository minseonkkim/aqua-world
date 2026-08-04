import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FISH_SPECIES_PAGES } from '@/store/useFishStore';
import { useUserStore } from '@/store/useUserStore';
import { COMPENDIUM_MILESTONES, COMPENDIUM_REWARDS_BY_PAGE, CompendiumReward, isGen2Unlocked } from '@/constants';
import { isCloudUser, claimMilestone } from '@/services/firebase/functions';
import { analytics } from '@/services/analytics';
import { useAsyncAction } from '@/hooks/useAsyncAction';

// 도감 페이지 테마 이름: [0]=1세대(출시 10종), [1]=2세대(v1.1.0 10종)
const PAGE_TITLES = ['시작의 바다', '미지의 바다'];

const RARITY_COLOR: Record<string, string> = {
  common: 'var(--color-rarity-common)', rare: 'var(--color-rarity-rare)',
  epic: 'var(--color-rarity-epic)', legendary: 'var(--color-rarity-legendary)',
};
const RARITY_LABEL: Record<string, string> = { common: '커먼', rare: '레어', epic: '에픽', legendary: '레전더리' };

function rewardLabel(r: CompendiumReward): string {
  if (r.type === 'pearl') return `🪙 ${r.amount}`;
  if (r.type === 'star_coral') return `🌸 ${r.amount}`;
  return r.tier === 'basic' ? '🥚 기본 알' : r.tier === 'rare' ? '💎 희귀 알' : '✨ 전설 알';
}

export default function CompendiumPage() {
  const { user, claimCompendiumMilestone } = useUserStore();
  const [toast, setToast] = useState('');
  // ?page=2 딥링크로 특정 페이지에서 시작 (1-based)
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(p) ? Math.max(0, Math.min(FISH_SPECIES_PAGES.length - 1, p - 1)) : 0;
  });
  const collected = user?.collectedSpecies ?? [];

  // 페이지 구성: 2페이지(미지의 바다)는 1페이지를 전부 모아야 해금.
  // 넘겨서 구경할 수는 있지만 내용은 잠금 상태로 보인다.
  const pageSpecies = FISH_SPECIES_PAGES[page];
  const gen2Unlocked = isGen2Unlocked(collected);
  const pageLocked = page === 1 && !gen2Unlocked;
  const pageCollectedCount = pageSpecies.filter(s => collected.includes(s.id)).length;
  const gen1Total = FISH_SPECIES_PAGES[0].length;
  const gen1Collected = FISH_SPECIES_PAGES[0].filter(s => collected.includes(s.id)).length;

  // 진행도·마일스톤은 페이지(바다)별 독립 트랙 — 기존 필드는 1페이지 트랙이라
  // 이미 도감을 완성한 유저도 2페이지에서 새 마일스톤을 받을 수 있다.
  const pagePct = Math.round((pageCollectedCount / pageSpecies.length) * 100);
  const pageRewards = COMPENDIUM_REWARDS_BY_PAGE[page];
  const claimed = (page === 1
    ? user?.claimedCompendiumMilestones2
    : user?.claimedCompendiumMilestones) ?? [];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // 연타하면 두 번째 청구가 "이미 수령" 으로 거절돼 '아직 청구할 수 없습니다' 가 뜬다 — 응답까지 잠근다.
  const [handleClaim, claiming] = useAsyncAction(async (milestone: number) => {
    if (isCloudUser()) {
      try {
        const res = await claimMilestone({ pct: milestone, page: page + 1 });
        analytics.compendiumMilestoneClaim(milestone);
        showToast(`🎉 ${milestone}% 보상 획득 · ${rewardLabel(res.reward as CompendiumReward)}`);
      } catch {
        showToast('아직 청구할 수 없습니다');
      }
      return;
    }
    const reward = claimCompendiumMilestone(page, milestone, pageCollectedCount, pageSpecies.length);
    if (!reward) {
      showToast('아직 청구할 수 없습니다');
      return;
    }
    analytics.compendiumMilestoneClaim(milestone);
    showToast(`🎉 ${milestone}% 보상 획득 · ${rewardLabel(reward)}`);
  });

  return (
    <div className="page">
      <div className="page-header">도감</div>

      {/* 페이지 이동 — 화살표로 넘길 수 있고, 2페이지는 1페이지 완성 전까지 잠금 표시 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 16px 10px' }}>
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          aria-label="이전 페이지"
          style={{
            width: 34, height: 34, borderRadius: 17, border: '1px solid rgba(255,255,255,0.15)',
            background: 'var(--color-surface)', color: page === 0 ? 'var(--color-text-disabled)' : '#fff',
            fontSize: 14, cursor: page === 0 ? 'default' : 'pointer',
          }}
        >
          ◀
        </button>
        <div style={{ minWidth: 150, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {pageLocked ? '🔒 ' : ''}{PAGE_TITLES[page]}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-disabled)', marginTop: 2 }}>
            {page + 1} / {FISH_SPECIES_PAGES.length}
          </div>
        </div>
        <button
          onClick={() => setPage(p => Math.min(FISH_SPECIES_PAGES.length - 1, p + 1))}
          disabled={page === FISH_SPECIES_PAGES.length - 1}
          aria-label="다음 페이지"
          style={{
            width: 34, height: 34, borderRadius: 17, border: '1px solid rgba(255,255,255,0.15)',
            background: 'var(--color-surface)',
            color: page === FISH_SPECIES_PAGES.length - 1 ? 'var(--color-text-disabled)' : '#fff',
            fontSize: 14, cursor: page === FISH_SPECIES_PAGES.length - 1 ? 'default' : 'pointer',
          }}
        >
          ▶
        </button>
      </div>

      {/* 현재 페이지 진행도 */}
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{pageCollectedCount}/{pageSpecies.length}</span>
        <div style={{ flex: 1, height: 6, background: 'var(--color-surface)', borderRadius: 3 }}>
          <div style={{ width: `${pagePct}%`, height: '100%', background: 'var(--color-accent)', borderRadius: 3 }} />
        </div>
        <span style={{ color: 'var(--color-accent)', fontSize: 13, fontWeight: 600 }}>{pagePct}%</span>
      </div>

      {/* 마일스톤 보상 트랙 — 페이지별 독립 */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
          마일스톤 보상
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {COMPENDIUM_MILESTONES.map(m => {
            const reward = pageRewards[m];
            const isClaimed = claimed.includes(m);
            const isReachable = pagePct >= m;
            const canClaim = isReachable && !isClaimed;
            return (
              <button
                key={m}
                onClick={canClaim ? () => handleClaim(m) : undefined}
                disabled={!canClaim || claiming}
                style={{
                  flex: '0 0 auto', minWidth: 72, padding: '8px 6px',
                  background: isClaimed
                    ? 'rgba(76, 175, 80, 0.15)'
                    : canClaim
                      ? 'rgba(255, 215, 0, 0.18)'
                      : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isClaimed
                    ? 'rgba(76, 175, 80, 0.5)'
                    : canClaim
                      ? 'rgba(255, 215, 0, 0.6)'
                      : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 10, color: '#fff',
                  cursor: canClaim ? 'pointer' : 'default',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  opacity: isReachable || isClaimed ? 1 : 0.55,
                }}
              >
                <span style={{ fontSize: 11, color: canClaim ? '#ffd54f' : 'var(--color-text-secondary)', fontWeight: 700 }}>
                  {m}%
                </span>
                <span style={{ fontSize: 14 }}>{rewardLabel(reward)}</span>
                <span style={{
                  fontSize: 9,
                  color: isClaimed ? '#81c784' : canClaim ? '#ffd54f' : 'var(--color-text-disabled)',
                  fontWeight: 600,
                }}>
                  {isClaimed ? '✓ 수령' : canClaim ? '청구!' : '잠금'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 잠긴 페이지 안내 배너 */}
      {pageLocked && (
        <div style={{
          margin: '0 16px 12px', padding: '10px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>🔒</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>아직 잠겨 있어요</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              시작의 바다 도감을 모두 채우면 미지의 바다가 열려요 ({gen1Collected}/{gen1Total})
            </div>
          </div>
        </div>
      )}

      {/* 가로에서는 폭이 두 배 넘게 넓어진다 — 2열 고정이면 카드가 그만큼 늘어나 버려서 폭에 맞춰 열을 늘린다.
          minmax 160px 은 세로(최대 480px)에서 지금처럼 2열로 떨어지는 하한. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, padding: '0 16px 16px' }}>
        {pageSpecies.map(s => {
          const unlocked = !pageLocked && collected.includes(s.id);
          return (
            <div key={s.id} className="card" style={{ cursor: 'pointer', opacity: pageLocked ? 0.6 : 1 }}>
              <div style={{ height: 100, background: unlocked ? 'var(--color-bg-light)' : 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, overflow: 'hidden' }}>
                {unlocked ? (
                  <img
                    src={`${import.meta.env.BASE_URL}${s.thumbnailPath}`}
                    alt={s.name}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent && !parent.querySelector('.thumb-fallback')) {
                        const span = document.createElement('span');
                        span.className = 'thumb-fallback';
                        span.textContent = '🐟';
                        span.style.fontSize = '48px';
                        parent.appendChild(span);
                      }
                    }}
                  />
                ) : pageLocked ? '🔒' : '❓'}
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

      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '10px 20px',
          borderRadius: 20, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
          zIndex: 200, pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
