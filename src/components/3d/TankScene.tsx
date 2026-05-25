import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { createWaterMaterial } from './WaterShader';
import { useCameraControls } from '@/hooks/useCameraControls';
import { Fish, TankDecoration, TankEnvironment } from '@/types';
import { STAGE_SCALE } from '@/constants';
import { cloneFishModel, getFishModel, preloadFishModels } from '@/utils/fishModelLoader';
import { buildDecorationMesh } from '@/utils/decorationModels';
import { preloadDecorationModels } from '@/utils/decorationModelLoader';

interface Props {
  environment: TankEnvironment;
  fish?: Fish[];
  decorations?: TankDecoration[];
  onFishClick?: (fish: Fish) => void;
  /** true이면 데코 드래그/선택 활성, 물고기 클릭 무시 */
  decorationMode?: boolean;
  selectedDecorationId?: string | null;
  onDecorationSelect?: (id: string | null) => void;
  /** 드래그 종료 시 최종 위치 커밋 */
  onDecorationMove?: (id: string, position: { x: number; y: number; z: number }) => void;
  style?: React.CSSProperties;
}

const ENV: Record<TankEnvironment, { water: number; ambient: number; bg: string }> = {
  coral_reef:   { water: 0x006994, ambient: 0x4488bb, bg: '#001a33' },
  deep_sea:     { water: 0x001133, ambient: 0x112244, bg: '#000511' },
  korean_river: { water: 0x3a6b3a, ambient: 0x557755, bg: '#0d1f0d' },
  amazon:       { water: 0x1a4a2e, ambient: 0x336644, bg: '#0a1a10' },
  space:        { water: 0x0d0d2b, ambient: 0x1a1a44, bg: '#000008' },
};

const FLOOR_Y = -3;
const TANK_HALF_X = 4.5;
const TANK_HALF_Z = 3.5;

// 플레이스홀더 물고기 색상 (수조에 물고기가 없을 때 / GLB 로드 전)
const DEFAULT_FISH_COLORS = [0xff6b35, 0xffd700, 0x4ecdc4, 0xff6b9d, 0x95e1d3];

