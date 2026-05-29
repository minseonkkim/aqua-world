import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './config';
import { User, Tank } from '@/types';

// ─── User ────────────────────────────────────────────────────────────────────

export async function loadUserFromFirestore(uid: string): Promise<User | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as User;
}

// 서버 권위 필드 — 클라이언트는 절대 쓰지 않는다(보안 규칙으로도 차단됨).
const USER_SERVER_OWNED_FIELDS = [
  'pearl',
  'starCoral',
  'inventory',
  'level',
  'experience',
  'loginStreak',
  'lastLoginAt',
  'collectedSpecies',
  'feedCountToday',
  'lastFeedResetAt',
  'claimedCompendiumMilestones',
] as const;

export async function saveUserToFirestore(user: User): Promise<void> {
  if (!db || user.id.startsWith('guest_')) return;
  // 꾸미기/튜토리얼 등 클라 소유 필드만 저장 (경제 필드는 서버가 소유)
  const payload: Record<string, unknown> = { ...user };
  for (const f of USER_SERVER_OWNED_FIELDS) delete payload[f];
  await setDoc(doc(db, 'users', user.id), payload, { merge: true });
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

export async function saveTankToFirestore(tank: Tank, ownerId: string): Promise<void> {
  if (!db) return;
  // fish(성장·보유 어종)는 서버 소유 — 클라는 꾸미기/환경/조명만 저장
  const { fish: _fish, ...rest } = tank;
  void _fish;
  await setDoc(doc(db, 'tanks', tank.id), { ...rest, ownerId }, { merge: true });
}
