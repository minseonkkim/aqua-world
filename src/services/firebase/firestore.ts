import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './config';
import { User, Tank } from '@/types';

// 쓰기는 전부 Cloud Functions(서버 권위)를 거치고, 클라이언트 직접 쓰기는 보안 규칙으로
// 전면 차단된다. 여기서는 읽기(부트스트랩 복원)만 제공한다.
// - 경제/어종: bootstrapUser·feedFish·placeFish 등 전용 함수
// - 꾸미기/청결도/데코 인벤토리: saveTankCosmetics
// - 튜토리얼 완료 신호: setTutorialStep

// ─── User ────────────────────────────────────────────────────────────────────

export async function loadUserFromFirestore(uid: string): Promise<User | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as User;
}

// ─── Tank ────────────────────────────────────────────────────────────────────

export async function loadUserTanks(uid: string): Promise<Tank[]> {
  if (!db) return [];
  const q = query(collection(db, 'tanks'), where('ownerId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    // ownerId는 Firestore 전용 필드 — Tank 타입에서 제거
    const { ownerId: _o, ...tank } = data as Tank & { ownerId: string };
    void _o;
    return tank;
  });
}
