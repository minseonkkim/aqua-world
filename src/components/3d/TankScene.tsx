import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { createWaterMaterial } from './WaterShader';
import { useCameraControls } from '@/hooks/useCameraControls';
import { Fish, TankEnvironment } from '@/types';
import { STAGE_SCALE } from '@/constants';

interface Props {
  environment: TankEnvironment;
  fish?: Fish[];
  onFishClick?: (fish: Fish) => void;
  style?: React.CSSProperties;
}

const ENV: Record<TankEnvironment, { water: number; ambient: number; bg: string }> = {
  coral_reef:   { water: 0x006994, ambient: 0x4488bb, bg: '#001a33' },
  deep_sea:     { water: 0x001133, ambient: 0x112244, bg: '#000511' },
  korean_river: { water: 0x3a6b3a, ambient: 0x557755, bg: '#0d1f0d' },
  amazon:       { water: 0x1a4a2e, ambient: 0x336644, bg: '#0a1a10' },
  space:        { water: 0x0d0d2b, ambient: 0x1a1a44, bg: '#000008' },
};

// 희귀도별 색상
const RARITY_MESH_COLORS: Record<string, number> = {
  common: 0xaaaaaa,
  rare: 0x4488ff,
  epic: 0xaa44cc,
  legendary: 0xffaa00,
};

// 플레이스홀더 물고기 색상 (수조에 물고기가 없을 때 기본 표시용)
const DEFAULT_FISH_COLORS = [0xff6b35, 0xffd700, 0x4ecdc4, 0xff6b9d, 0x95e1d3];

export default function TankScene({ environment, fish = [], onFishClick, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const waterRef = useRef<THREE.Mesh | null>(null);
  const fishMeshesRef = useRef<THREE.Mesh[]>([]);
  const fishDataRef = useRef<(Fish | null)[]>([]);
  const rafRef = useRef(0);
  const clock = useRef(new THREE.Clock());
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);

  const { bindCanvas, apply } = useCameraControls(cameraRef);
  const env = ENV[environment];

  const buildFishMesh = useCallback((color: number, index: number, scale: number = 1): THREE.Mesh => {
    const geo = new THREE.SphereGeometry(0.22, 8, 6);
    geo.scale(1.5, 0.7, 0.9);
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color, shininess: 80 }));
    mesh.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6);
    mesh.scale.setScalar(scale);
    mesh.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.008,
      (Math.random() - 0.5) * 0.02,
    );
    mesh.userData.phase = Math.random() * Math.PI * 2;
    mesh.userData.fishIndex = index;
    return mesh;
  }, []);

  const syncFishMeshes = useCallback((scene: THREE.Scene) => {
    // 기존 물고기 메시 제거
    fishMeshesRef.current.forEach(m => scene.remove(m));
    fishMeshesRef.current = [];
    fishDataRef.current = [];

    if (fish.length > 0) {
      // 실제 물고기 데이터 기반 렌더링
      fish.forEach((f, i) => {
        // speciesId로 희귀도 유추하는 대신 저장된 position 사용
        const color = RARITY_MESH_COLORS.common; // 기본 common, 이후 GLB 교체 예정
        const stageScale = STAGE_SCALE[f.growthStage] ?? 1;
        const mesh = buildFishMesh(color, i, stageScale);
        // 저장된 위치가 있으면 사용
        mesh.position.set(f.position.x, f.position.y, f.position.z);
        scene.add(mesh);
        fishMeshesRef.current.push(mesh);
        fishDataRef.current.push(f);
      });
    } else {
      // 빈 수조: 기본 플레이스홀더 5마리
      DEFAULT_FISH_COLORS.forEach((color, i) => {
        const mesh = buildFishMesh(color, i);
        scene.add(mesh);
        fishMeshesRef.current.push(mesh);
        fishDataRef.current.push(null);
      });
    }
  }, [fish, buildFishMesh]);

  const init = useCallback((canvas: HTMLCanvasElement) => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(new THREE.Color(env.bg), 1);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(new THREE.Color(env.bg), 0.05);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    camera.position.set(0, 4, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    apply();

    scene.add(new THREE.AmbientLight(env.ambient, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 10, 5);
    scene.add(sun);
    const under = new THREE.PointLight(0x4488ff, 0.8, 15);
    under.position.set(0, -2, 0);
    scene.add(under);

    // 수조 유리
    scene.add(new THREE.Mesh(
      new THREE.BoxGeometry(10, 6, 8),
      new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.06, roughness: 0, side: THREE.BackSide }),
    ));

    // 바닥
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    scene.add(floor);

    // 수면
    const waterMat = createWaterMaterial();
    (waterMat.uniforms.uWaterColor.value as THREE.Color).set(env.water);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(10, 8, 32, 32), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 2.9;
    scene.add(water);
    waterRef.current = water;

    // 자갈
    for (let i = 0; i < 60; i++) {
      const g = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 + Math.random() * 0.08, 4, 4),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.08, 0.3 + Math.random() * 0.3, 0.3 + Math.random() * 0.2),
          roughness: 0.9,
        }),
      );
      g.position.set((Math.random() - 0.5) * 9, -2.95, (Math.random() - 0.5) * 7);
      scene.add(g);
    }

    syncFishMeshes(scene);

    const ro = new ResizeObserver(() => {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      renderer.setSize(cw, ch);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
    });
    ro.observe(canvas);
    return ro;
  }, [apply, env, syncFishMeshes]);

  // fish prop 변경 시 메시 동기화
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    syncFishMeshes(scene);
  }, [syncFishMeshes]);

  // 클릭/탭 핸들러 (드래그와 구분)
  const handlePointerDown = useCallback((e: PointerEvent) => {
    clickStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!clickStartRef.current || !onFishClick) return;
    const dx = e.clientX - clickStartRef.current.x;
    const dy = e.clientY - clickStartRef.current.y;
    // 5px 이상 움직이면 드래그로 간주
    if (Math.sqrt(dx * dx + dy * dy) > 5) return;

    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!canvas || !camera || !scene) return;

    const rect = canvas.getBoundingClientRect();
    pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(pointerRef.current, camera);
    const hits = raycasterRef.current.intersectObjects(fishMeshesRef.current);
    if (hits.length > 0) {
      const idx = hits[0].object.userData.fishIndex as number;
      const fishData = fishDataRef.current[idx];
      if (fishData) onFishClick(fishData);
    }
  }, [onFishClick]);

  const animate = useCallback(() => {
    rafRef.current = requestAnimationFrame(animate);
    const t = clock.current.getElapsedTime();
    if (waterRef.current) {
      (waterRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    }
    fishMeshesRef.current.forEach(f => {
      const vel = f.userData.vel as THREE.Vector3;
      f.position.x += vel.x;
      f.position.y += vel.y + Math.sin(t * 1.5 + f.userData.phase) * 0.003;
      f.position.z += vel.z;
      if (Math.abs(f.position.x) > 4.5) vel.x *= -1;
      if (Math.abs(f.position.y) > 2.5) vel.y *= -1;
      if (Math.abs(f.position.z) > 3.5) vel.z *= -1;
      if (vel.length() > 0.001) f.rotation.y = Math.atan2(vel.x, vel.z);
    });
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = init(canvas);
    animate();
    const cleanup = bindCanvas(canvas);

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      cleanup?.();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      rendererRef.current?.dispose();
    };
  }, [init, animate, bindCanvas, handlePointerDown, handlePointerUp]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', ...style }}
    />
  );
}
