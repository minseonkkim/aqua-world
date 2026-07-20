/**
 * 친구 수조 방문 — 읽기 전용 (V1.1).
 *
 * TankScene 을 상호작용 핸들러 없이 렌더한다(onFishClick/onSurfaceFeed 미전달 →
 * 물고기 클릭·수면 먹이 주기 비활성). 남의 수조를 내 useTankStore 에 넣지 않는 것이
 * 이 화면의 핵심 제약이다 — 스토어를 거치면 자동 저장 경로가 친구 수조를 내 것으로
 * 덮어쓸 수 있다. 그래서 서버 응답을 이 컴포넌트의 로컬 상태로만 들고 있는다.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TankScene from '@/components/3d/TankScene';
import { getFriendTank, sendFriendTrace } from '@/services/firebase/friends';
import { isCloudUser } from '@/services/firebase/functions';
import { analytics } from '@/services/analytics';
import { relativeTime } from '@/utils/relativeTime';
import { getTankCapacity, getTankScale } from '@/constants';
import type { FriendProfile, FriendTraceType, Tank } from '@/types';

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message);
    if (msg) return msg;
  }
  return fallback;
}

export default function FriendTankPage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();

  const [tank, setTank] = useState<Tank | null>(null);
  const [owner, setOwner] = useState<FriendProfile | null>(null);
  const [traced, setTraced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  useEffect(() => {
    if (!uid || !isCloudUser()) {
      setError('친구 수조를 볼 수 없어요.');
      setLoading(false);
      return;
    }
    // 응답이 늦게 도착한 뒤 화면이 이미 사라졌다면 setState 하지 않는다.
    let alive = true;
    void (async () => {
      try {
        const res = await getFriendTank(uid);
        if (!alive) return;
        setTank(res.tank);
        setOwner(res.owner);
        setTraced(res.tracedToday);
        analytics.friendTankVisit();
        if (res.pearlReward > 0) showToast(`🪙 방문 보상 +${res.pearlReward}`);
      } catch (err) {
        if (!alive) return;
        setError(errorMessage(err, '친구 수조를 불러오지 못했어요.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [uid]);

  const handleTrace = async (type: FriendTraceType) => {
    if (!uid || busy) return;
    setBusy(true);
    try {
      const res = await sendFriendTrace({ friendUid: uid, type });
      analytics.friendTrace(type);
      setTraced(true);
      if (type === 'heart') {
        showToast('💗 하트를 남겼어요');
      } else {
        showToast(res.fed ? `🍤 ${res.fed.fishName}에게 먹이를 줬어요` : '🍤 먹이를 줬어요');
        // 먹이는 친구 수조를 실제로 바꾼다 — 화면을 최신 상태로 다시 받는다.
        try {
          const fresh = await getFriendTank(uid);
          setTank(fresh.tank);
        } catch {
          // 갱신 실패는 치명적이지 않다 — 먹이는 이미 반영됐다.
        }
      }
    } catch (err) {
      showToast(errorMessage(err, '흔적을 남기지 못했어요'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>수조를 여는 중…</span>
      </div>
    );
  }

  if (error || !tank || !owner) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
        <TopBar title="친구 수조" onBack={() => navigate('/friends')} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
          <span style={{ fontSize: 48 }}>🌊</span>
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.6, fontSize: 14 }}>
            {error ?? '친구 수조를 불러오지 못했어요.'}
          </p>
          <button className="btn btn-ghost" style={{ padding: '10px 20px', fontSize: 14 }} onClick={() => navigate('/friends')}>
            친구 목록으로
          </button>
        </div>
      </div>
    );
  }

  // 수용량·시각 배율은 TankPage 와 같은 헬퍼를 쓴다 — 규칙이 갈라지면 같은 수조가
  // 내 화면과 친구 화면에서 다른 크기로 보인다.
  const capacity = getTankCapacity(tank.capacityLevel);
  const tankScale = getTankScale(tank.capacityLevel);

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar title={`${owner.displayName} 님의 수조`} onBack={() => navigate('/friends')} />

      <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="currency-pill">🐠 {tank.fish.length}/{capacity}</span>
        <span className="currency-pill">✨ {Math.round(tank.cleanliness)}%</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-disabled)', marginLeft: 'auto' }}>
          {relativeTime(owner.lastActiveAt)} 접속
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <TankScene
          environment={tank.environment}
          fish={tank.fish}
          decorations={tank.decorations}
          lightMode={tank.lightMode}
          tankScale={tankScale}
          style={{ width: '100%', height: '100%' }}
        />
        {tank.fish.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', pointerEvents: 'none',
            color: 'rgba(255,255,255,0.7)', fontSize: 13,
          }}>
            아직 물고기가 없는 수조예요
          </div>
        )}
      </div>

      {/* 방문 흔적 — 하루 한 번만 남길 수 있다(서버 권위, 여기서는 안내만) */}
      <div style={{
        padding: '12px 16px calc(12px + var(--safe-bottom))',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <button
          className="btn btn-ghost"
          style={{ flex: 1, padding: 12, fontSize: 14, opacity: busy ? 0.6 : 1 }}
          disabled={busy}
          onClick={() => handleTrace('heart')}
        >
          💗 하트 남기기
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 1, padding: 12, fontSize: 14, opacity: busy ? 0.6 : 1 }}
          disabled={busy}
          onClick={() => handleTrace('feed')}
        >
          🍤 먹이 주기
        </button>
      </div>
      {traced && (
        <div style={{
          padding: '0 16px calc(10px + var(--safe-bottom))', marginTop: -8,
          fontSize: 11, color: 'var(--color-text-disabled)', textAlign: 'center',
        }}>
          오늘 이 수조에 흔적을 남겼어요
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '10px 20px',
          borderRadius: 20, fontSize: 14, fontWeight: 600, maxWidth: 'calc(100% - 40px)',
          textAlign: 'center', zIndex: 200, pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{
      padding: 'calc(var(--safe-top) + 16px) 16px 12px',
      display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    }}>
      <button onClick={onBack} aria-label="뒤로" style={{ fontSize: 20, padding: 4, lineHeight: 1 }}>‹</button>
      <span style={{
        fontSize: 18, fontWeight: 700, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {title}
      </span>
    </div>
  );
}