export default function TankScene({
  environment, fish = [], decorations = [],
  onFishClick, decorationMode = false, selectedDecorationId = null,
  onDecorationSelect, onDecorationMove, style,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const waterRef = useRef<THREE.Mesh | null>(null);
  const fishMeshesRef = useRef<THREE.Object3D[]>([]);
  const fishDataRef = useRef<(Fish | null)[]>([]);
  const decoMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const decoHighlightRef = useRef<THREE.Mesh | null>(null);
  const rafRef = useRef(0);
  const clock = useRef(new THREE.Clock());
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggingDecoRef = useRef<{ id: string; offset: THREE.Vector3 } | null>(null);

  const { bindCanvas, apply, setEnabled } = useCameraControls(cameraRef);
  const env = ENV[environment];

  // 최신 값을 ref로 보관 (이벤트 핸들러 안에서 stale closure 방지)
  const fishRef = useRef<Fish[]>(fish);
  useEffect(() => { fishRef.current = fish; }, [fish]);
  const decorationsRef = useRef<TankDecoration[]>(decorations);
  useEffect(() => { decorationsRef.current = decorations; }, [decorations]);
  const decorationModeRef = useRef(decorationMode);
  useEffect(() => { decorationModeRef.current = decorationMode; }, [decorationMode]);
  const selectedDecoIdRef = useRef<string | null>(selectedDecorationId);
  useEffect(() => { selectedDecoIdRef.current = selectedDecorationId; }, [selectedDecorationId]);

  // GLB 로드 전 / speciesId 누락 시 사용할 플레이스홀더 메시 생성
  const buildPlaceholderMesh = useCallback((color: number, scale: number): THREE.Mesh => {
    const geo = new THREE.SphereGeometry(0.22, 8, 6);
    geo.scale(1.5, 0.7, 0.9);
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color, shininess: 80 }));
    mesh.scale.setScalar(scale);
    return mesh;
  }, []);

  const buildFishObject = useCallback(
    (index: number, speciesId: string | null, stageScale: number, fallbackColor: number): THREE.Group => {
      const wrapper = new THREE.Group();
      let inner: THREE.Object3D | null = null;
      let baseScale = 1;

      if (speciesId) {
        const modelClone = cloneFishModel(speciesId);
        const meta = getFishModel(speciesId);
        if (modelClone && meta) {
          inner = modelClone;
          baseScale = meta.baseScale;
        }
      }
      if (!inner) inner = buildPlaceholderMesh(fallbackColor, 1);
      wrapper.add(inner);
      wrapper.scale.setScalar(baseScale * stageScale);
      wrapper.position.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 6,
      );
      wrapper.userData.vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.008,
        (Math.random() - 0.5) * 0.02,
      );
      wrapper.userData.phase = Math.random() * Math.PI * 2;
      wrapper.userData.fishIndex = index;
      return wrapper;
    },
    [buildPlaceholderMesh],
  );

  const syncFishMeshes = useCallback((scene: THREE.Scene) => {
    const currentFish = fishRef.current;
    fishMeshesRef.current.forEach(m => scene.remove(m));
    fishMeshesRef.current = [];
    fishDataRef.current = [];

    if (currentFish.length > 0) {
      currentFish.forEach((f, i) => {
        const stageScale = STAGE_SCALE[f.growthStage] ?? 1;
        const obj = buildFishObject(i, f.speciesId, stageScale, 0xaaaaaa);
        obj.position.set(f.position.x, f.position.y, f.position.z);
        scene.add(obj);
        fishMeshesRef.current.push(obj);
        fishDataRef.current.push(f);
      });
    } else {
      DEFAULT_FISH_COLORS.forEach((color, i) => {
        const obj = buildFishObject(i, null, 1, color);
        scene.add(obj);
        fishMeshesRef.current.push(obj);
        fishDataRef.current.push(null);
      });
    }
  }, [buildFishObject]);

  // 데코레이션 메시 diff 동기화 (추가/제거/transform 업데이트)
  const syncDecorationMeshes = useCallback((scene: THREE.Scene) => {
    const current = decorationsRef.current;
    const currentIds = new Set(current.map(d => d.id));
    // 제거된 것 정리
    decoMeshesRef.current.forEach((mesh, id) => {
      if (!currentIds.has(id)) {
        scene.remove(mesh);
        decoMeshesRef.current.delete(id);
      }
    });
    // 추가/업데이트
    current.forEach(d => {
      let mesh = decoMeshesRef.current.get(d.id);
      if (!mesh) {
        const built = buildDecorationMesh(d.modelId);
        if (!built) return;
        built.userData.decoId = d.id;
        scene.add(built);
        decoMeshesRef.current.set(d.id, built);
        mesh = built;
      }
      mesh.position.set(d.position.x, d.position.y, d.position.z);
      mesh.rotation.set(d.rotation.x, d.rotation.y, d.rotation.z);
      mesh.scale.setScalar(d.scale);
    });
  }, []);

  // 선택된 데코 하이라이트 (바닥 원형 링)
  const syncHighlight = useCallback((scene: THREE.Scene) => {
    const id = selectedDecoIdRef.current;
    const mode = decorationModeRef.current;
    if (!decoHighlightRef.current) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x4dd0e1, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 32), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      scene.add(ring);
      decoHighlightRef.current = ring;
    }
    const ring = decoHighlightRef.current;
    if (!mode || !id) { ring.visible = false; return; }
    const mesh = decoMeshesRef.current.get(id);
    if (!mesh) { ring.visible = false; return; }
    ring.visible = true;
    ring.position.set(mesh.position.x, FLOOR_Y + 0.01, mesh.position.z);
  }, []);

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
    floor.position.y = FLOOR_Y;
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
    syncDecorationMeshes(scene);
    syncHighlight(scene);

    const ro = new ResizeObserver(() => {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      renderer.setSize(cw, ch);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
    });
    ro.observe(canvas);
    return ro;
  }, [apply, env, syncFishMeshes, syncDecorationMeshes, syncHighlight]);

  // fish prop 변경 시 메시 동기화
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    syncFishMeshes(scene);
  }, [fish, syncFishMeshes]);

  // decorations 변경 시 동기화
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    syncDecorationMeshes(scene);
    syncHighlight(scene);
  }, [decorations, syncDecorationMeshes, syncHighlight]);

  // 선택/모드 변경 → 하이라이트 갱신
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    syncHighlight(scene);
  }, [selectedDecorationId, decorationMode, syncHighlight]);

  // 마운트 시 GLB 프리로드 — 물고기/데코 병렬
  useEffect(() => {
    let cancelled = false;
    preloadFishModels().then(() => {
      if (cancelled) return;
      const scene = sceneRef.current;
      if (scene) syncFishMeshes(scene);
    });
    preloadDecorationModels().then(() => {
      if (cancelled) return;
      const scene = sceneRef.current;
      if (scene) syncDecorationMeshes(scene);
    });
    return () => { cancelled = true; };
  }, [syncFishMeshes, syncDecorationMeshes]);

  // 포인터 → NDC 좌표
  const updatePointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  }, []);

  // 바닥 평면(y = FLOOR_Y)에 raycast → world XZ
  const raycastFloor = useCallback((): THREE.Vector3 | null => {
    const camera = cameraRef.current;
    if (!camera) return null;
    raycasterRef.current.setFromCamera(pointerRef.current, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y);
    const hit = new THREE.Vector3();
    if (raycasterRef.current.ray.intersectPlane(plane, hit)) return hit;
    return null;
  }, []);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    clickStartRef.current = { x: e.clientX, y: e.clientY };

    // 데코 모드에서는 데코를 잡았는지 먼저 검사 → 잡았으면 카메라 잠금
    if (decorationModeRef.current) {
      updatePointer(e.clientX, e.clientY);
      const camera = cameraRef.current;
      if (!camera) return;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const decoArray = Array.from(decoMeshesRef.current.values());
      const hits = raycasterRef.current.intersectObjects(decoArray, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && obj.userData.decoId === undefined) obj = obj.parent;
        if (obj) {
          const id = obj.userData.decoId as string;
          const ground = raycastFloor();
          const offset = new THREE.Vector3();
          if (ground) offset.subVectors(obj.position, ground);
          draggingDecoRef.current = { id, offset };
          setEnabled(false);
        }
      }
    }
  }, [updatePointer, raycastFloor, setEnabled]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const drag = draggingDecoRef.current;
    if (!drag) return;
    updatePointer(e.clientX, e.clientY);
    const ground = raycastFloor();
    if (!ground) return;
    const mesh = decoMeshesRef.current.get(drag.id);
    if (!mesh) return;
    const x = THREE.MathUtils.clamp(ground.x + drag.offset.x, -TANK_HALF_X, TANK_HALF_X);
    const z = THREE.MathUtils.clamp(ground.z + drag.offset.z, -TANK_HALF_Z, TANK_HALF_Z);
    mesh.position.x = x;
    mesh.position.z = z;
    // 하이라이트 동기화
    if (decoHighlightRef.current && decoHighlightRef.current.visible) {
      decoHighlightRef.current.position.set(x, FLOOR_Y + 0.01, z);
    }
  }, [updatePointer, raycastFloor]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const drag = draggingDecoRef.current;
    if (drag) {
      // 드래그 종료 → 위치 커밋, 카메라 재활성
      const mesh = decoMeshesRef.current.get(drag.id);
      if (mesh && onDecorationMove) {
        onDecorationMove(drag.id, { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z });
      }
      draggingDecoRef.current = null;
      setEnabled(true);
      // 드래그한 데코를 선택 상태로
      if (onDecorationSelect && selectedDecoIdRef.current !== drag.id) {
        onDecorationSelect(drag.id);
      }
      clickStartRef.current = null;
      return;
    }

    // 일반 클릭/탭 처리
    if (!clickStartRef.current) return;
    const dx = e.clientX - clickStartRef.current.x;
    const dy = e.clientY - clickStartRef.current.y;
    clickStartRef.current = null;
    if (Math.sqrt(dx * dx + dy * dy) > 5) return;

    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!canvas || !camera || !scene) return;

    updatePointer(e.clientX, e.clientY);
    raycasterRef.current.setFromCamera(pointerRef.current, camera);

    if (decorationModeRef.current) {
      // 데코 모드: 데코 탭 → 선택 / 빈 곳 탭 → 선택 해제
      const decoArray = Array.from(decoMeshesRef.current.values());
      const decoHits = raycasterRef.current.intersectObjects(decoArray, true);
      if (decoHits.length > 0) {
        let obj: THREE.Object3D | null = decoHits[0].object;
        while (obj && obj.userData.decoId === undefined) obj = obj.parent;
        if (obj && onDecorationSelect) onDecorationSelect(obj.userData.decoId as string);
      } else {
        if (onDecorationSelect) onDecorationSelect(null);
      }
      return;
    }

    // 일반 모드: 물고기 클릭 처리
    if (!onFishClick) return;
    const hits = raycasterRef.current.intersectObjects(fishMeshesRef.current, true);
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && obj.userData.fishIndex === undefined) obj = obj.parent;
      if (obj) {
        const idx = obj.userData.fishIndex as number;
        const fishData = fishDataRef.current[idx];
        if (fishData) onFishClick(fishData);
      }
    }
  }, [onFishClick, onDecorationSelect, onDecorationMove, setEnabled, updatePointer]);

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
    // 선택 하이라이트 펄스
    if (decoHighlightRef.current && decoHighlightRef.current.visible) {
      const s = 1 + Math.sin(t * 4) * 0.1;
      decoHighlightRef.current.scale.setScalar(s);
    }
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
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      cleanup?.();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      rendererRef.current?.dispose();
    };
  }, [init, animate, bindCanvas, handlePointerDown, handlePointerMove, handlePointerUp]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', ...style }}
    />
  );
}
