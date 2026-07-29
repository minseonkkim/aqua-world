import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { createWaterMaterial } from './WaterShader';
import { useCameraControls } from '@/hooks/useCameraControls';
import { Fish, TankDecoration, TankEnvironment } from '@/types';
import { STAGE_SCALE } from '@/constants';
import { cloneFishModel, getFishModel, preloadFishModels } from '@/utils/fishModelLoader';
import { buildDecorationMesh, getDecorationMeta } from '@/utils/decorationModels';
import { preloadDecorationModels } from '@/utils/decorationModelLoader';
import { moodSpeedFactor, moodSinkBias } from '@/utils/mood';
import { isWebGLAvailable } from '@/utils/webglSupport';

export interface TankSceneHandle {
  /** 현재 프레임을 강제 렌더 후 PNG dataURL로 반환. 실패 시 null. */
  captureFrame: () => string | null;
  /** 수면 전체에 먹이를 흩뿌린다 — 먹이 버튼처럼 특정 지점 없이 급여할 때 사용 */
  sprinkleFood: () => void;
}

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
  /** 어항 조명(LED) ON 여부 — 켜면 위에서 따뜻한 빛이 내려오는 연출. 배경 밝기는 항상 낮 고정 */
  lightOn?: boolean;
  /** 수면 클릭 시 호출 — 일일 먹이 카운트 등 게임 로직에서 처리 */
  onSurfaceFeed?: (x: number, z: number) => boolean | void;
  /** 수조 확장 시각 배율 — 가로·세로(바닥 면적)를 확대. 기본 1 */
  tankScale?: number;
  /** true이면 렌더를 30fps로 throttle (모달/패널 오픈 등 가려진 상태에서 배터리 절약) */
  lowPower?: boolean;
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
const WATER_Y = 2.9;
// 기본 밝기 — 항상 낮 고정 (구 day 모드와 동일 값)
const AMBIENT_DAY = 0.63;
const SUN_DAY = 1.3;
// 어항 조명 — ON 시 수조 전체가 균일하게 환해진다 (따뜻한 ambient 글로우 + 기본 조명 부스트)
const LAMP_COLOR = 0xffe6b3;
const LAMP_GLOW_INTENSITY = 0.9;
const AMBIENT_LAMP_BOOST = 0.65;
const SUN_LAMP_BOOST = 1.0;
// 확장 레벨 1.0 기준(base) 수조 반경. 가로(X)·세로(Z)는 tankScale로 확대, 높이(Y)는 고정.
const BASE_HALF_X = 4.5;
const TANK_HALF_Y = 2.5;
const BASE_HALF_Z = 3.5;
// 유리 박스/바닥/수면 평면의 base 치수 (가로 X, 깊이 Z)
const BASE_BOX_W = 10;
const BASE_BOX_D = 8;
const BOX_H = 6;
const BUBBLE_COUNT = 35;
const FOOD_LIFETIME_MS = 8000;
// 저전력 모드 목표 프레임 간격 (≈30fps). 모달/패널로 수조가 가려질 때 렌더 빈도를 낮춰 배터리 절약
const LOW_POWER_FRAME_MS = 1000 / 30;

// ===== Boids 무리 행동 파라미터 =====
const BOID_PERCEPTION = 1.8;      // 같은 종 이웃 인지 반경 (정렬/응집)
const BOID_SEPARATION = 0.65;     // 충돌 회피 반경 (전 종)
const BOID_MAX_SPEED = 0.028;     // 프레임당 최대 이동량
const BOID_MIN_SPEED = 0.006;     // 정지 방지 최소 속도
const BOID_MAX_FORCE = 0.0016;    // 조향력 한계 (급회전 방지)
const BOID_W_ALIGN = 0.9;
const BOID_W_COHESION = 0.7;
const BOID_W_SEPARATION = 1.8;
const BOID_BOUND_FORCE = 0.0012;  // 벽 근처에서 중심 쪽으로 미는 힘
const BOID_BOUND_MARGIN = 0.7;    // 벽으로부터 이 거리 안에서 조향 시작

// 벡터 길이를 max로 제한 (in-place)
function limitVec(v: THREE.Vector3, max: number): THREE.Vector3 {
  const len = v.length();
  if (len > max && len > 0) v.multiplyScalar(max / len);
  return v;
}

// 조명 밝기 엔벨로프(0~1) — 켤 때는 형광등처럼 두 번 튀고 점등, 끌 때는 짧은 페이드아웃.
// elapsedMs=Infinity(초기 상태)면 목표값을 그대로 반환하므로 마운트 시 연출이 재생되지 않는다.
function lampEnvelope(on: boolean, elapsedMs: number): number {
  if (!on) return Math.max(0, 1 - elapsedMs / 150);
  if (elapsedMs < 70) return 0.4;
  if (elapsedMs < 130) return 0.05;
  if (elapsedMs < 220) return 0.75;
  if (elapsedMs < 290) return 0.15;
  return Math.min(1, 0.15 + ((elapsedMs - 290) / 160) * 0.85);
}

const LOADING_MESSAGES = [
  '🐠 물고기들 수조로 입장 중...',
  '🪸 산호 위치 잡는 중...',
  '🌊 물 온도 맞추는 중...',
  '💧 거품기 켜는 중...',
  '✨ 수조 광내는 중...',
  '🐚 조개껍데기 정리 중...',
  '🌿 수초 다듬는 중...',
  '🐟 물고기들 점호 중...',
];

