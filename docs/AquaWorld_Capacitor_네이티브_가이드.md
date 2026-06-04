# AquaWorld — Capacitor 네이티브 빌드 가이드

> **목적:** 기존 React + Vite PWA 코드 그대로 Android(추후 iOS) 네이티브 앱으로 패키징.
> **방식:** Capacitor 8.x WebView 래핑 — Vite 빌드 산출물(`dist/`)을 네이티브 앱이 로컬에서 로드.
> **작성일:** 2026년 6월

---

## 0. 한눈에 보기

| 구분 | 항목 |
| --- | --- |
| **재작성** | 없음. React/Three.js/Zustand/Firebase JS SDK 그대로 동작 |
| **수정** | 카카오 로그인(딥링크), Google 로그인(redirect), PWA SW 비활성화, **네이티브 푸시(Capacitor PushNotifications) 통합** → **이미 코드 반영 완료** |
| **추가 작업** | Android Studio 설치 / 네이티브 프로젝트 생성 / 콘솔 설정 → **아래 §3 사용자가 직접 수행** |
| **새 플러그인 후속** | AdMob, In-App Purchase (Phase 2-5 진행 시 통합) |

---

## 1. 이미 코드/설정에 반영된 것 (Claude 작업 완료)

| 파일 | 변경 |
| --- | --- |
| `package.json` | `@capacitor/core/cli/app/browser/preferences/status-bar/splash-screen/push-notifications/android` 의존성, `cap:*` 스크립트 5종 |
| `capacitor.config.ts` | 신규 — `appId: app.aquaworld`, `webDir: dist`, splash/statusbar 옵션 |
| `vite.config.ts` | `VITE_TARGET=capacitor` 일 때 PWA 플러그인 자동 비활성화 |
| `src/services/platform.ts` | 신규 — `isNative()`, 딥링크 스킴 + Kakao https 중계 URL 상수 |
| `src/services/firebase/auth.ts` | 네이티브 분기 — Google: `signInWithRedirect`, Kakao: `@capacitor/browser` + https 중계 → 딥링크 콜백 |
| `src/services/firebase/messaging.ts` | 네이티브 분기 — `@capacitor/push-notifications` 로 FCM Android 토큰 수신 → 기존 `registerPushToken` Callable 로 등록 (Web Push 스택 우회) |
| `android/app/src/main/AndroidManifest.xml` | Android 13+ `POST_NOTIFICATIONS` 권한, 기본 알림 채널·아이콘 메타 |
| `src/App.tsx` | `App.addListener('appUrlOpen', ...)` 등록, 부팅 시 `consumePendingRedirectResult()` |
| `src/pages/LoginPage.tsx` | `startKakaoLogin()` async 화 |
| `.env.example` | `VITE_KAKAO_REST_API_KEY`, `VITE_KAKAO_NATIVE_REDIRECT` 추가 |
| `firebase.json` | `hosting` 블록 추가 (`public-hosting/` 서빙) |
| `public-hosting/oauth/kakao.html` | 신규 — 1줄 JS 로 `?code=...` 를 `app.aquaworld://` 로 다시 던지는 OAuth 중계 페이지 |
| `docs/AquaWorld_로드맵_체크리스트_v1.0.md` | Phase 2-5-pre 섹션 추가 |

### npm 스크립트

| 스크립트 | 용도 |
| --- | --- |
| `npm run cap:build` | Vite 빌드 후 `cap sync` (네이티브 프로젝트에 dist/플러그인 복사) |
| `npm run cap:sync` | dist 변경 없이 plugin 동기화만 |
| `npm run cap:open:android` | Android Studio 열기 |
| `npm run cap:run:android` | 빌드 → sync → 연결된 기기/에뮬레이터로 설치+실행 |
| `npm run cap:livereload:android` | PC Vite dev 서버를 폰이 직접 읽음 (핫리로드, `--live-reload --external`) |

---

## 2. 동작 원리 짧게

```
[React/Vite] ──build──> dist/
                          │
                          ▼
                  cap sync (android/app/src/main/assets/public 로 복사)
                          │
                          ▼
        [Android WebView]  ──네이티브 브릿지──> Camera, Push, AdMob ...
```

