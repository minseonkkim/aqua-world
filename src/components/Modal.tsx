import React, { useEffect } from 'react';
import { useModalStore, ModalTone } from '@/store/useModalStore';

const TONE_COLOR: Record<ModalTone, string> = {
  default: 'var(--color-primary)',
  danger: 'var(--color-error)',
  info: 'var(--color-secondary)',
};

export default function Modal() {
  const queue = useModalStore((s) => s.queue);
  const resolveTop = useModalStore((s) => s.resolveTop);
  const top = queue[0];

  useEffect(() => {
    if (!top) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveTop(false);
      else if (e.key === 'Enter') resolveTop(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [top, resolveTop]);

  if (!top) return null;

  const tone = top.tone ?? 'default';
  const isConfirm = top.variant === 'confirm';
  const confirmText = top.confirmText ?? (isConfirm ? '확인' : 'OK');
  const cancelText = top.cancelText ?? '취소';

  return (
    <div
      onClick={() => isConfirm && resolveTop(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
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
          padding: '28px 24px 20px',
          width: '100%',
          maxWidth: 320,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.1)',
          textAlign: 'center',
        }}
      >
        {top.emoji && (
          <div style={{ fontSize: 44, marginBottom: 8 }}>{top.emoji}</div>
        )}
        {top.title && (
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {top.title}
          </h2>
        )}
        <p style={{
          fontSize: 14, color: 'var(--color-text-secondary)',
          marginBottom: 22, lineHeight: 1.5, whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {top.message}
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          {isConfirm && (
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={() => resolveTop(false)}
            >
              {cancelText}
            </button>
          )}
          <button
            className="btn"
            style={{
              flex: 1,
              background: TONE_COLOR[tone],
              color: tone === 'default' ? '#fff' : '#fff',
            }}
            onClick={() => resolveTop(true)}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