/**
 * 3D 렌더링 실패 종류.
 * - unsupported: WebGL 자체를 못 씀 (미지원 기기 · 하드웨어 가속 off · 브라우저 차단) 또는 렌더러 생성 실패
 * - context-lost: 렌더 중 GPU 컨텍스트를 잃음 (백그라운드 복귀 · 메모리 부족 · 드라이버 리셋)
 */
type GlFailure = 'unsupported' | 'context-lost';

const GL_FAILURE_MESSAGE: Record<GlFailure, { icon: string; title: string; body: string }> = {
  unsupported: {
    icon: '🐟',
    title: '수조를 그릴 수 없어요',
    body: '이 기기에서 3D 그래픽(WebGL)을 사용할 수 없습니다.\n브라우저 설정에서 하드웨어 가속을 켜거나,\n최신 브라우저·기기에서 다시 시도해 주세요.',
  },
  'context-lost': {
    icon: '💤',
    title: '수조 연결이 끊겼어요',
    body: '그래픽 처리가 중단되었습니다.\n실행 중인 다른 앱을 정리한 뒤 다시 시도해 주세요.',
  },
};

interface BubbleData {
  speed: number;
  wobbleAmp: number;
  wobblePhase: number;
  baseX: number;
  baseZ: number;
}

interface FoodParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  bornAt: number;
  eaten: boolean;
}

// 먹이 알갱이는 개체별 차이가 없으므로 지오메트리/머티리얼을 모듈 단위로 공유한다
// (spawn마다 새로 만들면 dispose되지 않은 머티리얼이 급여 횟수만큼 쌓인다).
const FOOD_GEOMETRY = new THREE.SphereGeometry(0.06, 6, 6);
const FOOD_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xffa64d, emissive: 0x552200, roughness: 0.6,
});

