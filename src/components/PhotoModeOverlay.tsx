import React, { useState, useCallback } from 'react';
import {
  PhotoFilter, PhotoFrame, FILTER_LABELS, FRAME_LABELS,
  composePhoto, sharePhoto, savePhoto,
} from '@/utils/photoCompose';
import { playSFX } from '@/services/audio';
import { analytics } from '@/services/analytics';

interface Props {
  /** 부모에서 TankScene의 captureFrame을 호출해 PNG dataURL을 반환 */
  onCapture: () => string | null;
  onExit: () => void;
  onToast: (msg: string) => void;
}

type Stage = 'compose' | 'processing' | 'preview';

const FILTER_PREVIEW: Record<PhotoFilter, string> = {
  none: 'none',
  warm: 'sepia(0.3) saturate(1.35) brightness(1.05)',
  cool: 'saturate(1.2) hue-rotate(-12deg) brightness(1.02) contrast(1.05)',
  vintage: 'sepia(0.55) contrast(0.92) brightness(1.05) saturate(0.9)',
  mono: 'grayscale(1) contrast(1.12)',
};

const FILTERS: PhotoFilter[] = ['none', 'warm', 'cool', 'vintage', 'mono'];
const FRAMES: PhotoFrame[] = ['none', 'polaroid', 'gradient'];

const FILTER_EMOJI: Record<PhotoFilter, string> = {
  none: '🌊', warm: '🌅', cool: '❄️', vintage: '📻', mono: '🎬',
};

const FRAME_EMOJI: Record<PhotoFrame, string> = {
  none: '⬜', polaroid: '📷', gradient: '🎨',
};

