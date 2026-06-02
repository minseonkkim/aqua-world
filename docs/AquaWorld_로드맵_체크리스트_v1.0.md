# AquaWorld — 개발 로드맵 체크리스트

> **전체 기간:** 12개월 (Phase 0 ~ Phase 7)
> **기준 문서:** AquaWorld 기획서 v1.0
> **플랫폼:** React + Vite + PWA + **Capacitor 네이티브 래퍼** (Android / iOS / Desktop Web)
> **최종 업데이트:** 2026년 6월 — Capacitor 네이티브 전환 반영

---

## 범례

| 기호  | 의미                         |
| :---: | ---------------------------- |
| `[ ]` | 미완료                       |
| `[x]` | 완료                         |
| `[-]` | 진행 중                      |
| `[!]` | 블로커 / 이슈 발생           |
|  🔴   | 높은 우선순위 / 크리티컬     |
|  🟡   | 중간 우선순위                |
|  🟢   | 낮은 우선순위 / 나이스투해브 |

---

## Phase 0 — 기획·디자인

**기간:** 1개월 | **담당:** PM, 디자이너, 3D 아티스트

### 0-1. 기획 확정

- [ ] 🔴 기획서 v1.0 전 팀원 리뷰 및 서명
- [ ] 🔴 기능 우선순위 매트릭스 최종 확정 (MVP / V1.1 / V1.2 / V2.0)
- [ ] 🔴 팀 구성 완료 (PM 1, React 개발 2, Three.js 개발 1, 백엔드 1, 디자이너 1, 3D 아티스트 1, QA 파트타임 1)
- [ ] 🔴 협업 툴 세팅 (Notion, Jira/Linear, Figma, GitHub, Slack)
- [ ] 🔴 스프린트 사이클 정의 (2주 단위 권장)
- [ ] 🟡 경쟁 앱 심층 분석 보고서 작성 (AbyssRium, Tap Tap Fish 등)
- [ ] 🟡 게임 경제 밸런스 초안 확정 (Pearl · Star Coral 수급량, 가격 구조)
- [ ] 🟡 정식 앱 이름 후보 3개 이상 확보, 상표 조회
- [ ] 🟢 사전 예약 랜딩 페이지 도메인 등록

### 0-2. 와이어프레임

- [ ] 🔴 11개 핵심 화면 와이어프레임 완성
  - [ ] 온보딩 (3페이지)
  - [ ] 로그인 / 회원가입
  - [ ] 메인 수조 화면 (홈)
  - [ ] 물고기 도감
  - [ ] 꾸미기 모드
  - [ ] 상점 (알 / 아이템 / 재화 패키지)
  - [ ] 포토 모드
  - [ ] 이벤트 / 시즌 패스
  - [ ] 설정
  - [ ] 친구 목록 (V1.1 선반영)
  - [ ] 친구 수조 방문 (V1.1 선반영)
- [ ] 🔴 핵심 사용자 흐름 다이어그램 3종 완성
  - [ ] Flow 1 — 신규 사용자 온보딩 흐름
  - [ ] Flow 2 — 일일 재방문 사용자 흐름
  - [ ] Flow 3 — 결제 전환 흐름
- [ ] 🟡 엣지 케이스 화면 와이어프레임 (오류, 빈 상태, 로딩 상태)

### 0-3. UI/UX 디자인

- [ ] 🔴 디자인 시스템 구축
  - [ ] 컬러 팔레트 (Primary, Secondary, Accent, Neutral, Semantic)
  - [ ] 타이포그래피 가이드 (폰트, 크기 체계)
  - [ ] 아이콘 세트 정의 (최소 40종)
  - [ ] 공통 컴포넌트 라이브러리 (버튼, 카드, 모달, 탭 바)
  - [ ] 여백·그리드 시스템 (8px 기반)
- [ ] 🔴 핵심 5개 화면 고해상도 디자인 완성
  - [ ] 메인 수조 화면
  - [ ] 온보딩
  - [ ] 상점
  - [ ] 도감
  - [ ] 꾸미기 모드
- [ ] 🔴 Figma 인터랙티브 프로토타입 제작 (메인 플로우)
- [ ] 🟡 나머지 6개 화면 디자인 완성
- [ ] 🟡 다크 모드 대응 여부 결정 및 디자인 반영 (기본: 다크 모드)
- [ ] 🟡 모션·인터랙션 가이드라인 문서화 (전환 효과, 애니메이션 속도)
- [ ] 🟢 접근성 가이드라인 검토 (색각 이상 대응, 최소 터치 영역 44px)

### 0-4. 3D 아트 컨셉

- [ ] 🔴 물고기 캐릭터 컨셉 아트 완성 (MVP 10종)
  - [ ] 커먼 5종 (클라운피시, 구피, 금붕어, 해마, 제브라피시 등)
  - [ ] 레어 3종
  - [ ] 에픽 1종
  - [ ] 레전더리 1종
- [ ] 🔴 수조 환경 컨셉 아트 완성 (MVP 5종)
  - [ ] 산호초
  - [ ] 심해
  - [ ] 한국 강
  - [ ] 아마존
  - [ ] 우주
- [ ] 🔴 3D 스타일 가이드 확정 (폴리곤 수 기준, 텍스처 해상도, 라이팅 스타일)
- [ ] 🟡 꾸미기 오브젝트 컨셉 아트 (수초 8종, 바위 6종, 유목 4종, 장식 8종)
- [ ] 🟡 UI 이모티콘·아이콘 일러스트 스타일 정의
- [ ] 🟡 BGM·효과음 스타일 레퍼런스 수집 (ASMR, 국악/뉴에이지 방향성 확정)
- [ ] 🟢 IP 확장 가능성을 고려한 캐릭터 스타일 가이드 초안

---

## Phase 1 — 기술 검증 (PoC)

**기간:** 0.5개월 (약 2주) | **담당:** Three.js 개발, React 개발, 백엔드

