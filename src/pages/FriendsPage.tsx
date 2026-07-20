import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriendStore } from '@/store/useFriendStore';
import { isCloudUser } from '@/services/firebase/functions';
import {
  findUserByFriendCode,
  formatFriendCode,
  inviteUrl,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from '@/services/firebase/friends';
import { shareText } from '@/utils/shareLink';
import { analytics } from '@/services/analytics';
import { relativeTime } from '@/utils/relativeTime';
import type { FriendProfile } from '@/types';

/** 서버 HttpsError 의 사용자용 메시지를 꺼낸다. 없으면 폴백 문구. */
function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message);
    if (msg) return msg;
  }
  return fallback;
}

function Avatar({ profile, size = 40 }: { profile: FriendProfile; size?: number }) {
  const [failed, setFailed] = useState(false);
  const common: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: 'var(--color-bg-light)',
  };
  if (profile.photoURL && !failed) {
    return (
      <img
        src={profile.photoURL}
        alt=""
        onError={() => setFailed(true)}
        style={{ ...common, objectFit: 'cover' }}
      />
    );
  }
  return (
    <div style={{ ...common, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5 }}>
      🐠
    </div>
  );
}

export default function FriendsPage() {
  const navigate = useNavigate();
  const { friends, incoming, outgoing, visits, myCode, loading, error, refresh } = useFriendStore();
  const [toast, setToast] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const cloud = isCloudUser();

  useEffect(() => {
    if (cloud) refresh();
  }, [cloud, refresh]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // 게스트는 서버 함수를 쓸 수 없다(functions.ts isCloudUser 참조).
  // 빈 화면 대신 왜 못 쓰는지와 다음 행동을 알려준다.
  if (!cloud) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="page-header">친구</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <span style={{ fontSize: 64 }}>👥</span>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>로그인이 필요해요</h2>
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
            친구 수조 방문과 먹이 주기는<br />구글 · 카카오 계정으로 로그인하면 이용할 수 있어요.
          </p>
          <button className="btn btn-primary" style={{ width: '100%', maxWidth: 260 }} onClick={() => navigate('/settings')}>
            설정에서 로그인하기
          </button>
        </div>
      </div>
    );
  }

  const handleSearch = async () => {
    const code = codeInput.trim();
    if (code.replace(/[^A-Za-z0-9]/g, '').length !== 6) {
      showToast('친구 코드 6자리를 입력해주세요');
      return;
    }
    setSearching(true);
    try {
      const { profile, relation } = await findUserByFriendCode({ code });
      if (relation === 'friend') {
        showToast(`${profile.displayName} 님과는 이미 친구예요`);
        return;
      }
      if (relation === 'requested') {
        showToast('이미 요청을 보냈어요');
        return;
      }
      const res = await sendFriendRequest({ code });
      analytics.friendRequestSend();
      setCodeInput('');
      await refresh();
      showToast(
        res.status === 'friend'
          ? `🎉 ${profile.displayName} 님과 친구가 되었어요!`
          : `${profile.displayName} 님에게 친구 요청을 보냈어요`,
      );
    } catch (err) {
      showToast(errorMessage(err, '친구를 찾지 못했어요'));
    } finally {
      setSearching(false);
    }
  };

  const handleRespond = async (uid: string, name: string, accept: boolean) => {
    setBusyUid(uid);
    try {
      await respondFriendRequest({ fromUid: uid, accept });
      analytics.friendRequestRespond(accept);
      await refresh();
      showToast(accept ? `🎉 ${name} 님과 친구가 되었어요!` : '요청을 거절했어요');
    } catch (err) {
      showToast(errorMessage(err, '처리하지 못했어요'));
    } finally {
      setBusyUid(null);
    }
  };

  const handleRemove = async (uid: string, name: string) => {
    if (!window.confirm(`${name} 님을 친구 목록에서 삭제할까요?`)) return;
    setBusyUid(uid);
    try {
      await removeFriend({ friendUid: uid });
      analytics.friendRemove();
      await refresh();
      showToast('친구를 삭제했어요');
    } catch (err) {
      showToast(errorMessage(err, '삭제하지 못했어요'));
    } finally {
      setBusyUid(null);
    }
  };

  const handleShareInvite = async () => {
    if (!myCode) return;
    const outcome = await shareText({
      title: 'AquaWorld 초대',
      text: `내 수조에 놀러오세요! 초대 코드 ${formatFriendCode(myCode)} 를 입력하면 둘 다 희귀 알을 받아요 🥚`,
      url: inviteUrl(myCode),
    });
    analytics.friendInviteShare(outcome);
    showToast(
      outcome === 'shared' ? '초대 링크를 공유했어요'
        : outcome === 'copied' ? '초대 링크를 복사했어요'
          : `공유에 실패했어요 · 코드 ${formatFriendCode(myCode)} 를 알려주세요`,
    );
  };

  return (
    <div className="page">
      <div className="page-header">친구</div>

      {/* 내 친구 코드 + 초대 */}
      <div style={{ padding: '0 16px 16px' }}>
        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>
            내 친구 코드
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 3, fontVariantNumeric: 'tabular-nums', color: 'var(--color-accent)' }}>
              {myCode ? formatFriendCode(myCode) : '· · · · · ·'}
            </span>
            <button
              className="btn btn-ghost"
              style={{ marginLeft: 'auto', padding: '8px 14px', fontSize: 13 }}
              disabled={!myCode}
              onClick={handleShareInvite}
            >
              초대하기
            </button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            친구가 이 코드로 가입하면 둘 다 희귀 알을 받아요.
          </span>
        </div>
      </div>

      {/* 친구 코드로 추가 */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase().slice(0, 8))}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="친구 코드 6자리"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            style={{
              flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-surface-light)',
              borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 15,
              letterSpacing: 2, outline: 'none',
            }}
          />
          <button
            className="btn btn-primary"
            style={{ padding: '12px 18px', fontSize: 14, opacity: searching ? 0.6 : 1 }}
            disabled={searching}
            onClick={handleSearch}
          >
            {searching ? '찾는 중' : '추가'}
          </button>
        </div>
      </div>

      {/* 받은 친구 요청 */}
      {incoming.length > 0 && (
        <Section title={`받은 요청 ${incoming.length}`}>
          {incoming.map(p => (
            <div key={p.uid} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar profile={p} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.displayName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>도감 {p.collectedCount}종</div>
              </div>
              <button
                className="btn btn-accent"
                style={{ padding: '8px 12px', fontSize: 13 }}
                disabled={busyUid === p.uid}
                onClick={() => handleRespond(p.uid, p.displayName, true)}
              >
                수락
              </button>
              <button
                className="btn btn-ghost"
                style={{ padding: '8px 12px', fontSize: 13 }}
                disabled={busyUid === p.uid}
                onClick={() => handleRespond(p.uid, p.displayName, false)}
              >
                거절
              </button>
            </div>
          ))}
        </Section>
      )}

      {/* 내 수조에 남겨진 방문 흔적 */}
      {visits.length > 0 && (
        <Section title="내 수조에 다녀갔어요">
          <div className="card" style={{ padding: '4px 0' }}>
            {visits.map(v => (
              <div key={v.uid} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{v.type === 'heart' ? '💗' : '🍤'}</span>
                <span style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong style={{ fontWeight: 600 }}>{v.displayName}</strong>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {v.type === 'heart' ? ' 님이 하트를 남겼어요' : ' 님이 먹이를 주고 갔어요'}
                  </span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-disabled)', flexShrink: 0 }}>
                  {relativeTime(v.at)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 친구 목록 */}
      <Section title={`친구 ${friends.length}`}>
        {friends.length === 0 && !loading && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🫧</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>아직 친구가 없어요</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              위의 초대하기로 친구를 부르거나<br />친구 코드를 입력해 추가해보세요.
            </div>
          </div>
        )}

        {friends.map(f => (
          <div
            key={f.uid}
            className="card"
            style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            onClick={() => navigate(`/friends/${f.uid}`)}
          >
            <Avatar profile={f} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.displayName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {relativeTime(f.lastActiveAt)} 접속 · 도감 {f.collectedCount}종
              </div>
            </div>
            <button
              aria-label={`${f.displayName} 친구 삭제`}
              style={{ padding: 8, fontSize: 16, color: 'var(--color-text-disabled)' }}
              disabled={busyUid === f.uid}
              onClick={e => { e.stopPropagation(); handleRemove(f.uid, f.displayName); }}
            >
              ⋯
            </button>
          </div>
        ))}

        {/* 보낸 요청은 목록 아래에 옅게 — 상대가 수락하기 전까지의 대기 상태 */}
        {outgoing.map(p => (
          <div key={p.uid} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.55 }}>
            <Avatar profile={p} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.displayName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>요청 보냄 · 수락 대기 중</div>
            </div>
          </div>
        ))}
      </Section>

      {loading && friends.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
          불러오는 중…
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: '0 16px 16px' }}>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 10 }}>{error}</div>
            <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }} onClick={refresh}>
              다시 시도
            </button>
          </div>
        </div>
      )}

      <div style={{ height: 24 }} />

      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}