function TankSceneImpl({
  environment, fish = [], decorations = [],
  onFishClick, decorationMode = false, selectedDecorationId = null,
  onDecorationSelect, onDecorationMove,
  lightOn = false, onSurfaceFeed, tankScale = 1, lowPower = false, style,
}: Props, ref: React.Ref<TankSceneHandle>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const waterRef = useRef<THREE.Mesh | null>(null);
  const fishMeshesRef = useRef<THREE.Object3D[]>([]);
  const fishDataRef = useRef<(Fish | null)[]>([]);
  // 물고기 id → 메시. syncFishMeshes에서 diff(추가/제거/스케일)에 사용 — 매 틱 전체 재생성 방지
  const fishMeshMapRef = useRef<Map<string, THREE.Group>>(new Map());
  const decoMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const decoHighlightRef = useRef<THREE.Mesh | null>(null);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const lampRef = useRef<THREE.AmbientLight | null>(null);
  const bubblesRef = useRef<THREE.Mesh[]>([]);
  const foodsRef = useRef<FoodParticle[]>([]);
  const rafRef = useRef(0);
  // 저전력 throttle — 최신 lowPower 값과 마지막 렌더 시각을 animate에서 참조
  const lowPowerRef = useRef(lowPower);
  const lastRenderRef = useRef(0);
  const clock = useRef(new THREE.Clock());
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggingDecoRef = useRef<{ id: string; offset: THREE.Vector3 } | null>(null);
  // 현재 tankScale 반영된 수영 경계 — animate/핸들러에서 항상 최신값 참조
  const boundsRef = useRef({ halfX: BASE_HALF_X * tankScale, halfZ: BASE_HALF_Z * tankScale });

  // 최신 lightOn/onSurfaceFeed를 ref로 보관 (animate/handler 안에서 최신 값 참조)
  // 토글 시각을 기록해 animate가 lampEnvelope로 점등/소등 연출을 재생한다.
  // 초기값 -Infinity → 마운트 시에는 연출 없이 현재 상태로 즉시 정착.
  const lampOnRef = useRef(lightOn);
  const lampChangedAtRef = useRef(-Infinity);
  useEffect(() => {
    if (lampOnRef.current === lightOn) return;
    lampOnRef.current = lightOn;
    lampChangedAtRef.current = performance.now();
  }, [lightOn]);
  const onSurfaceFeedRef = useRef(onSurfaceFeed);
  useEffect(() => { onSurfaceFeedRef.current = onSurfaceFeed; }, [onSurfaceFeed]);
  useEffect(() => { lowPowerRef.current = lowPower; }, [lowPower]);

  const { bindCanvas, apply, setEnabled, setFocusOffsetY, tickCamera } = useCameraControls(cameraRef);
  const env = ENV[environment];

  // 모델 프리로드 중 표시할 오버레이 — 마운트 시 한 번 랜덤 선택
  const [loading, setLoading] = useState(true);
  const loadingMsgRef = useRef(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);

  // WebGL 실패 상태. null 이 아니면 씬 초기화 이펙트가 통째로 건너뛰고 안내 UI가 뜬다.
  // null 로 되돌리는 것(다시 시도 · 컨텍스트 복구)이 곧 재초기화 트리거다.
  const [glFailure, setGlFailure] = useState<GlFailure | null>(null);
  // 캔버스 세대. "다시 시도"는 이 값을 올려 canvas 를 새 엘리먼트로 갈아끼운다 —
  // 컨텍스트를 잃은 캔버스는 브라우저가 복구 이벤트를 안 줄 수도 있어서, 같은 엘리먼트에
  // 렌더러만 다시 만들면 예외 없이 검은 화면만 나온다.
  const [canvasGen, setCanvasGen] = useState(0);
  const retryGl = useCallback(() => {
    setCanvasGen(g => g + 1);
    setGlFailure(null);
  }, []);

  // 최신 값을 ref로 보관 (이벤트 핸들러 안에서 stale closure 방지)
  const fishRef = useRef<Fish[]>(fish);
  useEffect(() => { fishRef.current = fish; }, [fish]);
  const decorationsRef = useRef<TankDecoration[]>(decorations);
  useEffect(() => { decorationsRef.current = decorations; }, [decorations]);
  const decorationModeRef = useRef(decorationMode);
  useEffect(() => { decorationModeRef.current = decorationMode; }, [decorationMode]);
  // 꾸미기 모드 진입 시 시점을 아래로 내려 바닥을 화면 중앙으로 끌어올린다 (하단 카탈로그 패널과 안 겹치게).
  // 종료 시 0으로 복귀 — tickCamera가 부드럽게 보간한다.
  useEffect(() => { setFocusOffsetY(decorationMode ? -1.8 : 0); }, [decorationMode, setFocusOffsetY]);
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
      let usedPlaceholder = true;

      if (speciesId) {
        const modelClone = cloneFishModel(speciesId);
        const meta = getFishModel(speciesId);
        if (modelClone && meta) {
          inner = modelClone;
          baseScale = meta.baseScale;
          usedPlaceholder = false;
        }
      }
      if (!inner) inner = buildPlaceholderMesh(fallbackColor, 1);
      wrapper.add(inner);
      wrapper.scale.setScalar(baseScale * stageScale);
      wrapper.position.set(
        (Math.random() - 0.5) * 2 * boundsRef.current.halfX,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 2 * boundsRef.current.halfZ,
      );
      wrapper.userData.vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.008,
        (Math.random() - 0.5) * 0.02,
      );
      wrapper.userData.phase = Math.random() * Math.PI * 2;
      wrapper.userData.fishIndex = index;
      wrapper.userData.speciesId = speciesId;
      // diff용 메타 — baseScale은 성장 단계 변경 시 재스케일에, usedPlaceholder는 모델 로드 후 교체 판단에 사용
      wrapper.userData.baseScale = baseScale;
      wrapper.userData.usedPlaceholder = usedPlaceholder;
      return wrapper;
    },
    [buildPlaceholderMesh],
  );

  // 물고기 메시 id 기반 diff 동기화 — 기존 물고기는 메시를 재사용(위치·속도 유지)하고
  // 추가/제거/성장 스케일·플레이스홀더 교체만 반영한다. (매 mood/청결도 틱마다 전체 재생성 방지)
  const syncFishMeshes = useCallback((scene: THREE.Scene) => {
    const currentFish = fishRef.current;
    const map = fishMeshMapRef.current;
    const currentIds = new Set(currentFish.map(f => f.id));

    // 제거된 물고기 정리 + StrictMode 재마운트 등으로 씬에서 떨어진 스테일 메시 폐기
    map.forEach((mesh, id) => {
      if (!currentIds.has(id) || mesh.parent !== scene) {
        scene.remove(mesh);
        map.delete(id);
      }
    });

    // fish 순서대로 병렬 배열 재구성 (animate/클릭 핸들러가 index로 참조)
    const meshes: THREE.Object3D[] = [];
    const data: (Fish | null)[] = [];

    currentFish.forEach((f, i) => {
      const stageScale = STAGE_SCALE[f.growthStage] ?? 1;
      let mesh = map.get(f.id);

      if (mesh) {
        // 모델 로드 전 플레이스홀더로 만들어졌고 이제 실제 GLB가 준비됐으면 → 위치·속도 유지하며 교체
        if (mesh.userData.usedPlaceholder && f.speciesId && getFishModel(f.speciesId)) {
          const old = mesh;
          mesh = buildFishObject(i, f.speciesId, stageScale, 0xaaaaaa);
          mesh.position.copy(old.position);
          mesh.rotation.copy(old.rotation);
          (mesh.userData.vel as THREE.Vector3).copy(old.userData.vel as THREE.Vector3);
          mesh.userData.phase = old.userData.phase;
          scene.remove(old);
          scene.add(mesh);
          map.set(f.id, mesh);
        } else {
          // 성장 단계 변경 시 스케일만 갱신 (위치·속도는 그대로)
          const baseScale = mesh.userData.baseScale as number;
          mesh.scale.setScalar(baseScale * stageScale);
        }
      } else {
        // 신규 물고기 — 스토어 위치에서 시작
        mesh = buildFishObject(i, f.speciesId, stageScale, 0xaaaaaa);
        mesh.position.set(f.position.x, f.position.y, f.position.z);
        scene.add(mesh);
        map.set(f.id, mesh);
      }

      mesh.userData.fishIndex = i;
      meshes.push(mesh);
      data.push(f);
    });

    fishMeshesRef.current = meshes;
    fishDataRef.current = data;
  }, [buildFishObject]);

  // 데코레이션 메시 diff 동기화 (추가/제거/transform 업데이트)
  const syncDecorationMeshes = useCallback((scene: THREE.Scene) => {
    const current = decorationsRef.current;
    const currentIds = new Set(current.map(d => d.id));
    console.log('[TankScene] sync deco — decorations:', current.length, 'meshes in map:', decoMeshesRef.current.size);
    // 제거된 것 정리 — 동시에 스테일 검사 (scene에 없으면 강제 재빌드 대상)
    decoMeshesRef.current.forEach((mesh, id) => {
      if (!currentIds.has(id)) {
        scene.remove(mesh);
        decoMeshesRef.current.delete(id);
        return;
      }
      // 메시가 현재 씬에 실제로 없으면 (StrictMode 재마운트 등으로 스테일) → 제거 후 재빌드 대상
      if (mesh.parent !== scene) {
        decoMeshesRef.current.delete(id);
        console.log('[TankScene] stale mesh removed for', id);
      }
    });
    // 추가/업데이트
    current.forEach(d => {
      let mesh = decoMeshesRef.current.get(d.id);
      if (!mesh) {
        const built = buildDecorationMesh(d.modelId);
        if (!built) return;
        built.userData.decoId = d.id;
        const meta = getDecorationMeta(d.modelId);
        built.userData.isPlant = meta?.type === 'plant';
        built.userData.swayPhase = Math.random() * Math.PI * 2;
        scene.add(built);
        decoMeshesRef.current.set(d.id, built);
        mesh = built;
        console.log('[TankScene] added new deco mesh', d.id, d.modelId, 'at', d.position);
      }
      mesh.position.set(d.position.x, d.position.y, d.position.z);
      // 기준 회전을 userData에 저장 — animate에서 sway는 base 위에 더해서 적용
      mesh.userData.baseRotation = { x: d.rotation.x, y: d.rotation.y, z: d.rotation.z };
      mesh.rotation.set(d.rotation.x, d.rotation.y, d.rotation.z);
      mesh.scale.setScalar(d.scale);
    });
  }, []);

  // 선택된 데코 하이라이트 (바닥 원형 링)
  const syncHighlight = useCallback((scene: THREE.Scene) => {
    const id = selectedDecoIdRef.current;
    const mode = decorationModeRef.current;
    // 씬이 재생성됐으면(컨텍스트 복구 등) 이전 씬에 붙어 있던 링은 버리고 새로 만든다
    if (decoHighlightRef.current && decoHighlightRef.current.parent !== scene) {
      decoHighlightRef.current = null;
    }
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

    // 확장 배율 반영 치수
    const s = tankScale;
    const boxW = BASE_BOX_W * s;
    const boxD = BASE_BOX_D * s;
    const halfX = BASE_HALF_X * s;
    const halfZ = BASE_HALF_Z * s;
    boundsRef.current = { halfX, halfZ };

    // 컨텍스트를 못 얻으면 여기서 throw 된다 — 호출부(마운트 이펙트)가 잡아 안내 UI로 전환한다.
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // 3번째 인자 false: canvas 인라인 px 스타일을 건드리지 않아 width/height:100% 반응형을 유지.
    // (true면 px가 고정돼 컨테이너가 커질 때 canvas가 안 따라와 검은 여백이 생김)
    renderer.setSize(w, h, false);
    renderer.setClearColor(new THREE.Color(env.bg), 1);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(new THREE.Color(env.bg), 0.05);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    // 수조가 커진 만큼 카메라를 뒤로 빼서 프레이밍 유지
    camera.position.set(0, 4 * s, 8 * s);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    apply();

    const ambient = new THREE.AmbientLight(env.ambient, AMBIENT_DAY);
    scene.add(ambient);
    ambientRef.current = ambient;
    const sun = new THREE.DirectionalLight(0xffffff, SUN_DAY);
    sun.position.set(5, 10, 5);
    scene.add(sun);
    sunRef.current = sun;
    const under = new THREE.PointLight(0x4488ff, 0.8, 15);
    under.position.set(0, -2, 0);
    scene.add(under);

    // 어항 조명 — 따뜻한 ambient 글로우. 강도는 animate가 lampEnvelope로 매 프레임 갱신
    // (점등 깜빡임 연출 포함). ambient라 수조 전체가 균일하게 밝아진다
    const lamp = new THREE.AmbientLight(LAMP_COLOR, 0);
    scene.add(lamp);
    lampRef.current = lamp;

    // 수조 유리
    scene.add(new THREE.Mesh(
      new THREE.BoxGeometry(boxW, BOX_H, boxD),
      new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.06, roughness: 0, side: THREE.BackSide }),
    ));

    // 바닥
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(boxW, boxD),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    scene.add(floor);

    // 수면
    const waterMat = createWaterMaterial();
    (waterMat.uniforms.uWaterColor.value as THREE.Color).set(env.water);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(boxW, boxD, 32, 32), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 2.9;
    scene.add(water);
    waterRef.current = water;

    // 자갈 — 바닥 면적에 맞춰 분포
    for (let i = 0; i < 60; i++) {
      const g = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 + Math.random() * 0.08, 4, 4),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.08, 0.3 + Math.random() * 0.3, 0.3 + Math.random() * 0.2),
          roughness: 0.9,
        }),
      );
      g.position.set((Math.random() - 0.5) * (boxW - 1), -2.95, (Math.random() - 0.5) * (boxD - 1));
      scene.add(g);
    }

    // 거품 파티클 풀 — 환경에 따라 살짝 색조 변경
    const bubbleColor = new THREE.Color(env.water).lerp(new THREE.Color(0xffffff), 0.6);
    const bubbleMat = new THREE.MeshBasicMaterial({
      color: bubbleColor, transparent: true, opacity: 0.35,
    });
    bubblesRef.current.forEach(b => scene.remove(b));
    bubblesRef.current = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const size = 0.04 + Math.random() * 0.06;
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(size, 6, 6),
        bubbleMat,
      );
      const baseX = (Math.random() - 0.5) * 2 * halfX;
      const baseZ = (Math.random() - 0.5) * 2 * halfZ;
      b.position.set(baseX, FLOOR_Y + Math.random() * (WATER_Y - FLOOR_Y), baseZ);
      b.userData.bubble = {
        speed: 0.4 + Math.random() * 0.6,
        wobbleAmp: 0.05 + Math.random() * 0.08,
        wobblePhase: Math.random() * Math.PI * 2,
        baseX, baseZ,
      } satisfies BubbleData;
      scene.add(b);
      bubblesRef.current.push(b);
    }

    syncFishMeshes(scene);
    syncDecorationMeshes(scene);
    syncHighlight(scene);

    const ro = new ResizeObserver(() => {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (cw === 0 || ch === 0) return;
      renderer.setSize(cw, ch, false); // 인라인 스타일 유지(위 init 주석 참고) — 드로잉 버퍼만 갱신
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
    });
    ro.observe(canvas);
    return ro;
  }, [apply, env, tankScale, syncFishMeshes, syncDecorationMeshes, syncHighlight]);

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

  // 마운트 시 GLB 프리로드 — 물고기/데코 병렬, 둘 다 끝나면 로딩 오버레이 숨김
  useEffect(() => {
    let cancelled = false;
    const fishLoad = preloadFishModels().then(() => {
      if (cancelled) return;
      const scene = sceneRef.current;
      if (scene) syncFishMeshes(scene);
    });
    const decoLoad = preloadDecorationModels().then(() => {
      if (cancelled) return;
      const scene = sceneRef.current;
      if (!scene) return;
      // 로딩 전에 플레이스홀더로 추가된 데코들을 실제 GLB로 재빌드
      decoMeshesRef.current.forEach((mesh) => scene.remove(mesh));
      decoMeshesRef.current.clear();
      syncDecorationMeshes(scene);
    });
    Promise.all([fishLoad, decoLoad]).then(() => {
      if (!cancelled) setLoading(false);
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

  // 수면 클릭 시 떨어지는 먹이 파티클 spawn (x,z는 월드 좌표)
  const spawnFoodParticles = useCallback((x: number, z: number) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const count = 4 + Math.floor(Math.random() * 3); // 4~6개
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(FOOD_GEOMETRY, FOOD_MATERIAL);
      const jitterX = (Math.random() - 0.5) * 0.4;
      const jitterZ = (Math.random() - 0.5) * 0.4;
      mesh.position.set(
        THREE.MathUtils.clamp(x + jitterX, -boundsRef.current.halfX, boundsRef.current.halfX),
        WATER_Y - 0.05,
        THREE.MathUtils.clamp(z + jitterZ, -boundsRef.current.halfZ, boundsRef.current.halfZ),
      );
      scene.add(mesh);
      foodsRef.current.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          -0.02 - Math.random() * 0.01,
          (Math.random() - 0.5) * 0.01,
        ),
        bornAt: performance.now(),
        eaten: false,
      });
    }
  }, []);

  // 부모에서 호출 가능한 명령들.
  // captureFrame: preserveDrawingBuffer 없이도 같은 task에서 render+toDataURL 연속 호출 시 동작.
  // sprinkleFood: 먹이 버튼처럼 지점이 없는 급여 — 수면 가로 방향으로 고르게 나눠 여러 무리를 뿌려
  //               수조 어디에 있는 물고기든 추적 반경(2.2) 안에 먹이가 들어오게 한다.
  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const canvas = canvasRef.current;
      if (!renderer || !scene || !camera || !canvas) return null;
      renderer.render(scene, camera);
      return canvas.toDataURL('image/png');
    },
    sprinkleFood: () => {
      const { halfX, halfZ } = boundsRef.current;
      const clusters = 5;
      for (let i = 0; i < clusters; i++) {
        const x = (-1 + ((i + 0.5) / clusters) * 2) * halfX * 0.85;
        const z = (Math.random() - 0.5) * halfZ * 1.4;
        spawnFoodParticles(x, z);
      }
    },
  }), [spawnFoodParticles]);

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
    const x = THREE.MathUtils.clamp(ground.x + drag.offset.x, -boundsRef.current.halfX, boundsRef.current.halfX);
    const z = THREE.MathUtils.clamp(ground.z + drag.offset.z, -boundsRef.current.halfZ, boundsRef.current.halfZ);
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

    // 일반 모드: 물고기 클릭 우선 → 미적중이면 수면 클릭 (먹이 뿌리기)
    const fishHits = raycasterRef.current.intersectObjects(fishMeshesRef.current, true);
    if (fishHits.length > 0) {
      let obj: THREE.Object3D | null = fishHits[0].object;
      while (obj && obj.userData.fishIndex === undefined) obj = obj.parent;
      if (obj) {
        const idx = obj.userData.fishIndex as number;
        const fishData = fishDataRef.current[idx];
        if (fishData && onFishClick) onFishClick(fishData);
        return;
      }
    }
    // 수면 raycast — 클릭 위치가 수면에 닿았는지 확인
    if (waterRef.current) {
      const waterHits = raycasterRef.current.intersectObject(waterRef.current, false);
      if (waterHits.length > 0) {
        const p = waterHits[0].point;
        const accepted = onSurfaceFeedRef.current?.(p.x, p.z);
        // 콜백이 명시적으로 false를 반환하면 파티클 생략 (일일 한도 초과 등)
        if (accepted !== false) {
          spawnFoodParticles(p.x, p.z);
        }
      }
    }
  }, [onFishClick, onDecorationSelect, onDecorationMove, setEnabled, updatePointer, spawnFoodParticles]);

  const animate = useCallback(() => {
    rafRef.current = requestAnimationFrame(animate);
    // 저전력 모드: 30fps로 throttle. getDelta 호출 전에 건너뛰어야 dt가 누적되고,
    // animate의 delta-time 정규화(k)가 이를 보상해 물고기 속도가 그대로 유지된다.
    if (lowPowerRef.current) {
      const nowMs = performance.now();
      if (nowMs - lastRenderRef.current < LOW_POWER_FRAME_MS) return;
      lastRenderRef.current = nowMs;
    }
    // delta-time 정규화 — 60fps 기준(k=1). 기기·빌드별 FPS 차이로
    // 물고기 속도가 달라지지 않도록 모든 프레임 단위 이동을 k로 스케일한다.
    const dt = clock.current.getDelta();
    const t = clock.current.elapsedTime;
    const k = Math.min(dt * 60, 3); // 백그라운드 복귀 등 큰 끊김 시 순간이동 방지 상한
    const now = performance.now();
    if (waterRef.current) {
      (waterRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    }

    // 먹이 파티클: 떨어짐 + 물고기 접근 검출
    const foods = foodsRef.current;
    if (foods.length > 0) {
      const scene = sceneRef.current;
      for (let i = foods.length - 1; i >= 0; i--) {
        const fp = foods[i];
        if (fp.eaten) continue;
        fp.mesh.position.addScaledVector(fp.vel, k);
        // 물 저항 — y vel 점진 가속
        fp.vel.y = Math.max(fp.vel.y - 0.0003 * k, -0.05);
        // 바닥/수명 도달 → 제거
        if (fp.mesh.position.y < FLOOR_Y + 0.1 || now - fp.bornAt > FOOD_LIFETIME_MS) {
          scene?.remove(fp.mesh);
          foods.splice(i, 1);
        }
      }
    }

    // ===== Boids 무리 행동 + 먹이 추적 =====
    // 프레임당 한 번만 생성하는 스크래치 벡터 (GC 부담 최소화)
    const align = new THREE.Vector3();
    const cohesion = new THREE.Vector3();
    const separation = new THREE.Vector3();
    const accel = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const meshes = fishMeshesRef.current;

    for (let i = 0; i < meshes.length; i++) {
      const f = meshes[i];
      const vel = f.userData.vel as THREE.Vector3;
      const speciesId = f.userData.speciesId as string | null;

      // mood 가중치 — happy는 빠르고 활발, bored는 느리고 바닥으로 가라앉음
      const fishMood = fishDataRef.current[i]?.mood ?? 'normal';
      const speedScale = moodSpeedFactor(fishMood);
      const maxSpeed = BOID_MAX_SPEED * speedScale;
      const minSpeed = BOID_MIN_SPEED * speedScale;
      const sinkBias = moodSinkBias(fishMood);

      // 1) 가까운 먹이 추적 — 있으면 무리 행동보다 우선 (먹이 앞에선 mood 무시, 항상 최대 가속)
      let nearestFood: FoodParticle | null = null;
      let nearestDist = 2.2;
      for (const fp of foods) {
        if (fp.eaten) continue;
        const d = fp.mesh.position.distanceTo(f.position);
        if (d < nearestDist) { nearestDist = d; nearestFood = fp; }
      }

      if (nearestFood) {
        tmp.copy(nearestFood.mesh.position).sub(f.position).normalize().multiplyScalar(BOID_MAX_SPEED);
        vel.lerp(tmp, 1 - Math.pow(1 - 0.18, k));
        if (nearestDist < 0.25) {
          nearestFood.eaten = true;
          sceneRef.current?.remove(nearestFood.mesh);
          const idx = foods.indexOf(nearestFood);
          if (idx >= 0) foods.splice(idx, 1);
        }
      } else {
        // 2) Boids 3원칙 — 같은 종끼리 정렬·응집, 모든 종과 분리
        align.set(0, 0, 0);
        cohesion.set(0, 0, 0);
        separation.set(0, 0, 0);
        accel.set(0, 0, 0);
        let flockCount = 0;
        let sepCount = 0;
        for (let j = 0; j < meshes.length; j++) {
          if (j === i) continue;
          const o = meshes[j];
          const d = f.position.distanceTo(o.position);
          if (d < 1e-4) continue;
          if (d < BOID_SEPARATION) {
            // 거리 제곱 반비례로 가까울수록 강하게 밀어냄
            tmp.copy(f.position).sub(o.position).divideScalar(d * d);
            separation.add(tmp);
            sepCount++;
          }
          if (d < BOID_PERCEPTION && o.userData.speciesId === speciesId) {
            align.add(o.userData.vel as THREE.Vector3);
            cohesion.add(o.position);
            flockCount++;
          }
        }

        if (flockCount > 0) {
          // 정렬: 이웃 평균 속도 방향으로
          align.divideScalar(flockCount).normalize().multiplyScalar(maxSpeed).sub(vel);
          accel.addScaledVector(limitVec(align, BOID_MAX_FORCE), BOID_W_ALIGN);
          // 응집: 이웃 무게중심 쪽으로
          cohesion.divideScalar(flockCount).sub(f.position).normalize().multiplyScalar(maxSpeed).sub(vel);
          accel.addScaledVector(limitVec(cohesion, BOID_MAX_FORCE), BOID_W_COHESION);
        }
        if (sepCount > 0) {
          separation.divideScalar(sepCount).normalize().multiplyScalar(maxSpeed).sub(vel);
          accel.addScaledVector(limitVec(separation, BOID_MAX_FORCE), BOID_W_SEPARATION);
        }
        // bored 물고기는 천천히 바닥으로 가라앉음
        if (sinkBias !== 0) vel.y += sinkBias * k;
        vel.addScaledVector(accel, k);
      }

      // 3) 경계 회피 — 벽 근처에서 중심 쪽으로 부드럽게 조향
      const m = BOID_BOUND_MARGIN;
      const halfX = boundsRef.current.halfX;
      const halfZ = boundsRef.current.halfZ;
      if (f.position.x >  halfX - m) vel.x -= BOID_BOUND_FORCE * k;
      else if (f.position.x < -halfX + m) vel.x += BOID_BOUND_FORCE * k;
      if (f.position.y >  TANK_HALF_Y - m) vel.y -= BOID_BOUND_FORCE * k;
      else if (f.position.y < -TANK_HALF_Y + m) vel.y += BOID_BOUND_FORCE * k;
      if (f.position.z >  halfZ - m) vel.z -= BOID_BOUND_FORCE * k;
      else if (f.position.z < -halfZ + m) vel.z += BOID_BOUND_FORCE * k;

      // 4) 속도 제한 (mood 가중치 반영)
      const speed = vel.length();
      if (speed > maxSpeed) vel.multiplyScalar(maxSpeed / speed);
      else if (speed > 1e-5 && speed < minSpeed) vel.multiplyScalar(minSpeed / speed);

      // 5) 위치 갱신 + 수직 미세 흔들림
      f.position.x += vel.x * k;
      f.position.y += (vel.y + Math.sin(t * 1.5 + f.userData.phase) * 0.002) * k;
      f.position.z += vel.z * k;

      // 6) 하드 클램프 — 수조 밖 이탈 방지 (안전망)
      f.position.x = THREE.MathUtils.clamp(f.position.x, -halfX, halfX);
      f.position.y = THREE.MathUtils.clamp(f.position.y, -TANK_HALF_Y, TANK_HALF_Y);
      f.position.z = THREE.MathUtils.clamp(f.position.z, -halfZ, halfZ);

      // 7) 진행 방향으로 부드럽게 회전 (최단 각도 보간)
      if (vel.lengthSq() > 1e-6) {
        const targetYaw = Math.atan2(vel.x, vel.z);
        let delta = targetYaw - f.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        f.rotation.y += delta * (1 - Math.pow(1 - 0.12, k));
      }
    }

    // 거품 상승 + 좌우 흔들림 + 수면 도달 시 리셋
    bubblesRef.current.forEach(b => {
      const d = b.userData.bubble as BubbleData;
      b.position.y += 0.008 * d.speed * k;
      b.position.x = d.baseX + Math.sin(t * 1.5 + d.wobblePhase) * d.wobbleAmp;
      b.position.z = d.baseZ + Math.cos(t * 1.2 + d.wobblePhase) * d.wobbleAmp * 0.6;
      if (b.position.y > WATER_Y - 0.05) {
        const baseX = (Math.random() - 0.5) * 2 * boundsRef.current.halfX;
        const baseZ = (Math.random() - 0.5) * 2 * boundsRef.current.halfZ;
        d.baseX = baseX;
        d.baseZ = baseZ;
        d.wobblePhase = Math.random() * Math.PI * 2;
        b.position.set(baseX, FLOOR_Y + 0.05, baseZ);
      }
    });

    // 수초 흔들림 — type='plant' 데코만
    decoMeshesRef.current.forEach(mesh => {
      if (!mesh.userData.isPlant) return;
      const base = mesh.userData.baseRotation as { x: number; y: number; z: number } | undefined;
      if (!base) return;
      const phase = mesh.userData.swayPhase as number;
      const sway = Math.sin(t * 1.2 + phase) * 0.09;
      mesh.rotation.x = base.x + sway * 0.5;
      mesh.rotation.z = base.z + sway;
    });

    // 어항 조명 — 점등/소등 연출. 정착 후에도 상수 대입뿐이라 per-frame 비용은 무시 가능
    const lamp = lampRef.current;
    if (lamp) {
      const f = lampEnvelope(lampOnRef.current, now - lampChangedAtRef.current);
      lamp.intensity = LAMP_GLOW_INTENSITY * f;
      if (ambientRef.current) ambientRef.current.intensity = AMBIENT_DAY + AMBIENT_LAMP_BOOST * f;
      if (sunRef.current) sunRef.current.intensity = SUN_DAY + SUN_LAMP_BOOST * f;
    }

    // 선택 하이라이트 펄스
    if (decoHighlightRef.current && decoHighlightRef.current.visible) {
      const s = 1 + Math.sin(t * 4) * 0.1;
      decoHighlightRef.current.scale.setScalar(s);
    }
    // 꾸미기 모드 시점 전환 보간 (목표 도달 후엔 내부에서 no-op)
    tickCamera(k);
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [tickCamera]);

  // 컨텍스트 손실/복구 감시 — 초기화 성공 여부와 무관하게 캔버스가 살아 있는 동안 계속 붙어 있어야
  // 하므로 아래 초기화 이펙트와 분리한다 (초기화 쪽은 glFailure 가 세팅되면 조기 반환한다).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleContextLost = (e: Event) => {
      // preventDefault 를 해야 브라우저가 컨텍스트 복구(webglcontextrestored)를 시도한다.
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
      console.warn('[TankScene] WebGL 컨텍스트 손실 — 렌더 중단');
      setGlFailure('context-lost');
    };
    // 복구되면 실패 상태를 풀어 초기화 이펙트가 씬을 다시 세우게 한다 (GPU 리소스는 전부 날아간 상태).
    const handleContextRestored = () => {
      console.info('[TankScene] WebGL 컨텍스트 복구 — 씬 재구성');
      setGlFailure(null);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [canvasGen]); // 캔버스가 교체되면 새 엘리먼트에 다시 붙는다

  useEffect(() => {
    // 실패 상태에서는 씬을 세우지 않는다. glFailure 가 null 로 바뀌면 이 이펙트가 다시 돌며 재초기화.
    if (glFailure) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 렌더러 생성 전에 지원 여부부터 확인 — 미지원 환경에서 three 내부 throw 대신 안내 UI로 분기
    if (!isWebGLAvailable()) {
      console.warn('[TankScene] WebGL 미지원 환경');
      setGlFailure('unsupported');
      return;
    }

    let ro: ResizeObserver;
    try {
      ro = init(canvas);
    } catch (err) {
      // 지원 감지는 통과했지만 실제 렌더러 생성이 실패한 경우 (컨텍스트 한도 초과 · 드라이버 문제 등)
      console.error('[TankScene] WebGL 렌더러 초기화 실패', err);
      rendererRef.current?.dispose();
      rendererRef.current = null;
      setGlFailure('unsupported');
      return;
    }

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
      // 거품/먹이 파티클 정리 — 먹이는 모듈 공유 geometry/material 이라 참조만 끊는다
      foodsRef.current = [];
      bubblesRef.current.forEach(b => b.geometry.dispose());
      bubblesRef.current = [];
      rendererRef.current?.dispose();
      // 죽은 렌더러로 captureFrame 이 호출되지 않도록 참조를 끊는다
      rendererRef.current = null;
    };
  }, [glFailure, init, animate, bindCanvas, handlePointerDown, handlePointerMove, handlePointerUp]);

  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <canvas
        key={canvasGen}
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
      />
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          background: `linear-gradient(180deg, ${env.bg} 0%, #000 100%)`,
          color: '#fff', fontSize: 15, fontWeight: 500,
          opacity: loading && !glFailure ? 1 : 0,
          pointerEvents: loading && !glFailure ? 'auto' : 'none',
          transition: 'opacity 600ms ease',
        }}
      >
        <div
          style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.15)',
            borderTopColor: '#4dd0e1',
            animation: 'tankscene-spin 0.9s linear infinite',
          }}
        />
        <div style={{ opacity: 0.9, letterSpacing: 0.3 }}>{loadingMsgRef.current}</div>
        <style>{`@keyframes tankscene-spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* WebGL 미지원 / 컨텍스트 손실 안내 — 검은 화면 대신 원인과 다음 행동을 보여준다 */}
      {glFailure && (
        <div
          role="alert"
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            padding: '0 32px', textAlign: 'center',
            background: `linear-gradient(180deg, ${env.bg} 0%, #000 100%)`,
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 44, lineHeight: 1 }}>{GL_FAILURE_MESSAGE[glFailure].icon}</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{GL_FAILURE_MESSAGE[glFailure].title}</div>
          <div style={{
            fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-line',
            color: 'var(--color-text-secondary)',
          }}>
            {GL_FAILURE_MESSAGE[glFailure].body}
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 8, padding: '12px 28px', fontSize: 15 }}
            onClick={retryGl}
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}

const TankScene = forwardRef<TankSceneHandle, Props>(TankSceneImpl);
export default TankScene;