### 1-1. 개발 환경 세팅

- [x] 🔴 React + Vite PWA 프로젝트 초기화
- [x] 🔴 Three.js 설치 및 최초 WebGLRenderer 렌더링 확인
- [x] 🔴 GitHub 저장소 구성 (브랜치 전략, PR 템플릿)
- [x] 🟡 ESLint, Prettier, TypeScript strict 설정
- [x] 🟡 CI/CD 파이프라인 초안 (GitHub Actions + Vite Build)
- [x] 🟡 Zustand v5 상태 관리 도입
- [x] 🟡 React Router v6 HashRouter 라우팅 구성
- [x] 🟡 CSS 변수 기반 디자인 시스템 (global.css)
- [x] 🔴 PWA manifest + 서비스워커 (vite-plugin-pwa / Workbox) 정상 동작 확인 (registerType:prompt, manifest scope/lang/categories, glb precache, navigateFallback, cleanupOutdatedCaches)
- [ ] 🔴 iOS Safari / Android Chrome 브라우저 호환성 확인 (실기기 시연 미수행)

### 1-2. 3D 렌더링 PoC

- [x] 🔴 3D 수조 씬 기본 렌더링 구현 (평면, 조명, 카메라)
- [x] 🔴 물고기 더미 모델(GLB) 임포트 및 애니메이션 재생 확인 (절차적 생성 GLB 10종 임포트 동작, 실 아티스트 GLB로 추후 교체 가능)
- [x] 🔴 자유 카메라 컨트롤 구현 (DOM 이벤트 기반)
  - [x] 마우스 드래그 / 터치 드래그 회전
  - [x] 마우스 휠 / 핀치 줌인/줌아웃
  - [x] 더블클릭 / 더블탭 시점 리셋
  - [x] 꾸미기 모드 진입 시 카메라 잠금/재개 (`setEnabled`)
- [x] 🔴 기초 물 셰이더 구현 (물결, 투명도, 코스틱스 shimmer)
- [x] 🟡 ResizeObserver 기반 캔버스 반응형 리사이즈
- [x] 🟡 Boids 알고리즘 기초 프로토타입 (Phase 2에서 완전 Boids로 고도화 완료)
- [ ] 🟡 파티클 시스템 기초 (거품 효과)

### 1-3. 성능 벤치마크

- [ ] 🔴 저사양 모바일 기기 테스트 (Android 8+, iOS 14+ Safari)
  - [ ] 목표: 30fps 이상 안정 유지
  - [ ] 배터리 소모율 측정 (30분 사용 기준)
- [ ] 🔴 중급 기기 테스트 (iPhone 12 / Galaxy S21 기준)
  - [ ] 목표: 60fps 안정 유지
- [ ] 🔴 물고기 동시 렌더링 수 한계 테스트 (최소 20마리)
- [ ] 🔴 메모리 누수 기초 확인 (장시간 실행 시 메모리 증가 여부)
- [ ] 🟡 페이지 FCP / LCP 측정 (목표: FCP 2초 이내)
- [ ] 🔴 **PoC 결과 리포트 작성 및 팀 공유** — Go/No-Go 의사결정

### 1-4. Firebase 연동 기초 확인

- [x] 🔴 Firebase 프로젝트 생성 (Web 앱 등록)
- [x] 🔴 Firebase Authentication 기초 연동 (Google 소셜 로그인으로 동작 검증)
- [x] 🔴 Firestore 기본 CRUD 동작 확인 (users/tanks 컬렉션 read/write)
- [x] 🟡 Firebase SDK 설치 및 config 파일 생성 (.env.example 포함)
- [ ] 🟡 Firebase Storage 파일 업로드/다운로드 테스트 (init만 완료, 실제 업/다운로드 미구현)
- [ ] 🟢 Firebase Emulator Suite 로컬 환경 세팅

---

## Phase 2 — MVP 개발

**기간:** 2.5개월 (약 10주) | **담당:** 전 팀

### 2-1. 프로젝트 기반 (Week 1~2)

- [x] 🔴 앱 아키텍처 최종 결정 및 문서화 (React + Vite PWA)
- [x] 🔴 폴더 구조 설계 (pages, components, hooks, store, services, types, constants)
- [x] 🔴 상태 관리 (Zustand v5) 도입 및 핵심 스토어 구현
  - [x] useUserStore (재화, 레벨, 먹이, 출석)
  - [x] useFishStore (어종 데이터)
  - [x] useTankStore (수조 관리)
- [x] 🔴 디자인 시스템 CSS 컴포넌트화
  - [x] Button (.btn, .btn-primary)
  - [x] Card (.card)
  - [x] Tab Bar (.tab-bar, .tab-item)
  - [x] Toast 알림 (인라인 컴포넌트)
  - [x] Currency Pill (.currency-pill)
- [-] 🔴 Firebase 풀 연동
  - [x] Firebase Auth (소셜 로그인)
    - [x] Google Sign In
    - [x] 카카오 로그인 (Kakao JS SDK + `kakaoSignIn` Cloud Function 으로 access_token 검증 후 Firebase Custom Token 발급, uid `kakao:{id}` upsert)
    - [x] 게스트 로그인 (로컬 상태)
  - [-] Firestore 데이터 모델 설계 및 구현
    - [x] users 컬렉션 (loadUserFromFirestore / saveUserToFirestore)
    - [x] tanks 컬렉션 (loadUserTanks / saveTankToFirestore)
    - [x] fish (Tank.fish 임베디드 배열로 저장)
    - [x] inventory (User.inventory 임베디드 배열로 저장)
    - [x] eggs (User.inventory 임베디드 배열로 저장)
  - [x] Cloud Functions 서버 권위 경제 로직 (v2, asia-northeast3) — 재화·아이템·뽑기 변경은 서버에서만 실행, Firestore 직접 쓰기는 보안 규칙 차단
    - [x] bootstrapUser (신규 유저+기본 수조 생성)
    - [x] claimDailyReward (일일 보상, 트랜잭션 + 날짜 검증)
    - [x] purchaseEgg / startHatching / hatchEgg (서버 종 추첨 rollSpecies, 도감 자동 등록)
    - [x] feedFish / sprinkleFeed (일일 제한 + 성장 가속 + Pearl 보상)
    - [x] exchangePearl / purchaseStarCoral / purchaseDecoration (재화 검증·차감)
    - [x] claimMilestone (도감 진행도 서버 재계산 후 보상)
    - [ ] purchaseStarCoral 실제 결제(IAP) 영수증 검증 (현재 검증 없이 지급)
  - [x] 서버 경제 동작에 낙관적 UI 적용 (요청 즉시 UI 반영, 실패 시 롤백 — 체감 지연 제거)
  - [-] Firebase Storage 설정 (SDK init 완료, 업/다운로드 로직 미구현)
