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
  // 기본 시점 거리 — 화면 비율/수조 크기에 따라 씬이 정해준다(setDefaultRadius).
  // 가로에서는 세로 FOV 가 고정이라 같은 거리에서 수조 앞·아래가 잘린다.
  const defaultRadius = useRef(DEFAULT.radius);
  // 사용자가 핀치/휠로 직접 줌한 뒤에는 기본 거리를 덮어쓰지 않는다 (회전 시 시점 유지).
  const userZoomed = useRef(false);
  const lastMouse = useRef<{ x: number; y: number } | null>(null);
  const lastPinch = useRef<number | null>(null);
  const lastTap = useRef(0);
  const enabledRef = useRef(true);
  // 시점 오프셋 — 꾸미기 모드에서 패널에 가린 만큼 수조를 반대쪽으로 밀어 화면 중앙에 오게 한다.
  // Y: 타겟을 내리면 수조가 위로 (세로 — 하단 카탈로그를 피함).
  // X: 화면 기준 오른쪽으로 밀면 수조가 왼쪽으로 (가로 — 우측 카탈로그를 피함).
  //    월드 X 가 아니라 '화면 오른쪽' 방향이라 사용자가 시점을 돌려도(theta) 방향이 안 틀어진다.
  // current는 매 프레임 desired로 보간(tickCamera), apply가 이를 타겟에 더해 적용.
  const focusOffsetY = useRef(0);
  const desiredOffsetY = useRef(0);
  const focusOffsetX = useRef(0);
  const desiredOffsetX = useRef(0);

  const apply = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const { theta, phi, radius } = state.current;
    // 화면 오른쪽 방향(카메라 right 벡터) = (cosθ, 0, -sinθ)
    const ox = focusOffsetX.current;
    const tx = target.x + Math.cos(theta) * ox;
    const tz = target.z - Math.sin(theta) * ox;
    const ty = target.y + focusOffsetY.current;
    cam.position.set(
      tx + radius * Math.sin(phi) * Math.sin(theta),
      ty + radius * Math.cos(phi),
      tz + radius * Math.sin(phi) * Math.cos(theta),
    );
    cam.lookAt(tx, ty, tz);
  }, [cameraRef, target]);

  // 목표 시점 오프셋 설정 — 실제 이동은 tickCamera가 프레임 단위로 보간
  const setFocusOffsetY = useCallback((y: number) => {
    desiredOffsetY.current = y;
  }, []);
  const setFocusOffsetX = useCallback((x: number) => {
    desiredOffsetX.current = x;
  }, []);

  // animate 루프에서 매 프레임 호출 — 오프셋을 목표로 부드럽게 보간하고 카메라 갱신.
  // 목표 도달 후에는 apply를 호출하지 않아 사용자 회전/줌 입력과 충돌하지 않는다.
  const tickCamera = useCallback((k: number) => {
    const dy = desiredOffsetY.current - focusOffsetY.current;
    const dx = desiredOffsetX.current - focusOffsetX.current;
    const settledY = Math.abs(dy) < 0.002;
    const settledX = Math.abs(dx) < 0.002;
    if (settledY && settledX) {
      // 도달 직후 한 번만 스냅 — 이후에는 apply를 부르지 않는다
      if (focusOffsetY.current !== desiredOffsetY.current || focusOffsetX.current !== desiredOffsetX.current) {
        focusOffsetY.current = desiredOffsetY.current;
        focusOffsetX.current = desiredOffsetX.current;
        apply();
      }
      return;
    }
    const t = Math.min(1, 0.1 * k);
    if (!settledY) focusOffsetY.current += dy * t;
    if (!settledX) focusOffsetX.current += dx * t;
    apply();
  }, [apply]);

  // 씬이 계산한 기본 시점 거리를 적용. 사용자가 아직 직접 줌하지 않았다면 즉시 반영된다
  // (회전으로 가로/세로가 바뀔 때 프레이밍을 다시 잡는 경로).
  const setDefaultRadius = useCallback((r: number) => {
    const clamped = Math.max(MIN_R, Math.min(MAX_R, r));
    defaultRadius.current = clamped;
    if (userZoomed.current || state.current.radius === clamped) return;
    state.current.radius = clamped;
    apply();
  }, [apply]);

  const reset = useCallback(() => {
    state.current = { ...DEFAULT, radius: defaultRadius.current };
    userZoomed.current = false;
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
      userZoomed.current = true;
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
        userZoomed.current = true;
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

  return {
    bindCanvas, apply, reset, setEnabled, setDefaultRadius,
    setFocusOffsetX, setFocusOffsetY, tickCamera,
  };
}
