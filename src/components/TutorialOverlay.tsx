import React from 'react';

export type TutorialAction =
  | { type: 'next' }
  | { type: 'gift_egg' }
  | { type: 'skip' };

interface Props {
  step: number; // 1..5
  onAction: (action: TutorialAction) => void;
}

interface StepDef {
  emoji: string;
  title: string;
  body: string;
  /** 액션 버튼 라벨. null이면 사용자 행동을 기다림 (자동 진행) */
  actionLabel: string | null;
  action?: TutorialAction;
  /** 화면 한쪽을 가리키는 핀 위치. 없으면 가운데 카드 형태 */
  pinTo?: 'incubator' | 'incubator-collect';
  /** true면 전체 화면 차단 모달, false면 하단 비차단 카드 */
  blocking: boolean;
}

const STEPS: Record<number, StepDef> = {
  1: {
    emoji: '🌊',
    title: 'AquaWorld에 오신 것을 환영합니다!',
    body: '나만의 3D 수족관에서 알을 부화시키고 물고기를 키워보세요.',
    actionLabel: '시작하기',
    action: { type: 'next' },
    blocking: true,
  },
  2: {
    emoji: '🎥',
    title: '수조 둘러보기',
    body: '화면을 드래그하면 시점이 회전하고, 핀치/마우스 휠로 줌인·줌아웃 할 수 있어요. 더블탭하면 시점이 초기화됩니다.',
    actionLabel: '확인했어요',
    action: { type: 'next' },
    blocking: true,
  },
  3: {
    emoji: '🎁',
    title: '첫 알을 선물로 드릴게요',
    body: '튜토리얼용 특별 알이에요. 평소보다 훨씬 빠르게 부화합니다 (10초).',
    actionLabel: '알 받기',
    action: { type: 'gift_egg' },
    blocking: true,
  },
  4: {
    emoji: '🥚',
    title: '인큐베이터를 열고 부화 시작!',
    body: '왼쪽 아래 🥚 버튼을 눌러 인큐베이터를 열고, "부화 시작" 버튼을 눌러주세요.',
    actionLabel: null,
    pinTo: 'incubator',
    blocking: false,
  },
  5: {
    emoji: '⏳',
    title: '잠시 후 부화해요!',
    body: '부화 완료되면 "수확!" 버튼을 눌러 첫 물고기를 만나보세요.',
    actionLabel: null,
    pinTo: 'incubator-collect',
    blocking: false,
  },
};

export default function TutorialOverlay({ step, onAction }: Props) {
  const def = STEPS[step];
  if (!def) return null;

  const Skip = (
    <button
      onClick={() => onAction({ type: 'skip' })}
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        background: 'rgba(255,255,255,0.08)',
        border: 'none',
        color: 'var(--color-text-secondary)',
        fontSize: 12,
        padding: '6px 12px',
        borderRadius: 999,
        cursor: 'pointer',
      }}
    >
      건너뛰기
    </button>
  );

  if (def.blocking) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1400,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        {Skip}
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            background: 'var(--color-bg-light)',
            borderRadius: 20,
            padding: '28px 24px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'aw-tutorial-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 8 }}>{def.emoji}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, letterSpacing: 2 }}>
            STEP {step} / 5
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{def.title}</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            {def.body}
          </div>
          <button
            onClick={() => def.action && onAction(def.action)}
            style={{
              width: '100%',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '14px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {def.actionLabel}
          </button>
        </div>
        <style>{`
          @keyframes aw-tutorial-pop {
            0% { transform: scale(0.85); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // 비차단 상단 카드 + 핀 화살표 (하단 인큐베이터/수확 버튼 침범 방지)
  const pinStyle: React.CSSProperties =
    def.pinTo === 'incubator'
      ? { position: 'absolute', left: 12, bottom: 80 + 36, fontSize: 32, animation: 'aw-arrow-bounce 0.8s ease-in-out infinite', pointerEvents: 'none' }
      : def.pinTo === 'incubator-collect'
        ? { position: 'absolute', left: 80, bottom: 180, fontSize: 32, animation: 'aw-arrow-bounce 0.8s ease-in-out infinite', pointerEvents: 'none' }
        : { display: 'none' };

  return (
    <>
      {/* 핀 화살표 */}
      <div style={pinStyle}>👇</div>

      {/* 상단 안내 카드 (HUD 바로 아래) */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: 'calc(var(--safe-top) + 56px)',
          background: 'rgba(10,22,40,0.95)',
          border: '1px solid var(--color-primary-light)',
          borderRadius: 16,
          padding: '14px 16px',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          zIndex: 1200,
          boxShadow: '0 4px 24px rgba(0,102,204,0.3)',
          animation: 'aw-tutorial-slide 0.3s ease-out',
        }}
      >
        <div style={{ fontSize: 32, lineHeight: 1 }}>{def.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--color-primary-light)', letterSpacing: 1.5, marginBottom: 2 }}>
            STEP {step} / 5
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{def.title}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {def.body}
          </div>
        </div>
        <button
          onClick={() => onAction({ type: 'skip' })}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-disabled)',
            fontSize: 11,
            padding: 4,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          건너뛰기
        </button>
      </div>

      <style>{`
        @keyframes aw-tutorial-slide {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes aw-arrow-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </>
  );
}