- [x] 🔴 라우팅 구조 구현 (React Router v6)
  - [x] HashRouter (온보딩, 로그인)
  - [x] 탭 라우터 (메인 5개 탭: /tank, /compendium, /shop, /friends, /settings)
- [x] 🟡 오프라인 지원 기초 (Zustand persist + localStorage)
- [x] 🟡 환경 변수 관리 (.env, VITE\_ prefix)

### 2-2. 3D 수조 핵심 구현 (Week 3~4)

- [x] 🔴 3D 수조 씬 완성 (5종 환경 색상 테마 구현)
  - [x] 산호초 환경
  - [x] 심해 환경
  - [x] 한국 강 환경
  - [x] 아마존 환경
  - [x] 우주 환경
- [x] 🔴 물고기 3D 모델 제작 및 임포트 (MVP 10종) — 절차적 GLB 10종 (`scripts/generate-fish-models.mjs`)
  - [x] 각 종별 GLB 모델 (현재 절차적; 실제 폴리곤 ~500~2000)
  - [ ] 유영 애니메이션 (Idle, Eat, Swim) — 현재는 코드 기반 swim sway만
  - [ ] LOD(Level of Detail) 적용
  - [ ] Texture Atlas 적용 (draw call 최소화)
- [x] 🔴 Boids 알고리즘 적용 (분리·정렬·응집 3원칙 구현, 같은 종 스쿨링 + 경계 회피 조향, 먹이 추적 우선)
- [x] 🔴 물 셰이더 완성
  - [x] 수면 물결 효과
  - [x] 빛의 굴절 (코스틱스 shimmer)
  - [x] 거품 파티클 (BUBBLE_COUNT=35, 환경 색조 + 상승/리셋)
  - [x] 수초 흔들림 (type='plant' 데코 sin sway)
- [x] 🔴 기본 조명 시스템 (AmbientLight, DirectionalLight, PointLight)
  - [x] 낮/밤 자동 전환 (기기 시간 연동, 5초 throttle, 배경/Fog까지 보간)
  - [x] 수동 조명 모드 선택 UI (TankPage ☀️ 버튼 → 4모드 칩 팝업: 자동/낮/노을/밤, setLightMode 즉시 반영)
- [x] 🔴 물고기 터치/클릭 인터랙션
  - [x] 클릭 시 이름/정보 카드 팝업
  - [x] 정보 카드에서 개별 먹이주기 (FishInfoCard 버튼)
  - [x] 먹이 뿌리기 클릭 인터랙션 (수면 raycast → 먹이 4~6개 낙하 → 가까운 물고기 추적·섭취)
- [ ] 🟡 Instanced Mesh 최적화 (수초 등 반복 오브젝트)
- [ ] 🟡 저사양 모드 (30fps 제한, 셰이더 단순화)

### 2-3. 게임 시스템 구현 (Week 5~6)

- [x] 🔴 물고기 사육 시스템
  - [x] 먹이주기 로직 (하루 최대 3회)
  - [x] 성장 단계 구현 (치어→어린물고기→성어→대형어, 4단계 자동 승급)
  - [x] 성장 타이머 (Date.now 기준 stageStartedAt + growthBoostSeconds)
  - [-] 먹이 종류별 효과 (성장 가속 +5분 구현, 색깔 변화 미구현)
- [x] 🔴 기분 시스템 (3D 위 떠다니는 이모지 대신 행동·UI 노출 방식 채택)
  - [x] 쾌적도 계산 로직 (`src/utils/mood.ts`) — 청결도/밀도/서식지 궁합/스쿨링/최근 먹이 5요소 가중합 0~100
  - [x] 청결도 시간 감쇠 + 먹이 시 누적 오염 (`tickMoodAndCleanliness`, `contaminate`, 30s 틱)
  - [x] 청소 액션 (`cleanTank`, Pearl 50 차감, 우측 액션 버튼 💧)
  - [x] 표정 상태 3종 — Boids 가중치로 표현 (happy: 속도×1.15, bored: 속도×0.65 + 바닥 가라앉음)
  - [x] FishInfoCard 쾌적도 게이지(0~100) + 개선 팁 자동 노출
  - [x] 상단 HUD 청결도(💧%) + 행복도(💖%) 인디케이터
- [-] 🔴 가챠 시스템 (알)
  - [x] 알 3티어 정의 (기본/희귀/전설)
  - [x] 부화 타이머 (기본 5분, 희귀 30분, 전설 2시간)
  - [x] 부화 연출 애니메이션 (HatchAnimationModal: shake→crack→flash→reveal)
  - [ ] 광고 시청 부화 단축 기능
  - [x] 가챠 확률 로직 및 확률 공시 준비
- [x] 🔴 재화 시스템
  - [x] Pearl(진주) 획득 · 소비 로직
  - [x] Star Coral(스타산호) 획득 · 소비 로직
  - [x] 재화 잔액 실시간 표시 (상단 HUD)
- [x] 🔴 일일 로그인 보상 시스템
  - [x] 7일 연속 보상 테이블 설계
  - [x] 보상 팝업 UI 구현
  - [x] 출석 체크 로직 (날짜 기준)
