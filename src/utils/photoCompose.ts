// 포토 모드 — 필터/프레임/워터마크 합성
// 입력: TankScene 캔버스에서 캡처한 PNG dataURL
// 출력: 합성된 Blob (공유/저장용)

export type PhotoFilter = 'none' | 'warm' | 'cool' | 'vintage' | 'mono';
export type PhotoFrame = 'none' | 'polaroid' | 'gradient';

export const FILTER_LABELS: Record<PhotoFilter, string> = {
  none: '원본',
  warm: '따뜻하게',
  cool: '차갑게',
  vintage: '빈티지',
  mono: '흑백',
};

export const FRAME_LABELS: Record<PhotoFrame, string> = {
  none: '없음',
  polaroid: '폴라로이드',
  gradient: '그라데이션',
};

// CSS canvas filter 문자열 — iOS Safari 13+, Chrome 모두 지원
const FILTER_CSS: Record<PhotoFilter, string> = {
  none: 'none',
  warm: 'sepia(0.3) saturate(1.35) brightness(1.05)',
  cool: 'saturate(1.2) hue-rotate(-12deg) brightness(1.02) contrast(1.05)',
  vintage: 'sepia(0.55) contrast(0.92) brightness(1.05) saturate(0.9)',
  mono: 'grayscale(1) contrast(1.12)',
};

// 프레임별 패딩 (이미지 가장자리에 추가되는 여백)
const FRAME_PADDING: Record<PhotoFrame, { top: number; right: number; bottom: number; left: number }> = {
  none: { top: 0, right: 0, bottom: 0, left: 0 },
  polaroid: { top: 28, right: 28, bottom: 110, left: 28 },
  gradient: { top: 18, right: 18, bottom: 18, left: 18 },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = src;
  });
}

interface ComposeOptions {
  dataUrl: string;
  filter: PhotoFilter;
  frame: PhotoFrame;
}

interface ComposeResult {
  blob: Blob;
  dataUrl: string;
}

export async function composePhoto({ dataUrl, filter, frame }: ComposeOptions): Promise<ComposeResult> {
  const img = await loadImage(dataUrl);
  const pad = FRAME_PADDING[frame];
  const outW = img.naturalWidth + pad.left + pad.right;
  const outH = img.naturalHeight + pad.top + pad.bottom;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context 생성 실패');

  // 1. 프레임 배경
  drawFrameBackground(ctx, frame, outW, outH);

  // 2. 필터 적용된 본 이미지
  ctx.save();
  ctx.filter = FILTER_CSS[filter];
  ctx.drawImage(img, pad.left, pad.top);
  ctx.restore();

  // 3. 프레임 전경 (테두리/장식)
  drawFrameForeground(ctx, frame, outW, outH, pad);

  // 4. 워터마크 — 항상 우측 하단(이미지 영역 내부)
  drawWatermark(ctx, pad.left, pad.top, img.naturalWidth, img.naturalHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Blob 변환 실패'));
        // dataUrl은 미리보기 표시용
        resolve({ blob, dataUrl: canvas.toDataURL('image/png') });
      },
      'image/png',
      0.95,
    );
  });
}

function drawFrameBackground(ctx: CanvasRenderingContext2D, frame: PhotoFrame, w: number, h: number) {
  if (frame === 'none') return;
  if (frame === 'polaroid') {
    ctx.fillStyle = '#f5f0e6';
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (frame === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#4dd0e1');
    grad.addColorStop(0.5, '#26c6da');
    grad.addColorStop(1, '#0097a7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawFrameForeground(
  ctx: CanvasRenderingContext2D,
  frame: PhotoFrame,
  w: number,
  _h: number,
  pad: { top: number; right: number; bottom: number; left: number },
) {
  if (frame === 'polaroid') {
    // 손글씨 느낌 캡션
    ctx.fillStyle = '#3a3a3a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const captionY = _h - pad.bottom / 2;
    ctx.font = '600 38px "Pacifico", "Brush Script MT", "Noto Sans KR", cursive';
    ctx.fillText('My AquaWorld', w / 2, captionY - 12);
    ctx.font = '400 22px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#8a8a8a';
    const date = new Date();
    const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    ctx.fillText(dateStr, w / 2, captionY + 26);
  }
  // gradient는 배경만으로 충분 — 추가 장식 없음
}

function drawWatermark(ctx: CanvasRenderingContext2D, ox: number, oy: number, imgW: number, imgH: number) {
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  const padding = Math.max(12, imgW * 0.018);
  const fontSize = Math.max(16, imgW * 0.028);
  ctx.font = `700 ${fontSize}px "Noto Sans KR", sans-serif`;

  // 글로우/외곽선 — 어떤 배경에서도 읽히도록
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillText('🐟 AquaWorld', ox + imgW - padding + 1, oy + imgH - padding + 1);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillText('🐟 AquaWorld', ox + imgW - padding, oy + imgH - padding);
  ctx.restore();
}

// 공유/저장 헬퍼

export async function sharePhoto(blob: Blob): Promise<'shared' | 'downloaded' | 'cancelled' | 'error'> {
  const fileName = `aquaworld_${Date.now()}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  // Web Share API (Level 2 — files 지원) 우선
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'AquaWorld',
        text: '내 수족관 한 컷! 🐟',
      });
      return 'shared';
    } catch (e: unknown) {
      // 사용자가 공유 시트를 닫으면 AbortError
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // 그 외 실패 시 다운로드 폴백
    }
  }
  // 폴백: 다운로드
  return downloadPhoto(blob, fileName) ? 'downloaded' : 'error';
}

export function downloadPhoto(blob: Blob, fileName?: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ?? `aquaworld_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
