import { useEffect, useRef } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import {
  saveUserToFirestore,
  saveTankToFirestore,
  loadUserFromFirestore,
  loadUserTanks,
} from '@/services/firebase/firestore';
import { isConfigured } from '@/services/firebase/config';

const DEBOUNCE_MS = 2000;

let reverting = false;

async function revertFromServer(uid: string) {
  if (reverting) return;
  reverting = true;
  try {
    const [serverUser, serverTanks] = await Promise.all([
      loadUserFromFirestore(uid),
      loadUserTanks(uid),
    ]);
    // 서버 값을 Zustand(=localStorage)에 먼저 기록한 뒤 리로드해서
    // 3D 씬 등 명령형 렌더링 화면까지 전부 서버 진실값으로 다시 그린다.
    if (serverUser) useUserStore.getState().setUser(serverUser);
    useTankStore.getState().setTanks(serverTanks);
    console.warn('[Sync] 서버 규칙 위반 감지 — 서버 값으로 복원 후 새로고침합니다.');
    window.location.reload();
  } catch (err) {
    reverting = false;
    console.error('[Sync] 서버 복원 실패:', err);
  }
}

function isPermissionDenied(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'permission-denied'
  );
}

export function useFirestoreSync() {
  const user = useUserStore(s => s.user);
  const tanks = useTankStore(s => s.tanks);

  const userTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tankTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isConfigured || !user || user.id.startsWith('guest_')) return;
    const uid = user.id;

    if (userTimer.current) clearTimeout(userTimer.current);
    userTimer.current = setTimeout(() => {
      saveUserToFirestore(user).catch(err => {
        if (isPermissionDenied(err)) revertFromServer(uid);
        else console.error(err);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (userTimer.current) clearTimeout(userTimer.current);
    };
  }, [user]);

  useEffect(() => {
    const uid = useUserStore.getState().user?.id;
    if (!isConfigured || !uid || uid.startsWith('guest_')) return;

    if (tankTimer.current) clearTimeout(tankTimer.current);
    tankTimer.current = setTimeout(() => {
      Promise.all(tanks.map(tank => saveTankToFirestore(tank, uid))).catch(err => {
        if (isPermissionDenied(err)) revertFromServer(uid);
        else console.error(err);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (tankTimer.current) clearTimeout(tankTimer.current);
    };
  }, [tanks]);
}
