import { useSyncExternalStore } from 'react';

/**
 * 가로 레이아웃 판별식 — global.css 의 미디어쿼리와 반드시 같아야 한다.
 * 어긋나면 UI 배치(카탈로그·패널)와 3D 시점이 서로 다른 기준으로 움직인다.
 * 방향만 보지 않고 높이도 거르는 이유는 global.css 주석 참고 (데스크톱 브라우저 창).
 */
export const LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 560px)';

const mql = typeof window !== 'undefined' ? window.matchMedia(LANDSCAPE_QUERY) : null;

function subscribe(onChange: () => void): () => void {
  mql?.addEventListener('change', onChange);
  return () => mql?.removeEventListener('change', onChange);
}

/** 가로 레이아웃 여부. 기기를 돌리면 리렌더된다. */
export function useIsLandscape(): boolean {
  return useSyncExternalStore(subscribe, () => mql?.matches ?? false, () => false);
}
