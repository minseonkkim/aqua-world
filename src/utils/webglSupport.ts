/**
 * WebGL 지원 여부 감지.
 *
 * `new THREE.WebGLRenderer()` 는 컨텍스트를 얻지 못하면 예외를 던진다. 구형 저사양 Android,
 * 하드웨어 가속이 꺼진 WebView, WebGL 이 차단된 브라우저에서 이 예외가 그대로 올라가면
 * 사용자에게는 검은 화면으로만 보이므로, 렌더러를 만들기 전에 먼저 여기서 걸러낸다.
 *
 * 결과를 캐시하지 않는 이유: 사용자가 브라우저 설정(하드웨어 가속)을 바꾼 뒤 "다시 시도"를
 * 누르면 재검사가 돼야 한다.
 */

/** 감지용 컨텍스트를 하나 열어보고 즉시 반납한다. 열리면 true. */
export function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    // three r170 은 webgl2 를 우선 사용하지만, 없으면 webgl1 로 폴백하므로 둘 다 확인한다.
    const gl = (canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;

    // 감지용으로 연 컨텍스트는 바로 버린다 — 동시 컨텍스트 수에 한도(보통 8~16)가 있는
    // 기기에서 실제 수조가 쓸 자리를 잡아먹지 않게.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    // 일부 환경은 지원 안 함을 예외로 알린다 (예: 컨텍스트 생성 자체가 throw).
    return false;
  }
}