export default function PhotoModeOverlay({ onCapture, onExit, onToast }: Props) {
  const [filter, setFilter] = useState<PhotoFilter>('none');
  const [frame, setFrame] = useState<PhotoFrame>('none');
  const [stage, setStage] = useState<Stage>('compose');
  const [preview, setPreview] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  const handleCapture = useCallback(async () => {
    const raw = onCapture();
    if (!raw) {
      onToast('캡처 실패 — 잠시 후 다시 시도해주세요');
      return;
    }
    playSFX('shutter');
    setStage('processing');
    try {
      const { blob, dataUrl } = await composePhoto({ dataUrl: raw, filter, frame });
      setResultBlob(blob);
      setPreview(dataUrl);
      setStage('preview');
    } catch (e) {
      console.error('[PhotoMode] compose failed', e);
      onToast('이미지 합성 실패');
      setStage('compose');
    }
  }, [onCapture, filter, frame, onToast]);

  const handleRetake = useCallback(() => {
    setStage('compose');
    setPreview(null);
    setResultBlob(null);
  }, []);

  const handleShare = useCallback(async () => {
    if (!resultBlob) return;
    const result = await sharePhoto(resultBlob);
    if (result === 'shared') {
      analytics.photoCapture(filter, frame, 'shared');
      onToast('✨ 공유 완료!');
    } else if (result === 'downloaded') {
      analytics.photoCapture(filter, frame, 'downloaded');
      onToast('💾 갤러리에 저장됨');
    } else if (result === 'cancelled') {/* 무음 */}
    else onToast('공유 실패');
  }, [resultBlob, onToast, filter, frame]);

  const handleSave = useCallback(async () => {
    if (!resultBlob) return;
    if (await savePhoto(resultBlob)) {
      analytics.photoCapture(filter, frame, 'downloaded');
      onToast('💾 저장 완료!');
    } else onToast('저장 실패');
  }, [resultBlob, onToast, filter, frame]);

  // 미리보기 화면
  if (stage === 'preview' && preview) {
    return (
      <div style={overlayStyle}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'calc(var(--safe-top) + 12px) 12px 12px', overflow: 'hidden',
        }}>
          <img
            src={preview}
            alt="포토 미리보기"
            style={{
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
              borderRadius: 8, boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            }}
          />
        </div>
        <div style={{
          display: 'flex', gap: 10, padding: '12px 16px calc(var(--safe-bottom, 0px) + 16px)',
          justifyContent: 'center', background: 'rgba(0,0,0,0.85)',
        }}>
          <button onClick={handleRetake} style={previewBtnStyle('#9e9e9e')}>↺ 재촬영</button>
          <button onClick={handleSave} style={previewBtnStyle('#ffd54f')}>💾 저장</button>
          <button onClick={handleShare} style={previewBtnStyle('#4dd0e1', true)}>📤 공유</button>
          <button onClick={onExit} style={previewBtnStyle('#ef5350')}>✕ 닫기</button>
        </div>
      </div>
    );
  }

  // 처리 중 — 셔터 플래시
  if (stage === 'processing') {
    return (
      <div style={overlayStyle}>
        <div style={{
          position: 'absolute', inset: 0,
          background: '#fff', opacity: 0.6,
          animation: 'photo-flash 600ms ease-out forwards',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff', fontSize: 14, fontWeight: 600,
          background: 'rgba(0,0,0,0.7)', padding: '10px 18px', borderRadius: 20,
        }}>
          ✨ 합성 중...
        </div>
        <style>{`
          @keyframes photo-flash {
            0% { opacity: 0.9; }
            100% { opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // 촬영 모드 — 하단 컨트롤만 표시, 3D 씬은 그대로 노출
  // position: fixed로 탭바까지 덮음 (TankPage가 flex 컨테이너 안에 있어서 absolute로는 못 가림)
  return (
    <>
      {/* 상단 — 종료 + 안내 */}
      <div style={{
        position: 'fixed', top: 'calc(var(--safe-top) + 12px)', left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 12px', zIndex: 1400,
      }}>
        <button onClick={onExit} style={{
          background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
        }}>✕ 종료</button>
        <div style={{
          background: 'rgba(0,0,0,0.65)', borderRadius: 16, padding: '5px 12px',
          color: '#fff', fontSize: 12, fontWeight: 600,
          border: '1px solid rgba(77, 208, 225, 0.4)',
        }}>📷 포토 모드</div>
        <div style={{ width: 60 }} /> {/* 좌우 정렬 */}
      </div>

      {/* 탭바 가리기용 검은 스트립 — 하단 컨트롤 뒤에 깔림 */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, top: 'auto',
        height: 'calc(var(--tab-height, 60px) + var(--safe-bottom, 0px))',
        background: '#000', zIndex: 1380,
      }} />

      {/* 하단 컨트롤 — 필터/프레임/셔터 */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 30%)',
        padding: '40px 0 calc(var(--safe-bottom, 0px) + 12px)',
        zIndex: 1400,
      }}>
        {/* 필터 칩 */}
        <ChipRow
          title="필터"
          items={FILTERS}
          activeId={filter}
          getLabel={(id) => `${FILTER_EMOJI[id]} ${FILTER_LABELS[id]}`}
          getFilter={(id) => FILTER_PREVIEW[id]}
          onSelect={setFilter}
        />
        {/* 프레임 칩 */}
        <ChipRow
          title="프레임"
          items={FRAMES}
          activeId={frame}
          getLabel={(id) => `${FRAME_EMOJI[id]} ${FRAME_LABELS[id]}`}
          onSelect={setFrame}
        />
        {/* 셔터 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <button onClick={handleCapture} style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#fff', border: '4px solid rgba(255,255,255,0.4)',
            boxShadow: '0 0 0 3px rgba(77, 208, 225, 0.6), 0 4px 16px rgba(0,0,0,0.5)',
            cursor: 'pointer', position: 'relative',
          }} aria-label="촬영">
            <span style={{
              position: 'absolute', inset: 6, borderRadius: '50%',
              background: '#fff', border: '2px solid #222',
            }} />
          </button>
        </div>
      </div>
    </>
  );
}

interface ChipRowProps<T extends string> {
  title: string;
  items: T[];
  activeId: T;
  getLabel: (id: T) => string;
  getFilter?: (id: T) => string;
  onSelect: (id: T) => void;
}

function ChipRow<T extends string>({ title, items, activeId, getLabel, getFilter, onSelect }: ChipRowProps<T>) {
  return (
    <div style={{ padding: '4px 12px 8px' }}>
      <div style={{
        fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600,
        marginBottom: 4, paddingLeft: 4, letterSpacing: 0.5,
      }}>
        {title.toUpperCase()}
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
        {items.map((id) => {
          const active = activeId === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              style={{
                flex: '0 0 auto',
                background: active ? 'rgba(77, 208, 225, 0.25)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${active ? 'rgba(77, 208, 225, 0.7)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 16, padding: '6px 14px', color: '#fff',
                fontSize: 12, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
                cursor: 'pointer', filter: getFilter ? getFilter(id) : 'none',
              }}
            >
              {getLabel(id)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: '#000', zIndex: 1400,
  display: 'flex', flexDirection: 'column',
};

function previewBtnStyle(color: string, primary = false): React.CSSProperties {
  return {
    background: primary ? color : `${color}22`,
    color: primary ? '#000' : color,
    border: `1px solid ${primary ? color : `${color}66`}`,
    borderRadius: 22, padding: '10px 18px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