- [ ] 🟡 먹이주기 누적 보상 시스템 (n회 누적 시 알 지급)
- [x] 🟡 플레이어 레벨 및 경험치 시스템 (최대 100레벨)

### 2-4. 꾸미기 & 도감 & UI (Week 7~8)

- [x] 🔴 꾸미기 시스템 (단계 1+2 완료: 카탈로그+렌더링+드래그 배치 + 인벤토리 + 프리셋 3슬롯 + 상점 탭)
  - [x] 3D 드래그 배치 인터랙션 (바닥 평면 raycaster + 카메라 잠금)
  - [x] 회전/스케일/삭제 (DecorationModePanel 우측 버튼)
  - [x] 선택 하이라이트 (펄스 링)
  - [x] 배치 가능 오브젝트 MVP 구현 — **절차적 GLB 26종**
    - [x] 수초 8종 (seagrass, kelp, coral_branch, coral_brain, anemone, bamboo_water, fern_aquatic, moss_ball)
    - [x] 바위 6종 (pebble_pile, boulder_dark, lava_rock, slate_flat, crystal_blue, geode_purple)
    - [x] 유목 4종 (branch_straight, root_twisted, log_hollow, stick_small)
    - [x] 장식품 8종 (treasure_chest, pirate_ship, clay_pot, ship_wheel, pearl_shell, roman_pillar, arch_ring, bubble_chimney)
  - [x] 데코 GLB 생성기 (`scripts/generate-decoration-models.mjs`) + 로더 (`decorationModelLoader.ts`)
  - [x] 데코 프리뷰 페이지 (`public/decoration-preview.html` — 단일 WebGL 컨텍스트로 26종 동시 렌더)
  - [x] 꾸미기 프리셋 저장 (수조별 3개 슬롯, Tank.decorationPresets, 인벤토리 회수/부족 자동 스킵)
  - [x] 꾸미기 모드 진입/종료 UI (TankPage 🪴 버튼 → DecorationModePanel)
- [x] 🔴 도감 시스템
  - [x] 전체 종 목록 화면 (잠금/잠금해제 상태)
  - [x] 잠금 상태: ❓ 표시
  - [x] 잠금해제: 이모지 + 종 정보 (이름, 희귀도, 서식지)
  - [x] 도감 완성도 % 표시
  - [x] 마일스톤 보상 로직 (10% 단위, COMPENDIUM_REWARDS 10단계 + 가로 스크롤 마일스톤 트랙)
- [x] 🔴 메인 수조 화면 UI 완성
  - [x] 상단 바 (재화 표시, 레벨)
  - [x] 하단 탭 5개 (수조, 도감, 상점, 친구, 설정)
  - [x] 플로팅 액션 버튼 (먹이주기, 꾸미기, 포토 모드)
- [x] 🔴 온보딩 (3페이지 슬라이드 구현)
- [x] 🔴 튜토리얼
  - [x] 최초 실행 튜토리얼 플로우 (5단계: 환영→카메라→선물 알→부화 시작→수확)
  - [x] 튜토리얼 중 첫 알 자동 지급 (30초 부화 단축)
- [x] 🔴 상점 화면
  - [x] 알 구매 섹션
  - [x] Star Coral 충전 패키지 (5종)
  - [x] 꾸미기 아이템 섹션 (ShopPage 알/꾸미기/Star Coral 3탭, ?tab=decoration URL 동기화, 미보유 클릭 시 자동 라우팅)
- [x] 🟡 인앱 알림 센터 (성장 완료, 부화 완료, 일일 보상)
  - [x] useNotificationStore (persist, 최대 50건, id 기반 중복 방지)
  - [x] NotificationPanel UI (TankPage 🔔 버튼 + 안읽음 배지, 모두읽음/삭제/전체삭제)
  - [x] 성장·부화·일일 보상 이벤트 발생 시 인앱 알림 자동 적재
- [x] 🟡 설정 화면 (사운드 ON/OFF, 알림 설정, 계정, 도움말)
- [x] 🟡 사운드 시스템 (BGM + SFX)
  - [x] howler.js 기반 오디오 매니저 (`src/services/audio.ts`) — BGM 페이드 인/아웃, SFX Howl 캐싱, 키별 게인 보정
  - [x] useAudioStore (BGM/SFX ON/OFF, localStorage 영속, 리하이드레이트 시 상태 동기화)
  - [x] 첫 user gesture에서 자동재생 정책 unlock (pointerdown/keydown/touchstart)
  - [x] visibilitychange로 탭 백그라운드 시 BGM 자동 일시정지 (배터리 절약)
  - [x] BGM main 트랙 1개 (`public/audio/bgm/main.mp3`, 24kbps 룹)
  - [x] SFX 11종 (`public/audio/sfx/`): click·tab·modal_open·modal_close·confirm·hatch·reward·notify·shutter·place·error·coin
  - [x] 핵심 트리거 연결 — 모달 열기/닫기/확정, 부화 완료, 일일보상 등장, 인앱 알림 push, 포토 셔터, 데코 배치, 상점 구매 성공/실패
  - [x] 설정 토글이 즉시 반영 (BGM 페이드, SFX 즉각 ON/OFF)

### 2-5-pre. Capacitor 네이티브 래핑 (PWA → Android/iOS 앱)

> 상세 가이드: [`AquaWorld_Capacitor_네이티브_가이드.md`](./AquaWorld_Capacitor_네이티브_가이드.md)

