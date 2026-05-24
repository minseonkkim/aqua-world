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

export function useCameraControls(
  cameraRef: RefObject<THREE.PerspectiveCamera | null>,
  target = new THREE.Vector3(0, 0, 0),
) {
  const state = useRef<CameraState>({ ...DEFAULT });
  const lastMouse = useRef<{ x: number; y: number } | null>(null);
  const lastPinch = useRef<number | null>(null);
  const lastTap = useRef(0);

  const apply = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const { theta, phi, radius } = state.current;
    cam.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta),
    );
    cam.lookAt(target);
  }, [cameraRef, target]);

  const reset = useCallback(() => {
    state.current = { ...DEFAULT };
    apply();
  }, [apply]);

  const bindCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => { lastMouse.current = { x: e.clientX, y: e.clientY }; };
    const onMouseMove = (e: MouseEvent) => {
      if (!lastMouse.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      state.current.theta -= dx * SENS;
      state.current.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, state.current.phi + dy * SENS));
      lastMouse.current = { x: e.clientX, y: e.clientY };
      apply();
    };
    const onMouseUp = () => { lastMouse.current = null; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      state.current.radius = Math.max(MIN_R, Math.min(MAX_R, state.current.radius + e.deltaY * 0.01));
      apply();
    };

    const dist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e: TouchEvent) => {
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

  return { bindCanvas, apply, reset };
}
