import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { useModalStore } from '@/store/useModalStore';
import { useAudioStore } from '@/store/useAudioStore';
import { playSFX } from '@/services/audio';
import { signOut } from '@/services/firebase/auth';
import { deleteAccount } from '@/services/firebase/functions';
import { isPushSupported, enablePush, disablePush, pushPermission } from '@/services/firebase/messaging';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  const { setTanks } = useTankStore();
  const { sfxEnabled, bgmEnabled, setSfx, setBgm } = useAudioStore();
  const [pushSupported, setPushSupported] = useState(false);
  const [pushOn, setPushOn] = useState(pushPermission() === 'granted');
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    isPushSupported().then(setPushSupported);
  }, []);

  const handlePushToggle = async (next: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (next) {
        const token = await enablePush();
        if (token) {
          setPushOn(true);
        } else {
          await useModalStore.getState().alert({
            emoji: '🔕',
            title: '푸시 알림을 켤 수 없어요',
            message: '브라우저 알림 권한이 거부되었거나 지원되지 않는 환경입니다. iOS는 16.4+ & 홈 화면 설치 시에만 지원됩니다.',
          });
          setPushOn(false);
        }
      } else {
        await disablePush();
        setPushOn(false);
      }
    } finally {
      setPushBusy(false);
    }
  };

  const handleLogout = async () => {
    const ok = await useModalStore.getState().confirm({
      emoji: '👋',
      title: '로그아웃',
      message: '로그아웃 하시겠습니까?',
      confirmText: '로그아웃',
      tone: 'danger',
    });
    if (!ok) return;
    await signOut();
    setUser(null);
    setTanks([]);
  };

  // 게스트 계정(`guest_` prefix)은 서버에 데이터가 없어 탈퇴 대상이 아님
  const isCloudUser = !!user && !user.id.startsWith('guest_');

  const handleDeleteAccount = async () => {
    const first = await useModalStore.getState().confirm({
      emoji: '⚠️',
      title: '회원 탈퇴',
      message: '회원 탈퇴 시 어항·물고기·재화·도감 등 모든 데이터가 영구 삭제되며, 복구할 수 없습니다. 계속하시겠습니까?',
      confirmText: '계속',
      tone: 'danger',
    });
    if (!first) return;

    const final = await useModalStore.getState().confirm({
      emoji: '🗑️',
      title: '정말로 삭제하시겠습니까?',
      message: '이 작업은 되돌릴 수 없습니다. 동일 이메일로 다시 가입하면 새 계정으로 시작합니다.',
      confirmText: '영구 삭제',
      tone: 'danger',
    });
    if (!final) return;

    try {
      await deleteAccount();
      setUser(null);
      setTanks([]);
      // Auth 계정도 서버에서 삭제됐으므로 onAuthChanged 가 자동 트리거되어 /onboarding 으로 이동
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await useModalStore.getState().alert({
        emoji: '⚠️',
        title: '탈퇴 실패',
        message: `${msg}\n\n문제가 계속되면 minsun9856@gmail.com 으로 문의해주세요.`,
        tone: 'danger',
      });
    }
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <div
      onClick={() => { onChange(!value); playSFX('click'); }}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? 'var(--color-accent)' : 'var(--color-surface)',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: value ? 22 : 2, width: 20, height: 20,
        borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
      }} />
    </div>
  );

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 15 }}>{label}</span>
      {children}
    </div>
  );

  const Section = ({ title }: { title: string }) => (
    <p style={{ color: 'var(--color-text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, padding: '16px 16px 6px' }}>{title}</p>
  );

  return (
    <div className="page">
      <div className="page-header">설정</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-surface)', margin: '0 16px', borderRadius: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🐟</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{user?.displayName || '게스트'}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Lv.{user?.level ?? 1} · Pearl {user?.pearl ?? 0} · Star Coral {user?.starCoral ?? 0}</div>
        </div>
      </div>

      <Section title="사운드" />
      <div style={{ background: 'var(--color-surface)', margin: '0 16px', borderRadius: 12, overflow: 'hidden' }}>
        <Row label="효과음"><Toggle value={sfxEnabled} onChange={setSfx} /></Row>
        <Row label="배경음악 (BGM)"><Toggle value={bgmEnabled} onChange={setBgm} /></Row>
      </div>

      <Section title="알림" />
      <div style={{ background: 'var(--color-surface)', margin: '0 16px', borderRadius: 12, overflow: 'hidden' }}>
        <Row label="푸시 알림 (부화 완료 등)">
          {pushSupported ? (
            <Toggle value={pushOn} onChange={handlePushToggle} />
          ) : (
            <span style={{ color: 'var(--color-text-disabled)', fontSize: 13 }}>미지원</span>
          )}
        </Row>
      </div>

      <Section title="앱" />
      <div style={{ background: 'var(--color-surface)', margin: '0 16px', borderRadius: 12, overflow: 'hidden' }}>
        <div
          onClick={() => window.dispatchEvent(new Event('aquaworld:show-install'))}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 15 }}>홈 화면에 설치</span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>›</span>
        </div>
      </div>

      <Section title="정보" />
      <div style={{ background: 'var(--color-surface)', margin: '0 16px', borderRadius: 12, overflow: 'hidden' }}>
        <Row label="버전"><span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>1.0.0</span></Row>
        <div
          onClick={() => navigate('/privacy')}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span style={{ fontSize: 15 }}>개인정보 처리방침</span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>›</span>
        </div>
        <div
          onClick={() => navigate('/terms')}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span style={{ fontSize: 15 }}>이용약관</span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>›</span>
        </div>
        <div
          onClick={() => navigate('/licenses')}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 15 }}>오픈소스 라이선스</span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>›</span>
        </div>
      </div>

      <Section title="계정" />
      <div style={{ background: 'var(--color-surface)', margin: '0 16px', borderRadius: 12, overflow: 'hidden' }}>
        <div
          onClick={handleLogout}
          style={{
            padding: '14px 16px', color: '#ff6b6b', cursor: 'pointer', fontSize: 15,
            borderBottom: isCloudUser ? '1px solid rgba(255,255,255,0.05)' : 'none',
          }}
        >
          로그아웃
        </div>
        {isCloudUser && (
          <div
            onClick={handleDeleteAccount}
            style={{ padding: '14px 16px', color: '#ff6b6b', cursor: 'pointer', fontSize: 15 }}
          >
            회원 탈퇴
            <div style={{ fontSize: 11, color: 'var(--color-text-disabled)', marginTop: 2 }}>
              모든 데이터 영구 삭제 · 복구 불가
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}
