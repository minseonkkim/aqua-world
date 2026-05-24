import React from 'react';
import { useUserStore, DailyRewardResult } from '@/store/useUserStore';

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
  const { clearPendingReward } = useUserStore();

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

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={clearPendingReward}>
          받기!
        </button>
      </div>
    </div>
  );
}
