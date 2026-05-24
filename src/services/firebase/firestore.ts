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

export async function saveUserToFirestore(user: User): Promise<void> {
  if (!db || user.id.startsWith('guest_')) return;
  await setDoc(doc(db, 'users', user.id), user, { merge: true });
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
  await setDoc(doc(db, 'tanks', tank.id), { ...tank, ownerId }, { merge: true });
}
