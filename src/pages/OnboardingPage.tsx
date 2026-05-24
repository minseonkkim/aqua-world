import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SLIDES = [
  { title: '내 손안의\n살아있는 수족관', subtitle: '완전한 3D로 구현된\n나만의 수족관을 만들어보세요', emoji: '🐠' },
  { title: '희귀 물고기를\n수집하세요', subtitle: '전설급 실러캔스부터\n귀여운 클라운피시까지', emoji: '🐡' },
  { title: '어디서나 즐기는\nPWA 앱', subtitle: '설치 없이 브라우저에서 바로\n오프라인에서도 동작해요', emoji: '🌊' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);

  const next = () => idx < SLIDES.length - 1 ? setIdx(idx + 1) : navigate('/login');
  const slide = SLIDES[idx];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '48px 32px 48px', background: 'var(--color-bg)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 80 }}>{slide.emoji}</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'pre-line' }}>{slide.title}</h1>
        <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{slide.subtitle}</p>
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
