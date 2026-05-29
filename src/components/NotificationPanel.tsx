import React, { useEffect } from 'react';
import { useNotificationStore } from '@/store/useNotificationStore';

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

interface Props {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: Props) {
  const { notifications, markAllRead, remove, clearAll } = useNotificationStore();

  // 패널이 열리면 모두 읽음 처리 (배지 제거)
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  return (
    <>
      {/* 바깥 클릭 시 닫기 */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, zIndex: 70 }}
      />
      <div style={{
        position: 'absolute',
        top: 'calc(var(--safe-top) + 52px)', right: 12,
        width: 300, maxHeight: 420,
        background: 'rgba(10,22,40,0.97)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        zIndex: 71,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>🔔 알림</span>
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}
            >
              모두 지우기
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div style={{
            padding: '32px 16px', textAlign: 'center',
            color: 'var(--color-text-secondary)', fontSize: 13,
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🫧</div>
            아직 알림이 없어요
          </div>
        ) : (
          <div style={{ overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notifications.map(n => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 12, padding: '10px 12px',
              }}>
                <span style={{ fontSize: 24, lineHeight: 1.1 }}>{n.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
                  {n.body && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--color-text-disabled)', marginTop: 4 }}>
                    {relativeTime(n.createdAt)}
                  </div>
                </div>
                <button
                  onClick={() => remove(n.id)}
                  style={{ fontSize: 14, color: 'var(--color-text-disabled)', padding: 2 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
