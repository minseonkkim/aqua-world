import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'aquaworld.app',
  appName: 'AquaWorld',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    FirebaseAuthentication: {
      // JS SDK(firebase/auth) 가 세션의 단일 소스가 되도록 네이티브 자동 로그인은 건너뛴다.
      // signInWithGoogle() 이 반환한 ID 토큰을 signInWithCredential 로 직접 넘긴다.
      skipNativeAuth: true,
      providers: ['google.com'],
    },
    SplashScreen: {
      launchShowDuration: 2500,
      backgroundColor: '#0a1628',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a1628',
    },
    AdMob: {
      // 개발 빌드는 항상 테스트 광고. 실서비스 빌드에선 false 로 토글하고
      // AdMob 콘솔에서 발급받은 실제 ad unit id 만 사용해야 한다 (개인 계정 정지 위험).
      initializeForTesting: true,
      // Logcat 에 'Use AdRequest.Builder.addTestDevice(...) to get test ads' 로그가 나오는
      // 단말 ID 를 여기 넣어 두면 실 광고 단위도 테스트 모드로 받게 된다.
      testingDevices: [],
    },
  },
};

export default config;
