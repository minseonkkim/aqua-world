import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analytics } from '@/services/analytics';

const SLIDES = [
  { title: '내 손안의\n살아있는 수족관', subtitle: '완전한 3D로 구현된\n나만의 수족관을 만들어보세요', emoji: '🐠' },
  { title: '희귀 물고기를\n수집하세요', subtitle: '전설급 실러캔스부터\n귀여운 클라운피시까지', emoji: '🐡' },
  { title: '언제 어디서나\n함께하는 수족관', subtitle: '먹이 줄 시간엔 알림으로 알려드려요\n자리를 비운 사이에도 무럭무럭 자라요', emoji: '🌊' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  // 드래그 중 트랙이 포인터를 따라오도록 px 오프셋을 상태로 둔다. 놓으면 0으로 스냅.
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);

  const next = () => {
    if (idx < SLIDES.length - 1) {
      setIdx(idx + 1);
      return;
    }
    // 마지막 슬라이드의 '시작하기' 만 완료로 카운트 — '건너뛰기' 는 제외.
    analytics.onboardingComplete();
    navigate('/login');
  };

  const onPointerDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
  };

  // move/up 은 window 에 건다 — 포인터가 컨테이너를 벗어나도 드래그가 끊기지 않는다.
  // setPointerCapture 를 안 쓰는 이유: 캡처하면 click 이 캡처 요소로 재타겟되어 버튼 클릭이 깨진다.
  useEffect(() => {
    const last = SLIDES.length - 1;
    const onMove = (e: PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      // 가로 의도가 분명해진 뒤부터 드래그 시작 (버튼 탭·세로 스크롤과 구분)
      if (!movedRef.current) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        movedRef.current = true;
        setDragging(true);
      }
      // 첫/마지막 슬라이드 바깥으로는 저항감 있게 1/3 만 따라온다
      const resist = (idx === 0 && dx > 0) || (idx === last && dx < 0);
      setDragX(resist ? dx / 3 : dx);
    };
    const onUp = (e: PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      startRef.current = null;
      if (!movedRef.current) return;
      movedRef.current = false;
      // 드래그 직후 따라오는 click 1회 무시 — click 은 pointerup 과 같은 태스크에서 동기 발화하므로
      // 다음 태스크에서 플래그를 풀면 이후 정상 클릭은 통과한다.
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 0);
      const dx = e.clientX - s.x;
      if (dx < -60 && idx < last) setIdx(idx + 1);
      else if (dx > 60 && idx > 0) setIdx(idx - 1);
      setDragging(false);
      setDragX(0);
    };
    const onCancel = () => {
      startRef.current = null;
      movedRef.current = false;
      setDragging(false);
      setDragX(0);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [idx]);

  return (
    <div
      onPointerDown={onPointerDown}
      onClickCapture={e => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '48px 32px 48px', background: 'var(--color-bg)', userSelect: 'none', touchAction: 'pan-y', overflow: 'hidden' }}
    >
      <div style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            height: '100%',
            transform: `translateX(calc(${-idx * 100}% + ${dragX}px))`,
            transition: dragging ? 'none' : 'transform 0.3s ease',
            willChange: 'transform',
          }}
        >
          {SLIDES.map((s, i) => (
            <div key={i} style={{ flex: '0 0 100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 80 }}>{s.emoji}</div>
              <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'pre-line' }}>{s.title}</h1>
              <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{s.subtitle}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {SLIDES.map((_, i) => (
            <div key={i} style={{ height: 8, borderRadius: 4, background: i === idx ? 'var(--color-accent)' : 'var(--color-surface)', width: i === idx ? 24 : 8, transition: 'all 0.2s' }} />
          ))}
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={next}>
          {idx < SLIDES.length - 1 ? '다음' : '시작하기'}
        </button>
        {idx < SLIDES.length - 1 && (
          <button style={{ color: 'var(--color-text-secondary)', fontSize: 14, padding: 8 }} onClick={() => navigate('/login')}>건너뛰기</button>
        )}
      </div>
    </div>
  );
}
