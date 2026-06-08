# AquaWorld 인앱결제(Google Play Billing) 설정 가이드

Star Coral 패키지(KRW)를 실제 Google Play 결제 + 서버 영수증 검증으로 연동했다.
코드는 모두 반영되어 있으며, 아래 **외부 설정**을 완료해야 실제 결제가 동작한다.
(에뮬레이터·웹에서는 실결제가 불가능하다. 반드시 서명된 빌드 + 내부 테스트 트랙에서 검증.)

## 0. 동작 개요

```
ShopPage → billing.purchaseStarCoral(pkg) → Play 결제창
        → approved → verifyStarCoralPurchase(Cloud Fn)
              → Google Play Developer API 로 purchaseToken 검증
              → purchases/{token} 멱등 기록 + user.starCoral 지급
        → transaction.finish()(consume) → 재구매 가능
```

- 무검증 지급(구 `purchaseStarCoral`)은 폐기됨 → 호출 시 에러.
- 상품 ID 는 코드와 **정확히 일치**해야 한다: `sc_60`, `sc_300`, `sc_600`, `sc_1200`, `sc_3000`
  (정의 위치: [src/constants/index.ts](../src/constants/index.ts) `STAR_CORAL_PACKAGES`,
  [functions/gameData.js](../functions/gameData.js) `STAR_CORAL_PACKAGES`)

## 1. Play Console — 인앱 상품 등록

Play Console → 해당 앱 → **수익 창출 → 상품 → 인앱 상품**에서 5종을 만든다.

| 상품 ID(필수 동일) | 이름 | 가격(KRW) | 지급 Star Coral |
|---|---|---|---|
| `sc_60`   | 작은 산호   | 1,200  | 60 (+0)    |
| `sc_300`  | 평범한 산호 | 5,500  | 300 (+30)  |
| `sc_600`  | 아름다운 산호 | 11,000 | 600 (+90)  |
| `sc_1200` | 화려한 산호 | 22,000 | 1,200 (+240) |
| `sc_3000` | 전설의 산호 | 55,000 | 3,000 (+900) |

- 유형은 **관리형 상품(소비성으로 사용)**. (코드에서 `CONSUMABLE` 로 등록 + 결제 후 consume)
- 모든 상품을 **활성화(Active)** 한다.

## 2. Google Cloud — 서비스 계정 + Play Developer API

서버가 purchaseToken 을 검증하려면 Play Developer API 접근 권한이 필요하다.

1. **API 사용 설정**: Play Console → **설정 → API 액세스** 진입. 연결된 Google Cloud 프로젝트
   (Firebase 프로젝트와 동일 권장)에서 *Google Play Android Developer API* 를 사용 설정.
2. **서비스 계정 생성**: Google Cloud Console → IAM 및 관리자 → 서비스 계정 → 새로 만들기.
   - 별도 IAM 역할 부여 불필요(아래 Play Console 권한으로 충분).
3. **Play Console 권한 부여**: Play Console → 설정 → API 액세스 → 위 서비스 계정에
   **"재무 데이터, 주문 및 취소 설문조사 응답 보기"** 권한 + 대상 앱 접근 권한을 부여한다.
4. **키 발급**: 서비스 계정 → 키 → 키 추가 → **JSON** 다운로드.

> 참고: 권한 부여 후 실제 적용까지 수십 분~수 시간 지연될 수 있다. 검증이 404/410 으로
> 실패하면 권한 전파를 기다린 뒤 재시도.

## 3. Firebase — 서비스 계정 키를 시크릿으로 주입

다운로드한 JSON 파일 내용을 **통째로** 시크릿에 넣는다.

```bash
# JSON 파일 내용을 그대로 붙여넣기(여러 줄 그대로 OK)
firebase functions:secrets:set GOOGLE_PLAY_SA_KEY

# 함수 배포 (verifyStarCoralPurchase 가 이 시크릿을 사용)
firebase deploy --only functions:verifyStarCoralPurchase
# (또는 전체) firebase deploy --only functions
```

- 에뮬레이터에서 테스트하려면 `functions/.env.local` 에 `GOOGLE_PLAY_SA_KEY='{...}'`
  형태로 한 줄(JSON 이스케이프) 넣어 사용.
- 패키지명(`app.aquaworld`)은 [functions/gameData.js](../functions/gameData.js) `ANDROID_PACKAGE_NAME`
  에 하드코딩되어 있다. 앱 ID 변경 시 함께 수정.

## 4. 빌드 & 테스트 트랙 업로드

결제는 **Play 서명된 빌드 + 테스터 계정**에서만 동작한다(디버그/에뮬레이터 불가).

```bash
# 웹 자산 빌드 + 네이티브 동기화
npm run cap:build      # = VITE_TARGET=capacitor build && cap sync
# Android Studio 에서 서명된 AAB 빌드 → Play Console 내부 테스트 트랙 업로드
npm run cap:open:android
```

1. Play Console → **테스트 → 내부 테스트** 트랙에 AAB 업로드.
2. Play Console → **설정 → 라이선스 테스트** 에 본인 Google 계정을 테스터로 등록
   (테스터는 실제 청구 없이 결제 플로우를 통과한다).
3. 내부 테스트 링크로 설치한 앱에서 상점 → Star Coral 구매 시도.

## 5. 검증 체크리스트

- [ ] `sc_60` 구매 → 결제 완료 후 Star Coral **60** 지급, 상점 잔액 즉시 반영
- [ ] 같은 상품 재구매 가능(소비 정상 — consume 됨)
- [ ] 결제창에서 취소 → 토스트 없이 조용히 종료, 재화 변동 없음
- [ ] (멱등) 동일 purchaseToken 재검증 시 추가 지급 없음 — Firestore `purchases/{token}` 1건만 존재
- [ ] 무검증 우회 차단: 구버전 클라가 `purchaseStarCoral` 호출 시 `failed-precondition` 에러
- [ ] 웹/PWA 클라우드 유저: "결제는 앱에서만 가능합니다" 안내
- [ ] 게스트(오프라인): 기존처럼 로컬 지급 유지

## 6. 트러블슈팅

| 증상 | 원인/조치 |
|---|---|
| `GOOGLE_PLAY_SA_KEY 시크릿이 설정되지 않았습니다` | 3장 시크릿 주입 후 함수 재배포 |
| `유효하지 않은 구매 토큰입니다`(404/410) | 상품 ID 불일치, 또는 SA 권한 전파 지연 — 1~2시간 후 재시도 |
| 상품이 결제창에 안 뜸 | Play Console 상품 비활성/미승인, 또는 서명·패키지명 불일치, 테스트 트랙 미배포 |
| Gradle 빌드 시 Billing 라이브러리 충돌 | `android/variables.gradle` 의 Billing 버전 조정(README of cordova-plugin-purchase 참조) |