- [x] 🔴 Capacitor 코어 설치 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`)
- [x] 🔴 핵심 플러그인 설치 (`@capacitor/app` 딥링크, `@capacitor/browser` OAuth, `@capacitor/preferences`, `@capacitor/status-bar`, `@capacitor/splash-screen`)
- [x] 🔴 `capacitor.config.ts` 생성 (appId `app.aquaworld`, webDir `dist`, splash/statusbar 설정)
- [x] 🔴 `cap:build` / `cap:run:android` / `cap:livereload:android` npm 스크립트 추가
- [x] 🔴 PWA 서비스워커 Capacitor 빌드 시 자동 비활성화 (`VITE_TARGET=capacitor` 분기)
- [x] 🔴 카카오 로그인 네이티브 분기 — 외부 브라우저(`@capacitor/browser`) + 커스텀 스킴 딥링크(`app.aquaworld://oauth/kakao`) 콜백
- [x] 🔴 Google 로그인 네이티브 분기 — `signInWithRedirect` + `getRedirectResult` 부팅 시 회수
- [x] 🔴 App URL listener 등록 (`@capacitor/app` appUrlOpen → completeKakaoLogin)
- [ ] 🔴 **(사용자 작업)** JDK 21 + Android Studio 설치
- [ ] 🔴 **(사용자 작업)** `npx cap add android` 실행 (Android 네이티브 프로젝트 생성)
- [ ] 🔴 **(사용자 작업)** `AndroidManifest.xml` 에 `app.aquaworld` 커스텀 스킴 intent-filter 추가
- [x] 🔴 Firebase Hosting OAuth 중계 페이지 (`public-hosting/oauth/kakao.html`) — 카카오 https 제약 우회
- [ ] 🔴 **(사용자 작업)** `firebase deploy --only hosting` 으로 중계 페이지 배포
- [ ] 🔴 **(사용자 작업)** Kakao Developer Console 에 네이티브 redirect URI(`https://aquaworld-bf2f4.web.app/oauth/kakao.html`) 등록
- [ ] 🔴 **(사용자 작업)** Firebase Console 에 Android 앱 등록 + SHA-1 지문 업로드 (+ `google-services.json`)
- [ ] 🔴 **(사용자 작업)** Android 실기기에서 디버그 빌드 실행 검증 (USB 디버깅)
- [ ] 🟡 AdMob 네이티브 광고 SDK 연동 (`@capacitor-community/admob`) — 웹 광고 SDK 대체 (Phase 2-5의 광고 항목과 합쳐서 처리)
- [ ] 🟡 인앱결제 — Google Play Billing 연동 (`@capacitor-community/in-app-purchases`), 영수증 검증은 기존 `purchaseStarCoral` Cloud Function 확장
- [ ] 🟡 푸시 알림 네이티브 채널 — `@capacitor/push-notifications` + 기존 FCM 토큰 흐름 통합
- [ ] 🟡 Splash 이미지 / 앱 아이콘 어댑티브 (Android) 적용
- [ ] 🟡 릴리스 키스토어 생성 + Play Console 내부 테스트 트랙 업로드
- [ ] 🟢 iOS 빌드 (Mac + Xcode 필요) — `npx cap add ios`, App Store Connect 등록
- [ ] 🟢 Electron 데스크톱 래퍼 검토 (Phase 7-4 와 통합)

### 2-5. 외부 SDK 연동 & 마무리 (Week 9~10)

- [ ] 🔴 인앱 결제 연동 (Web Payments API + 서버 검증)
  - [ ] 결제 플로우 UI 구현
  - [ ] Firebase Functions 결제 검증 로직
  - [ ] 결제 완료 → 재화 즉시 지급 플로우
- [ ] 🔴 광고 SDK 연동
  - [ ] Google AdSense / AdMob Web 리워드 동영상 광고 구현
  - [ ] 광고 시청 보상 지급 로직 (일일 최대 10회 제한)
  - [ ] 광고 로딩 실패 시 대체 보상 처리
- [x] 🔴 포토 모드 + 공유
  - [x] UI 숨김 모드 (포토 모드 진입 — HUD/인큐베이터/액션 비활성, 카메라는 유지)
  - [x] Canvas toDataURL / toBlob으로 스크린샷 캡처 (TankSceneHandle.captureFrame)
  - [x] 필터 5종 구현 (원본/따뜻/차갑/빈티지/흑백)
  - [x] 프레임 3종 구현 (없음/폴라로이드/그라데이션)
  - [x] 앱 워터마크 자동 삽입 (🐟 AquaWorld)
  - [x] Web Share API로 공유 (+ 다운로드 폴백)
- [-] 🔴 웹 푸시 알림 (Web Push API + FCM)
  - [x] FCM 전용 SW(firebase-messaging-sw.js) 별도 스코프 등록 (Workbox SW와 충돌 회피)
  - [x] 권한 요청 → 토큰 발급 → 서버 등록 플로우 (registerPushToken / unregisterPushToken)
  - [x] 설정 화면 푸시 알림 ON/OFF 토글 (SettingsPage)
  - [x] 포그라운드 메시지 → 인앱 알림함 적재 (onMessage)
  - [x] 부화 완료 알림 (notifyReadyHatches 스케줄러 1분 주기, nextHatchAt 인덱스 + 무효 토큰 정리) — ⚠️ Blaze 요금제 필요
  - [ ] 물고기 성장 완료 알림 (백그라운드 푸시 — 현재 인앱 알림만)
  - [ ] 일일 보상 리마인더 (백그라운드 푸시 — 현재 인앱 알림만)
  - [ ] iOS 16.4+ 웹 푸시 실기기 지원 확인 (isSupported 가드만 적용, 실기기 미검증)
- [-] 🔴 분석 및 모니터링 SDK 연동
  - [x] Firebase Analytics 이벤트 정의 및 구현 (핵심 20개 이벤트)
  - [ ] Amplitude 코호트 분석 세팅
  - [x] Sentry 크래시 리포팅 연동 (@sentry/react + ErrorBoundary, Replay 에러 세션 100%, identifyUser 에 setUser 묶음, @sentry/vite-plugin 소스맵 자동 업로드)
