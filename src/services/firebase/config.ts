import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? '',
};

const isConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_api_key_here';

/** 웹 푸시(FCM) VAPID 공개키. Firebase 콘솔 → 프로젝트 설정 → Cloud Messaging → 웹 푸시 인증서. */
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? '';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;

if (isConfigured) {
  const alreadyInitialized = getApps().length > 0;
  app = alreadyInitialized ? getApps()[0]! : initializeApp(firebaseConfig);
  auth = getAuth(app);
  // initializeFirestore는 최초 1회만 호출 가능 — HMR 재호출 방지
  db = alreadyInitialized
    ? getFirestore(app)
    : initializeFirestore(app, { ignoreUndefinedProperties: true });
  storage = getStorage(app);
  functions = getFunctions(app, 'asia-northeast3');
} else {
  console.warn('[Firebase] .env 파일에 실제 Firebase 설정값을 입력해주세요. 현재 게스트 모드로 동작합니다.');
}

export { app, auth, db, storage, functions, isConfigured, firebaseConfig, vapidKey };
