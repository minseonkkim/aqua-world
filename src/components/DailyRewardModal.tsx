import React, { useEffect, useState } from 'react';
import { useUserStore, DailyRewardResult } from '@/store/useUserStore';
import { playSFX } from '@/services/audio';
import { isAdsAvailable, preloadRewardedAd, showRewardedAd } from '@/services/ads';
import {
  isCloudUser,
  prepareAdReward,
  claimAdReward,
} from '@/services/firebase/functions';

const REWARD_ICONS: Record<DailyRewardResult['type'], string> = {
  pearl: '🪙',
  star_coral: '🌸',
  egg: '🥚',
};

const TIER_LABELS: Record<string, string> = {
  basic: '기본 알',
  rare: '희귀 알',
  legendary: '전설 알',
};

interface Props {
  reward: DailyRewardResult;
}

export default function DailyRewardModal({ reward }: Props) {
  const { user, clearPendingReward, addPearl, addStarCoral, addEggToInventory } = useUserStore();
  const [doubling, setDoubling] = useState(false);
  const [doubled, setDoubled] = useState(false);

  useEffect(() => {
    playSFX('reward');
    // 광고 보고 2배 받기 버튼을 누를 가능성에 대비해 백그라운드 사전 로드
    if (isAdsAvailable()) void preloadRewardedAd();
  }, []);

  const handleDouble = async () => {
    if (!user || doubling || doubled) return;
    setDoubling(true);
    try {
      // payload 는 서버에서 그대로 한 번 더 적용된다 — 본 보상 정의를 넘긴다.
      const rewardPayload = {
        type: reward.type,
        amount: reward.amount,
        tier: reward.tier,
      };
      if (isCloudUser()) {
        const { nonceId } = await prepareAdReward('daily_double', { reward: rewardPayload });
        const rewarded = await showRewardedAd(nonceId, user.id);
        if (!rewarded) return;
        try {
          await claimAdReward({ nonceId });
        } catch {
          // SSV 가 이미 처리한 경우 — user 상태는 setUser 로 자동 반영됨
        }
      } else {
        // 게스트: 로컬에서 즉시 한 번 더 지급
        if (!isAdsAvailable()) return;
        const rewarded = await showRewardedAd('guest', user.id);
        if (!rewarded) return;
        if (reward.type === 'pearl') addPearl(reward.amount ?? 0);
        else if (reward.type === 'star_coral') addStarCoral(reward.amount ?? 0);
        else if (reward.type === 'egg' && reward.tier) addEggToInventory(reward.tier);
      }
      setDoubled(true);
      playSFX('reward');
    } finally {
      setDoubling(false);
    }
  };

  const icon = REWARD_ICONS[reward.type];
  let rewardText = '';
  if (reward.type === 'egg') rewardText = TIER_LABELS[reward.tier ?? 'basic'] ?? '알';
  else rewardText = `${reward.amount ?? 0} ${reward.type === 'pearl' ? 'Pearl' : 'Star Coral'}`;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 24,
        padding: '32px 28px',
        width: 280,
        textAlign: 'center',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          {reward.day}일 연속 접속 보상
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>🎁 출석 체크!</h2>

        {/* 7일 진행 도트 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} style={{
              width: 28, height: 28, borderRadius: '50%',
              background: i < reward.day ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: i < reward.day ? '#0a1628' : 'var(--color-text-disabled)',
            }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* 보상 */}
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 16,
          padding: '20px 16px',
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>{icon}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{rewardText}</div>
        </div>

        {isAdsAvailable() && !doubled && (
          <button
            onClick={handleDouble}
            disabled={doubling}
            style={{
              width: '100%',
              background: 'rgba(255,193,7,0.15)',
              border: '1px solid rgba(255,193,7,0.5)',
              color: '#ffd54a',
              borderRadius: 12,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 700,
              cursor: doubling ? 'wait' : 'pointer',
              marginBottom: 8,
            }}
          >
            {doubling ? '⏳ 광고 준비 중…' : '🎬 광고 보고 2배 받기'}
          </button>
        )}
        {doubled && (
          <div
            style={{
              width: '100%',
              background: 'rgba(76,175,80,0.18)',
              border: '1px solid rgba(76,175,80,0.5)',
              color: '#9be7a3',
              borderRadius: 12,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            ✨ 2배 보상 지급 완료!
          </div>
        )}
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={clearPendingReward}>
          받기!
        </button>
      </div>
    </div>
  );
}