- [ ] 🔴 전체 기기/브라우저 테스트
  - [ ] iPhone SE (소형 화면, iOS Safari)
  - [ ] iPhone 15 Pro Max (대형 화면, iOS Safari)
  - [ ] Galaxy S21 (Android Chrome)
  - [ ] Galaxy A 시리즈 (Android 저사양)
  - [ ] Desktop Chrome / Firefox / Edge
- [ ] 🔴 PWA 최종 점검
  - [ ] Lighthouse PWA 점수 90+ 달성
  - [ ] 홈 화면 설치 프롬프트 정상 동작
  - [ ] 오프라인 모드 핵심 기능 동작
- [x] 🟡 PWA 아이콘 (192×192, 512×512) 제작 및 적용
- [x] 🟡 개인정보처리방침 / 이용약관 화면 구현 (`/privacy`, `/terms` — PIPA §30 11개 항목 + 2025.4 작성지침 + 2026.9 시행 개정법 + 표준약관 10023호 + 게임산업진흥법 §33 확률공시 반영, 설정·로그인 화면 양쪽 연결)
- [x] 🟡 회원 탈퇴 (서버 권위 영구 삭제 — `deleteAccount` Cloud Function: tanks 일괄 삭제 + user 문서 삭제 + Firebase Auth 계정 삭제, 2단계 확인 모달, 게스트는 메뉴 숨김)
- [x] 🟡 오픈소스 라이선스 페이지 (`/licenses`, 100개 의존성 자동 추출 + 검색 + 접이식 전문, lazy load)

---

## Phase 3 — 클로즈드 베타

**기간:** 1개월 | **담당:** 전 팀 + QA

### 3-1. 베타 준비

- [ ] 🔴 Vercel / Netlify / Cloudflare Pages 프로덕션 배포 설정
- [ ] 🔴 커스텀 도메인 연결 (예: aquaworld.app)
- [ ] 🔴 베타 테스터 500명 모집
  - [ ] URL 공유로 즉시 접근 가능 (앱스토어 불필요)
  - [ ] 인스타그램/디스코드를 통한 모집
  - [ ] 테스터 NDA 동의 프로세스
- [ ] 🔴 피드백 수집 채널 구축
  - [ ] 인앱 피드백 버튼 구현
  - [ ] Discord 서버 개설 (채널 구조 설계)
  - [ ] 구글 설문지 템플릿 작성 (초기 인상, UX 평가)
- [ ] 🟡 베타 지표 모니터링 대시보드 설정 (Firebase Analytics)
  - [ ] D1 / D7 리텐션 추적
  - [ ] 세션 길이, 세션 횟수
  - [ ] 결제 전환율 (의향 조사 포함)
  - [ ] Sentry 오류율 모니터링
- [ ] 🟡 CS 대응 프로세스 정의 (버그 리포트 → 수정 → 배포 사이클)

### 3-2. 베타 운영

- [ ] 🔴 베타 테스터 초대 및 접속 확인
- [ ] 🔴 버그 리포팅 수집 및 우선순위 분류 (Critical / Major / Minor)
- [ ] 🔴 사용자 인터뷰 진행 (최소 20명)
  - [ ] 첫 인상 및 온보딩 경험
  - [ ] 게임 루프 (일일, 주간) 체감
  - [ ] 결제 의향 및 가격 민감도
  - [ ] 가장 자주 사용하는 기능 / 사용하지 않는 기능
- [ ] 🔴 핵심 지표 주간 리포팅 (베타 기간 4주간 매주)
- [ ] 🟡 밸런스 데이터 수집 (재화 수급, 부화 주기, 성장 속도 체감)

### 3-3. 피드백 반영 및 최적화

- [ ] 🔴 크리티컬 버그 100% 수정 (배포 차단 이슈)
- [ ] 🔴 Major 버그 80% 이상 수정
- [ ] 🔴 성능 최적화
  - [ ] FCP(First Contentful Paint) 2초 이내 달성
  - [ ] 중급 모바일 기기 평균 50fps 이상 달성
  - [ ] 30분 사용 시 메모리 안정 확인
- [ ] 🔴 UX 개선 (베타 피드백 기반)
  - [ ] 온보딩 이탈률 20% 이하 달성
  - [ ] 첫 세션 D1 리텐션 40% 이상 달성 목표 설정
- [ ] 🟡 게임 밸런스 조정 (Pearl 수급량, 부화 시간 조정)
- [ ] 🟡 PWA OG 이미지 및 소셜 공유 프리뷰 최종 제작
- [ ] 🟢 베타 테스터 감사 보상 지급 (희귀 알 등)

---

## Phase 4 — 정식 출시

**기간:** 0.5개월 (약 2주) | **담당:** 전 팀, 마케터

### 4-1. 프로덕션 배포

- [ ] 🔴 프로덕션 환경 최종 배포
  - [ ] Vercel / Netlify / Cloudflare Pages 프로덕션 도메인 확정
  - [ ] HTTPS, HTTP/2 설정 확인
  - [ ] CDN 캐시 정책 설정
  - [ ] 환경 변수 프로덕션 값 적용
- [ ] 🔴 Lighthouse 점수 최종 확인
  - [ ] Performance 90+
  - [ ] PWA 100
  - [ ] Accessibility 90+
  - [ ] SEO 90+
- [ ] 🔴 보안 점검
  - [ ] CORS 정책 확인
  - [ ] Firebase 보안 규칙 최종 점검
  - [ ] HTTPS only 강제 적용
- [ ] 🟡 개인정보처리방침 URL 등록
- [ ] 🟡 오픈 그래프 / 트위터 카드 메타태그 최종 적용
- [ ] 🟡 sitemap.xml, robots.txt 생성

### 4-2. 마케팅 실행

- [ ] 🔴 출시 랜딩 페이지 공개 및 사전 예약 마감
- [ ] 🔴 SNS 출시 콘텐츠 배포
  - [ ] 인스타그램 출시 포스트 (릴스 포함)
  - [ ] 틱톡 출시 영상 (ASMR 수조 영상)
  - [ ] 트위터/X 출시 스레드