- **OAuth (카카오)**: 앱 안 WebView 가 아니라 **외부 브라우저(Chrome Custom Tabs)** 로 인증 페이지를 띄움 →
  카카오 콘솔이 커스텀 스킴 등록을 막아두므로 **https 중계 페이지** (Firebase Hosting `oauth/kakao.html`) 를 redirect 로 쓰고,
  그 페이지가 1줄 JS 로 `app.aquaworld://oauth/kakao?code=...` 로 다시 던짐 →
  Android OS 가 인텐트필터를 통해 우리 앱으로 라우팅 →
  `App.addListener('appUrlOpen')` 가 code 회수 → 기존 `kakaoSignIn` Cloud Function 그대로 호출.
- **Google**: WebView 내부에선 popup이 막혀서 `signInWithRedirect` 로 전환. 결과는 앱 재진입 시 `getRedirectResult` 가 회수.

---

## 3. 사용자가 직접 해야 하는 것 ⚠️

### 3-1. 개발 환경 설치 (한 번만)

1. **JDK 21 (또는 Capacitor 8 권장 버전)** 설치 — [Eclipse Temurin](https://adoptium.net/temurin/releases/?version=21) 추천
   - 설치 후 `JAVA_HOME` 환경변수 설정 (예: `C:\Program Files\Eclipse Adoptium\jdk-21.x.x-hotspot`)
   - PowerShell에서 `java -version` 확인
2. **Android Studio** 설치 — [developer.android.com/studio](https://developer.android.com/studio)
   - 첫 실행 시 SDK Manager 에서 **Android SDK 34+**, **Build-Tools**, **Platform-Tools**, **AVD** 다운로드
   - 환경변수 `ANDROID_HOME=C:\Users\Lenovo\AppData\Local\Android\Sdk` 설정
   - `PATH` 에 `%ANDROID_HOME%\platform-tools` 추가 (adb 사용)
3. **(실기기 사용 시)** Android 폰 → 설정 → 휴대전화 정보 → 빌드번호 7회 탭 → 개발자모드 활성화 → **USB 디버깅 켜기**

### 3-2. Android 네이티브 프로젝트 생성

PowerShell 에서:

```powershell
cd C:\Users\Lenovo\Desktop\aqua-world
npm run build              # 첫 빌드 (dist/ 생성)
npx cap add android        # android/ 폴더 생성 — git 에 커밋
npm run cap:sync           # dist + plugin 복사
```

성공하면 프로젝트 루트에 `android/` 폴더가 생기고, 안에 Gradle 프로젝트가 들어있습니다.

### 3-3. AndroidManifest.xml — 커스텀 스킴 intent-filter 추가

파일 위치: `android/app/src/main/AndroidManifest.xml`

기존 `<activity android:name=".MainActivity" ...>` 안에 **다음 intent-filter 를 추가**합니다 (기존 LAUNCHER intent-filter 는 건드리지 마세요):

```xml
<intent-filter android:autoVerify="false">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="app.aquaworld" android:host="oauth" />
</intent-filter>
```

이게 있어야 카카오가 `app.aquaworld://oauth/kakao?code=...` 로 보내는 redirect 가 우리 앱으로 라우팅됩니다.

### 3-4. 환경변수 — Kakao REST API 키 추가

`.env` (루트) 에 다음 줄을 추가:

```
VITE_KAKAO_REST_API_KEY=<카카오 디벨로퍼스 앱의 REST API 키>
```

> 웹 OAuth 는 JS 키를 쓰지만, 네이티브 외부브라우저 OAuth 는 **REST API 키**가 필요합니다.
> 카카오 디벨로퍼스 → 내 애플리케이션 → 앱 설정 → 앱 키 → "REST API 키" 복사.

### 3-5. Firebase Hosting 으로 OAuth 중계 페이지 배포

> ⚠️ **중요:** 카카오 콘솔의 Redirect URI 는 `http(s)://` 만 받고 커스텀 스킴(`app.aquaworld://`)은 거절합니다.
> 그래서 Firebase Hosting 의 https URL 을 카카오에 등록하고, 그 페이지가 한 줄짜리 JS 로 `app.aquaworld://...` 로 다시 던지는 **중계 다리(bridge)** 패턴을 씁니다.
> 페이지 본체는 이미 [`public-hosting/oauth/kakao.html`](../public-hosting/oauth/kakao.html) 에 있고, [`firebase.json`](../firebase.json) 에 hosting 설정이 추가돼 있습니다.

PowerShell 에서:

```powershell
npm install -g firebase-tools     # 한 번만
firebase login                     # 브라우저로 Google 로그인
firebase deploy --only hosting     # public-hosting/ 의 oauth/kakao.html 만 업로드
```

배포가 끝나면 콘솔에 URL 이 찍힙니다 (대략 `https://aquaworld-bf2f4.web.app`).
중계 URL 은 **`https://aquaworld-bf2f4.web.app/oauth/kakao.html`** 가 됩니다.

> 다른 Firebase 프로젝트를 쓰면 `src/services/platform.ts` 의 `DEFAULT_BRIDGE` 를 수정하거나 `.env` 에 `VITE_KAKAO_NATIVE_REDIRECT=https://...` 로 덮어쓰세요.

### 3-6. Kakao Developer Console 설정

[https://developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → 해당 앱:

> 💡 우리는 **카카오 REST API OAuth + https 중계 URL** 흐름만 씁니다 (카카오 Android SDK 미사용).
> 따라서 카카오 콘솔에서 검증하는 항목은 **Redirect URI 일치뿐**이고, **"플랫폼 → Android 등록"·"키 해시"·"패키지명" 설정은 전부 불필요**합니다.

1. **제품 설정 → 카카오 로그인**
   - 상단 **"활성화 설정 ON"** 토글이 켜져 있어야 합니다 (꺼져 있으면 `KOE101`).
   - **Redirect URI** 에 추가:
     - `https://aquaworld-bf2f4.web.app/oauth/kakao.html`  ← **네이티브용 (https 중계)**
     - 기존 웹 redirect 도 그대로 유지 (`https://your-domain.com/`)
2. **제품 설정 → 카카오 로그인 → 동의항목**
   - `profile_nickname` 동의 체크
   - `profile_image` 동의 체크

> ❌ 다음은 **무시하세요** (콘솔 어딘가에 있어도 안 건드림): "앱 설정 → 플랫폼", "Android 플랫폼 등록", "패키지명", "키 해시", "마스터 키" 등. 우리 흐름과 무관합니다.

### 3-7. 디버그 키 SHA-1 지문 추출 (Firebase / Google 로그인용)

> 카카오용 키 해시는 §3-6 에서 설명했듯 우리 흐름에선 **필요 없습니다**.
> 이 단계는 **Firebase Console 에 Android 앱을 등록할 때 필요한 SHA-1 인증 지문**을 뽑는 용도입니다 (다음 §3-8 에서 사용).

PowerShell 에서 (`keytool` 은 JDK 설치 시 같이 들어옴):

```powershell
keytool -list -v -alias androiddebugkey -keystore "$env:USERPROFILE\.android\debug.keystore" -storepass android -keypass android
```

출력에서 **`SHA1:`** 로 시작하는 줄(예: `SHA1: A1:B2:C3:...`) 을 복사해 두세요.

> 이 키스토어는 Android Studio 가 첫 빌드 시 자동으로 만들어주거나, `npx cap add android` 후 첫 `gradlew assembleDebug` 시 생성됩니다. 파일이 아직 없다는 에러가 나면 일단 Android 빌드를 한 번 돌린 뒤 다시 실행하세요.

### 3-8. Firebase Console — Android 앱 등록

1. Firebase Console → 프로젝트 설정 → **Android 앱 추가**
   - 패키지명: `app.aquaworld`
   - SHA-1 인증 지문: 위에서 뽑은 디버그 키의 SHA-1 (`signingReport` 출력)
2. `google-services.json` 다운로드 → `android/app/google-services.json` 에 배치
3. `android/build.gradle` 의 buildscript 블록과 `android/app/build.gradle` 의 plugins 블록에 Google Services Gradle plugin 추가 (Capacitor 8 + Firebase 사용 시 표준 절차 — 자세한 건 Firebase 문서 참고)

> Google 로그인 사용 시: Firebase Auth 콘솔에서 Google provider 의 SHA-1 인증 지문도 같이 등록되어야 `signInWithRedirect` 가 작동합니다.

### 3-9. 푸시 알림 (FCM Android) — Firebase Console / 설정

> 웹 푸시(Web Push API + Service Worker)는 안드로이드 WebView 에서 동작하지 않으므로,
> 네이티브에서는 `@capacitor/push-notifications` 플러그인이 발급하는 **FCM Android 토큰**을 기존 `registerPushToken` Callable 로 등록합니다.
> 서버측 `admin.messaging().sendEachForMulticast()` 는 웹/안드로이드 토큰을 형식에 따라 자동 라우팅하므로 **Cloud Functions 코드 수정은 없습니다.**

#### 코드/플러그인 측 (이미 반영됨)

- `@capacitor/push-notifications` 의존성 추가
- `src/services/firebase/messaging.ts` 에 `isNative()` 분기:
  - `enablePush()` → `PushNotifications.requestPermissions()` → `register()` → `registration` 이벤트로 토큰 수신 → 기존 `registerPushToken` Callable 호출
  - `disablePush()` → 리스너 해제 + 서버측 토큰 제거 (`unregisterPushToken`)
  - 포그라운드 수신 (`pushNotificationReceived`) → 인앱 알림함(`useNotificationStore`) 적재
  - 알림 탭 (`pushNotificationActionPerformed`) → `data.link` 또는 기본 `/` 라우팅
- `android/app/src/main/AndroidManifest.xml` 에 다음이 들어있어야 합니다:

  ```xml
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

  <application ...>
    <!-- 기본 알림 아이콘 (단색 흰색 PNG; 미지정 시 회색 사각형) -->
    <meta-data
        android:name="com.google.firebase.messaging.default_notification_icon"
        android:resource="@drawable/ic_stat_notify" />
    <!-- 기본 채널 (Android 8+ 필수) -->
    <meta-data
        android:name="com.google.firebase.messaging.default_notification_channel_id"
        android:value="aquaworld_default" />
  </application>
  ```

#### 사용자가 해야 하는 것

1. **`google-services.json` 배치** — §3-8 에서 이미 했으면 OK. FCM 은 같은 파일을 공유합니다.
2. **Firebase Console → 프로젝트 설정 → 클라우드 메시징 (FCM API V1)** 활성화 여부 확인.
   - 좌측 메뉴 → Build → Cloud Messaging → API V1 사용 가능 상태인지.
   - 레거시 "Cloud Messaging API (Legacy)" 는 안 써도 됩니다.
3. **(선택) 알림 아이콘 추가** — `android/app/src/main/res/drawable-*/ic_stat_notify.png` (24dp 단색 흰색).
   - 없으면 시스템이 앱 아이콘 silhouette 으로 fallback 하지만 안드로이드 5+ 에서는 회색 사각형으로 보일 수 있습니다.
   - `npm run cap:assets` 생성물에는 포함되지 않으므로 별도 디자인 필요.
4. **테스트**:
   - 앱에서 로그인 → 설정 → "푸시 알림" 토글 ON → OS 권한 다이얼로그 허용
   - Firebase Console → Cloud Messaging → "테스트 메시지 보내기" 에 토큰 붙여넣고 발송
   - 또는 Firestore `users/{uid}.fcmTokens` 배열에 토큰이 잘 적재되는지 확인 후 부화 스케줄러(`notifyReadyHatches`) 자연 발송 대기

### 3-10. 실행

USB 로 폰 연결 + USB 디버깅 허용 후:

```powershell
adb devices                # 폰이 잡히는지 확인
npm run cap:run:android    # 빌드 → 설치 → 자동 실행
```

또는 Android Studio 에서 직접 실행:

```powershell
npm run cap:open:android   # Android Studio 열림 → Run 버튼
```

### 3-11. 핫리로드 개발 (선택)

PC 와 폰이 **같은 Wi-Fi** 상에 있어야 합니다.

```powershell
npm run cap:livereload:android
```

이 모드에선 폰이 dist 가 아니라 PC 의 Vite dev 서버를 직접 읽어, 코드 저장 → 폰에 즉시 반영.

### 3-12. Chrome DevTools 로 폰 WebView 디버깅

폰 USB 연결 상태에서 PC Chrome 주소창에 `chrome://inspect` 입력 → "Remote Target" 에 AquaWorld 가 보이면 **inspect** 클릭 → 콘솔/네트워크/Elements 전부 사용 가능.

---

## 4. 릴리스 빌드 (스토어 업로드용)

1. 릴리스 키스토어 생성 (한 번만 — **분실 시 앱 업데이트 불가**, 안전한 곳에 백업):

   ```powershell
   keytool -genkey -v -keystore aquaworld-release.jks -alias aquaworld -keyalg RSA -keysize 2048 -validity 10000
   ```

2. `android/app/build.gradle` 의 `signingConfigs.release` 에 키스토어 경로/비밀번호 연결 (또는 `~/.gradle/gradle.properties` 에 변수로 등록).
3. 릴리스 빌드:

   ```powershell
   cd android
   ./gradlew bundleRelease   # .aab 생성 (Play Console 업로드용)
   # 또는
   ./gradlew assembleRelease # .apk 생성 (사이드로드 테스트용)
   ```

4. 산출물 경로:
   - AAB: `android/app/build/outputs/bundle/release/app-release.aab`
   - APK: `android/app/build/outputs/apk/release/app-release.apk`

5. Play Console → 내부 테스트 트랙에 AAB 업로드 → 테스터에게 링크 공유.

> 릴리스 빌드의 SHA-1 도 Firebase / Kakao 콘솔에 추가로 등록해야 합니다 (디버그용과 별도).

---

## 5. 다음 단계 (Phase 2-5 통합)

이 단계는 코드에 아직 반영하지 않았고, Phase 2-5 에서 같이 진행합니다:

| 항목 | 패키지 | 비고 |
| --- | --- | --- |
| 광고 | `@capacitor-community/admob` | 웹 AdSense 대신 AdMob 단가가 5~10배. `src/services/ads/` 모듈에 native 분기 추가 예정 |
| 인앱결제 | `@capacitor-community/in-app-purchases` | Google Play Billing — 기존 `purchaseStarCoral` Cloud Function 에 영수증 검증 추가 필요 |
| 햅틱 | `@capacitor/haptics` | 부화/구매/먹이 인터랙션 진동 |
| 공유 | `@capacitor/share` | 포토 모드 — 현재 Web Share API 폴백 보강 |
| 앱 아이콘/스플래시 | `@capacitor/assets` (CLI) | 1024×1024 PNG 1장 → 전 해상도 자동 생성 |

---

## 6. iOS 빌드 (참고)

- **Mac + Xcode 필수**. Windows 에서는 빌드/실행 불가.
- 절차: `npx cap add ios` → Xcode 에서 signing 설정 → 실기기/시뮬레이터 실행.
- 우회: GitHub Actions macOS runner 또는 Ionic Appflow 같은 클라우드 빌드.

---

## 7. 트러블슈팅

| 증상 | 원인/해결 |
| --- | --- |
| `cap add android` 가 "Could not find an installed version of Gradle" | JDK 미설치 또는 `JAVA_HOME` 미설정 |
| 앱은 뜨는데 흰 화면 | `dist/` 빌드 안 된 상태로 sync — `npm run cap:build` 다시 |
| Kakao 로그인 후 앱으로 안 돌아옴 | AndroidManifest intent-filter 누락 또는 `app.aquaworld` 스킴 오타 |
| 설정에서 푸시 토글이 "미지원" 으로 회색 | `@capacitor/push-notifications` 미설치 / `google-services.json` 누락 / Firebase Console FCM 미활성 |
| 푸시 권한 다이얼로그가 안 뜸 (Android 13+) | AndroidManifest 의 `POST_NOTIFICATIONS` uses-permission 누락 |
| 토큰은 받았는데 알림이 안 옴 | Cloud Functions 가 `sendEachForMulticast` 로 보낸 응답에서 토큰별 실패 사유 확인 (대부분 `registration-token-not-registered` = 사용자가 앱 삭제) |
| 알림 아이콘이 회색 사각형 | `res/drawable-*/ic_stat_notify.png` (단색 흰색 24dp) 미배치 — 임시방편으론 `meta-data` 제거 시 앱 아이콘 fallback |
| Kakao Console 에서 "유효하지 않은 URL" | 카카오는 커스텀 스킴(`app.aquaworld://`) 등록 거절. **§3-5 의 https 중계 URL** 을 등록해야 함 |
| `KOE006` (잘못된 redirect_uri) | 카카오 콘솔 등록 URL 과 `kakaoRedirectUri()` 가 반환하는 URL 이 1글자라도 다름 — Firebase Hosting 도메인/경로 정확히 확인 |
| 중계 페이지까지는 가는데 앱이 안 열림 | AndroidManifest intent-filter 누락 또는 `app.aquaworld` 스킴 오타 |
| `auth/unauthorized-domain` (Google) | Firebase Console 에 Android SHA-1 미등록 또는 `google-services.json` 미배치 |
| 폰이 PC dev 서버에 못 붙음 | 같은 Wi-Fi 인지 확인, PC 방화벽에서 5173 포트 허용 |
| WebView 가 너무 느림 | `android.useLegacyBridge: false` 확인, Hermes 무관 (Capacitor 는 V8 사용), 모델/텍스처 압축 검토 |

---

> **— END —**
