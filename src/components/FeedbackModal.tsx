import React, { useState } from 'react';
import { submitFeedback, FeedbackType } from '@/services/feedback';
import { useUserStore } from '@/store/useUserStore';
import { useModalStore } from '@/store/useModalStore';
import { playSFX } from '@/services/audio';

const TYPES: { key: FeedbackType; label: string; emoji: string }[] = [
  { key: 'bug', label: '버그 신고', emoji: '🐞' },
  { key: 'suggestion', label: '제안', emoji: '💡' },
  { key: 'other', label: '기타', emoji: '💬' },
];

const MAX_LEN = 2000;

const PLACEHOLDER: Record<FeedbackType, string> = {
  bug: '어떤 상황에서 무슨 문제가 생겼나요? (예: 부화 버튼을 눌렀는데 알이 사라졌어요)',
  suggestion: '있었으면 하는 기능이나 더 좋아졌으면 하는 점을 적어주세요.',
  other: '자유롭게 의견을 남겨주세요.',
};

export default function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useUserStore((s) => s.user);
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const close = () => {
    if (busy) return;
    playSFX('modal_close');
    onClose();
  };

  const handleSubmit = async () => {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await submitFeedback({ type, message: text, contact: contact.trim() || undefined });
      playSFX('confirm');
      onClose();
      setMessage('');
      await useModalStore.getState().alert({
        emoji: '🙏',
        title: '의견 감사합니다!',
        message: '소중한 의견이 개발팀에 잘 전달됐어요.\n보내주신 내용은 꼼꼼히 살펴볼게요.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await useModalStore.getState().alert({
        emoji: '⚠️',
        title: '전송 실패',
        tone: 'danger',
        message: `${msg}\n\n잠시 후 다시 시도해주세요.`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 2100,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 20,
          padding: '24px 22px 18px',
          width: '100%',
          maxWidth: 360,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>의견 보내기</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          베타 기간 동안 여러분의 의견이 가장 큰 힘이 돼요.
        </p>

        {/* 유형 선택 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {TYPES.map((t) => {
            const active = t.key === type;
            return (
              <button
                key={t.key}
                onClick={() => { setType(t.key); playSFX('click'); }}
                style={{
                  flex: 1, padding: '10px 4px', borderRadius: 10, cursor: 'pointer',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  border: active ? '1px solid var(--color-accent)' : '1px solid rgba(255,255,255,0.1)',
                  background: active ? 'var(--color-accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 2 }}>{t.emoji}</div>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* 본문 */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
          placeholder={PLACEHOLDER[type]}
          rows={5}
          autoFocus
          style={{
            width: '100%', resize: 'none', boxSizing: 'border-box',
            background: 'var(--color-bg)', color: 'var(--color-text)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
            padding: '12px 12px', fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit',
          }}
        />
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-text-disabled)', margin: '4px 2px 12px' }}>
          {message.length} / {MAX_LEN}
        </div>

        {/* 연락처(선택) */}
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="답변받을 이메일 (선택)"
          inputMode="email"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--color-bg)', color: 'var(--color-text)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
            padding: '11px 12px', fontSize: 14, fontFamily: 'inherit', marginBottom: 16,
          }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={close} disabled={busy}>
            취소
          </button>
          <button
            className="btn"
            style={{
              flex: 2, background: 'var(--color-accent)', color: '#fff',
              opacity: !message.trim() || busy ? 0.5 : 1,
            }}
            onClick={handleSubmit}
            disabled={!message.trim() || busy}
          >
            {busy ? '보내는 중…' : '보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}