- [ ] 🔴 인플루언서 협업 콘텐츠 배포 조율 (10~20명)
- [ ] 🔴 Google Ads (웹 전환) 캠페인 시작
- [ ] 🔴 메타 광고 캠페인 시작
- [ ] 🟡 보도자료 배포 (IT 전문 매체 5곳 이상)
- [ ] 🟡 커뮤니티 채널 공개 (Discord, 카카오톡 오픈채팅)

### 4-3. 출시 당일 운영

- [ ] 🔴 프로덕션 URL 라이브 확인
- [ ] 🔴 실시간 모니터링 대시보드 운영
  - [ ] Sentry 오류율 실시간 확인
  - [ ] Firebase 동접자 수 모니터링
  - [ ] Firestore / Firebase Functions 오류율 확인
  - [ ] 결제 처리 성공률 확인
- [ ] 🔴 CS 채널 운영 시작 (카카오톡 채널 or 이메일)
- [ ] 🟡 사전 예약자 대상 한정 종 지급 확인
- [ ] 🟡 출시 당일 지표 리포트 작성 (방문자 수, D1 리텐션, 결제)

---

## Phase 5 — V1.1 업데이트 (친구 시스템 + 시즌 이벤트)

**기간:** 2개월 | **기준:** 출시 후 1~3개월 차

### 5-1. 친구 시스템

- [ ] 🔴 친구 추가 기능
  - [ ] 고유 ID 검색으로 친구 추가
  - [ ] URL 공유로 친구 추가 (QR 코드 대신 Web Share API)
  - [ ] 카카오톡 친구 연동
- [ ] 🔴 친구 수조 방문 기능
  - [ ] 친구 목록 화면 (최근 접속 시간 표시)
  - [ ] 친구 수조 읽기 전용 렌더링
  - [ ] 방문 흔적 남기기 (하트 이모티콘, 먹이 주기)
  - [ ] 비동기 알림 (누가 내 수조를 방문했는지)
- [ ] 🔴 친구 초대 보상 시스템
  - [ ] 초대 링크 생성 (URL + UTM 파라미터)
  - [ ] 초대받은 친구 가입 완료 시 양쪽 희귀 알 1개 지급
  - [ ] 초대 보상 중복 방지 로직
- [ ] 🟡 친구 수조 방문 횟수 제한 (하루 10명 등 어뷰징 방지)
- [ ] 🟡 친구 차단/신고 기능

### 5-2. 시즌 이벤트 시스템

- [ ] 🔴 시즌 패스 시스템 구현 (월 ₩9,900)
  - [ ] 시즌 패스 화면 디자인
  - [ ] 무료 패스 / 유료 패스 2트랙 구조
  - [ ] 30단계 보상 테이블 구현
  - [ ] 패스 구독 결제 연동
- [ ] 🔴 Event Token 재화 시스템 추가
- [ ] 🔴 첫 번째 시즌 이벤트 콘텐츠 제작
  - [ ] 시즌 한정 종 1~2종
  - [ ] 시즌 한정 꾸미기 세트
  - [ ] 이벤트 미션 테이블 (10~15개)
  - [ ] 이벤트 전용 UI 화면
- [ ] 🟡 시즌 이벤트 결과 정산 및 보상 지급 자동화

### 5-3. 운영 개선

- [ ] 🔴 인앱 리뷰 요청 로직 최적화 (먹이주기 3회 완료 후 피드백 모달 등)
- [ ] 🟡 AI 챗봇 CS 도입 (카카오톡 채널 챗봇 또는 Freshdesk)
- [ ] 🟡 광고 매출 최적화 (A/B 테스트: 광고 노출 시점)
- [ ] 🟡 D30 리텐션 지표 분석 및 개선 방안 도출
- [ ] 🟢 물고기 종 추가 (MVP 10종 → 20종)

---

## Phase 6 — V1.2 업데이트 (교배 시스템 + 물고기 시점 모드)

**기간:** 2개월 | **기준:** 출시 후 4~5개월 차

### 6-1. 교배 / 돌연변이 시스템

- [ ] 🔴 교배 UI 및 인터랙션
  - [ ] 교배할 두 물고기 선택 화면
  - [ ] 교배 결과 예측 미리보기 (색상 조합 힌트)
  - [ ] 교배 연출 애니메이션
- [ ] 🔴 유전자 시스템 설계 및 구현
  - [ ] 색상 유전 로직 (부모 색상 조합)
  - [ ] 무늬 유전 로직
  - [ ] 돌연변이 확률 (1~5%)
  - [ ] 돌연변이 종 DB 구성 (희귀 외형 20종 이상)
- [ ] 🔴 교배 쿨다운 및 제한 로직 (1일 3회 등)
- [ ] 🟡 교배 결과 도감 별도 탭 추가 (교배 계보 표시)
- [ ] 🟡 교배 관련 시즌 이벤트 연계 (특별 돌연변이 확률 업)

### 6-2. 물고기 시점 모드

- [ ] 🔴 물고기 선택 → 시점 전환 애니메이션
- [ ] 🔴 1인칭 물고기 시점 카메라 구현
  - [ ] 물고기 이동 경로 따라가기
  - [ ] 수조 내부 FPV(First Person View) 렌더링
  - [ ] 수면 위를 올려다보는 효과 (빛 굴절 강화)
- [ ] 🔴 시점 모드 전용 UI (종료 버튼, 다른 물고기 전환)
- [ ] 🟡 물고기 시점 모드 영상 녹화 / 공유 기능

### 6-3. 추가 콘텐츠

- [ ] 🟡 물고기 종 추가 (20종 → 30종 이상, 한국 토종 어종 포함)
  - [ ] 쏘가리
  - [ ] 버들치
  - [ ] 각시붕어 등
