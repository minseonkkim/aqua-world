import { useRef, useCallback, RefObject } from 'react';
import * as THREE from 'three';

interface CameraState {
  theta: number;
  phi: number;
  radius: number;
}

const DEFAULT: CameraState = { theta: 0, phi: Math.PI / 4, radius: 8 };
const MIN_R = 3, MAX_R = 15, MIN_PHI = 0.1, MAX_PHI = Math.PI / 2.2;
const SENS = 0.005;
// 모듈 상수 — 매 호출마다 새 Vector3 생성을 방지 (apply useCallback 의존성 안정화)
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);

export function useCameraControls(
  cameraRef: RefObject<THREE.PerspectiveCamera | null>,
  target: THREE.Vector3 = DEFAULT_TARGET,
) {
  const state = useRef<CameraState>({ ...DEFAULT });
  const lastMouse = useRef<{ x: number; y: number } | null>(null);
  const lastPinch = useRef<number | null>(null);
  const lastTap = useRef(0);
  const enabledRef = useRef(true);
  // 시점 Y 오프셋 — 꾸미기 모드에서 타겟을 아래로 내려(바닥을 위로) 화면 중앙에 오게 한다.
  // current는 매 프레임 desired로 보간(tickCamera), apply가 이를 타겟 Y에 더해 적용.
  const focusOffsetY = useRef(0);
  const desiredOffsetY = useRef(0);

  const apply = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const { theta, phi, radius } = state.current;
    const ty = target.y + focusOffsetY.current;
    cam.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      ty + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta),
    );
    cam.lookAt(target.x, ty, target.z);
  }, [cameraRef, target]);

  // 목표 시점 오프셋 설정 — 실제 이동은 tickCamera가 프레임 단위로 보간
  const setFocusOffsetY = useCallback((y: number) => {
    desiredOffsetY.current = y;
  }, []);

  // animate 루프에서 매 프레임 호출 — 오프셋을 목표로 부드럽게 보간하고 카메라 갱신.
  // 목표 도달 후에는 apply를 호출하지 않아 사용자 회전/줌 입력과 충돌하지 않는다.
  const tickCamera = useCallback((k: number) => {
    const cur = focusOffsetY.current;
    const tgt = desiredOffsetY.current;
    const diff = tgt - cur;
    if (Math.abs(diff) < 0.002) {
      if (cur !== tgt) { focusOffsetY.current = tgt; apply(); }
      return;
    }
    focusOffsetY.current = cur + diff * Math.min(1, 0.1 * k);
    apply();
  }, [apply]);

  const reset = useCallback(() => {
    state.current = { ...DEFAULT };
    apply();
  }, [apply]);

  const bindCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!enabledRef.current || !lastMouse.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      state.current.theta -= dx * SENS;
      state.current.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, state.current.phi + dy * SENS));
      lastMouse.current = { x: e.clientX, y: e.clientY };
      apply();
    };
    const onMouseUp = () => { lastMouse.current = null; };
    const onWheel = (e: WheelEvent) => {
      if (!enabledRef.current) return;
      e.preventDefault();
      state.current.radius = Math.max(MIN_R, Math.min(MAX_R, state.current.radius + e.deltaY * 0.01));
      apply();
    };

    const dist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current) return;
      if (e.touches.length === 1) {
        lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        const now = Date.now();
        if (now - lastTap.current < 300) reset();
        lastTap.current = now;
      } else if (e.touches.length === 2) {
        lastPinch.current = dist(e.touches[0], e.touches[1]);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!enabledRef.current) return;
      e.preventDefault();
      if (e.touches.length === 1 && lastMouse.current) {
        const dx = e.touches[0].clientX - lastMouse.current.x;
        const dy = e.touches[0].clientY - lastMouse.current.y;
        state.current.theta -= dx * SENS;
        state.current.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, state.current.phi + dy * SENS));
        lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        apply();
      } else if (e.touches.length === 2 && lastPinch.current) {
        const newDist = dist(e.touches[0], e.touches[1]);
        state.current.radius = Math.max(MIN_R, Math.min(MAX_R, state.current.radius * (lastPinch.current / newDist)));
        lastPinch.current = newDist;
        apply();
      }
    };
    const onTouchEnd = () => { lastMouse.current = null; lastPinch.current = null; };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [apply, reset]);

  const setEnabled = useCallback((v: boolean) => {
    enabledRef.current = v;
    if (!v) { lastMouse.current = null; lastPinch.current = null; }
  }, []);

  return { bindCanvas, apply, reset, setEnabled, setFocusOffsetY, tickCamera };
}
