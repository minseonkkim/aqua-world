/**
 * 초대 링크 착지 화면 — `#/invite/:code` (V1.1).
 *
 * 초대 링크를 누른 사람은 이미 로그인까지 마친 뒤 여기에 도착한다(App.tsx 의 인증 게이트가
 * 로그인 전에는 MainLayout 자체를 렌더하지 않으므로). 그래서 이 화면은 "코드 확인 → 수령"
 * 한 단계만 담당한다.
 *
 * 보상은 서버가 invitedBy 를 딱 한 번만 세팅하는 것으로 중복을 막는다(redeemInvite 참조).
 * 클라는 실패 사유를 그대로 보여주기만 하면 된다.
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { useFriendStore } from '@/store/useFriendStore';
import { isCloudUser } from '@/services/firebase/functions';
import { formatFriendCode, redeemInvite } from '@/services/firebase/friends';
import { analytics } from '@/services/analytics';

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message);
    if (msg) return msg;
  }
  return fallback;
}

export default function InvitePage() {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const user = useUserStore(s => s.user);
  const refreshFriends = useFriendStore(s => s.refresh);

  const [status, setStatus] = useState<'idle' | 'busy' | 'done'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const alreadyInvited = !!user?.invitedBy;

  const handleRedeem = async () => {
    setStatus('busy');
    setMessage(null);
    try {
      await redeemInvite(code);
      analytics.friendInviteRedeem();
      await refreshFriends();
      setStatus('done');
    } catch (err) {
      setStatus('idle');
      setMessage(errorMessage(err, '초대 코드를 사용할 수 없어요.'));
    }
  };

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center',
      }}>
        <span style={{ fontSize: 64 }}>{status === 'done' ? '🥚' : '💌'}</span>

        {status === 'done' ? (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>희귀 알을 받았어요!</h2>
            <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, fontSize: 14 }}>
              초대한 친구도 함께 희귀 알을 받았어요.<br />수조에서 부화시켜보세요.
            </p>
            <button className="btn btn-primary" style={{ width: '100%', maxWidth: 260 }} onClick={() => navigate('/tank')}>
              수조로 가기
            </button>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>친구가 초대했어요</h2>
            <div style={{
              fontSize: 26, fontWeight: 700, letterSpacing: 3,
              color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums',
            }}>
              {formatFriendCode(code.toUpperCase())}
            </div>
            <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, fontSize: 14 }}>
              초대를 수락하면 나와 친구 모두<br />희귀 알을 하나씩 받아요.
            </p>

            {message && (
              <p style={{ color: 'var(--color-error)', fontSize: 13, lineHeight: 1.5 }}>{message}</p>
            )}

            {!isCloudUser() ? (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                게스트 모드에서는 초대 보상을 받을 수 없어요.<br />
                구글 · 카카오 계정으로 로그인한 뒤 다시 열어주세요.
              </p>
            ) : alreadyInvited ? (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                이미 초대 보상을 받은 계정이에요.
              </p>
            ) : (
              <button
                className="btn btn-accent"
                style={{ width: '100%', maxWidth: 260, opacity: status === 'busy' ? 0.6 : 1 }}
                disabled={status === 'busy'}
                onClick={handleRedeem}
              >
                {status === 'busy' ? '받는 중…' : '초대 수락하고 알 받기'}
              </button>
            )}

            <button className="btn btn-ghost" style={{ width: '100%', maxWidth: 260 }} onClick={() => navigate('/tank')}>
              나중에 하기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