- [ ] 🟡 새로운 수조 환경 추가 (판타지 테마: 용궁 또는 마법의 숲)
- [ ] 🟡 꾸미기 아이템 추가 (한국적 미감 세트: 사군자, 한지 소품)
- [ ] 🟡 주간 미션 시스템 고도화 (미션 다양성, 보상 개편)
- [ ] 🟢 PWA 위젯 (iOS 16+ / Android 미니뷰) 검토

---

## Phase 7 — V2.0 (WebXR AR 모드 + 멀티 수조 + 글로벌 확장)

**기간:** 2.5개월 | **기준:** 출시 후 6~9개월 차

### 7-1. WebXR AR 모드

- [ ] 🔴 WebXR Device API 통합
  - [ ] iOS Safari WebXR 지원 확인 (15.4+)
  - [ ] Android Chrome WebXR ARCore 연동
- [ ] 🔴 거실 수족관 AR 모드 구현
  - [ ] 평면 감지 (바닥, 테이블)
  - [ ] 수족관 3D 모델 배치 및 크기 조절
  - [ ] 실제 공간 조명 적응 (Light Estimation)
  - [ ] AR 화면에서 물고기 터치 인터랙션
- [ ] 🔴 AR 모드 안정성 테스트 (기기 호환성)
- [ ] 🟡 AR 수조 스크린샷 / 영상 Web Share API 공유 기능
- [ ] 🟢 WebXR 핸드 트래킹 인터랙션 검토

### 7-2. 멀티 수조

- [ ] 🔴 수조 슬롯 확장 UI (최대 5개 슬롯)
- [ ] 🔴 수조 간 이동 인터페이스 (스와이프 또는 썸네일 선택)
- [ ] 🔴 수조별 독립 생태계 (물고기, 꾸미기, 환경 분리)
- [ ] 🔴 추가 슬롯 결제 구현
- [ ] 🟡 수조 간 물고기 이동 기능

### 7-3. 글로벌 현지화 (i18n)

- [ ] 🔴 i18n 인프라 구축 (react-i18next)
- [ ] 🔴 영어(EN) 현지화
  - [ ] UI 문자열 전체 번역
  - [ ] 도감 물고기 정보 영어 번역
  - [ ] OG 메타데이터 영어 작성
- [ ] 🔴 일본어(JA) 현지화
  - [ ] UI 문자열 번역
  - [ ] 지역 한정 종 추가 (비단잉어)
- [ ] 🟡 중국어 번체(ZH-TW) 현지화
- [ ] 🟡 현지 결제 수단 통합
  - [ ] LINE Pay (일본)
  - [ ] PayPay (일본)
  - [ ] 기타 동남아 결제 수단 검토
- [ ] 🟡 다국어 도메인 또는 서브도메인 설정 (en.aquaworld.app 등)
- [ ] 🟢 베트남어(VI) 현지화 검토

### 7-4. 장기 확장 사전 검토

- [ ] 🟢 Electron 래퍼로 Windows/Mac 데스크톱 앱 배포 검토
- [ ] 🟢 태블릿 전용 레이아웃 최적화 검토
- [ ] 🟢 IP 비즈니스 (굿즈, 아동 도서, 애니메이션) 파트너십 조사
- [ ] 🟢 실제 수족관(아쿠아플라넷 등) 콜라보 제안서 작성

---

## 전체 마일스톤 요약

| Phase   | 기간 | 핵심 완료 기준                                       |
| ------- | :--: | ---------------------------------------------------- |
| Phase 0 |  M1  | 최종 기획 확정, 와이어프레임 완성, 3D 컨셉 아트 완성 |
| Phase 1 | M1.5 | React+Vite PWA PoC 성능 검증 완료, Go/No-Go 결정     |
| Phase 2 |  M4  | MVP 전 기능 구현 완료, 알파 QA 통과                  |
| Phase 3 |  M5  | URL 기반 클로즈드 베타 완료, D1 리텐션 40% 달성      |
| Phase 4 | M5.5 | Vercel/Netlify 정식 배포, 마케팅 캠페인 시작         |
| Phase 5 | M7.5 | V1.1 업데이트 배포, 친구 시스템 라이브               |
| Phase 6 | M9.5 | V1.2 업데이트 배포, 교배 시스템 라이브               |
| Phase 7 | M12  | V2.0 배포, 글로벌 출시 (영어/일본어)                 |

---

## KPI 달성 체크포인트

### 출시 1개월 목표

- [ ] 누적 방문자 30,000명 이상
- [ ] MAU 20,000 이상
- [ ] D1 리텐션 40% 이상
- [ ] D7 리텐션 20% 이상
- [ ] 결제 전환율 2.0% 이상
- [ ] 인앱 피드백 평점 4.0 이상
- [ ] Sentry 오류율 0.5% 이하
- [ ] Lighthouse PWA 점수 90+

### 출시 3개월 목표

- [ ] 누적 방문자 300,000명 이상
- [ ] MAU 80,000 이상
- [ ] DAU/MAU 비율 25% 이상
- [ ] 결제 전환율 3.0% 이상
- [ ] 월 매출 36,000,000원 이상
- [ ] 평균 세션 시간 5분 이상
- [ ] PWA 홈 화면 설치율 15% 이상

### 출시 12개월 목표

- [ ] 누적 방문자 1,500,000명 이상
- [ ] MAU 250,000 이상
- [ ] DAU/MAU 비율 30% 이상
- [ ] D30 리텐션 15% 이상
- [ ] ARPU $1.5 이상
- [ ] 결제 전환율 4.0% 이상
- [ ] 월 매출 150,000,000원 이상
- [ ] 글로벌 출시 완료 (영어/일본어)

---

> 본 문서는 기획서 v1.0 기준으로 작성되었으며,
> 각 Phase 완료 시 리뷰를 통해 다음 Phase 계획을 업데이트합니다.
> **플랫폼:** React + Vite + PWA + Capacitor 네이티브 래퍼 (Expo/React Native → PWA 전환 2026.5, → Capacitor 네이티브 래핑 2026.6)
>
> **— END —**
