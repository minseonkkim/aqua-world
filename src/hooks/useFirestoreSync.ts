import { useEffect, useRef } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useTankStore } from '@/store/useTankStore';
import { saveUserToFirestore, saveTankToFirestore } from '@/services/firebase/firestore';
import { isConfigured } from '@/services/firebase/config';

const DEBOUNCE_MS = 2000;

/**
 * Zustand 상태가 바뀔 때마다 Firestore에 debounce 저장.
 * 게스트 유저(guest_ prefix)는 저장 안 함.
 */
export function useFirestoreSync() {
  const user = useUserStore(s => s.user);
  const tanks = useTankStore(s => s.tanks);

  const userTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tankTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isConfigured || !user || user.id.startsWith('guest_')) return;

    if (userTimer.current) clearTimeout(userTimer.current);
    userTimer.current = setTimeout(() => {
      saveUserToFirestore(user).catch(console.error);
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
      tanks.forEach(tank => saveTankToFirestore(tank, uid).catch(console.error));
    }, DEBOUNCE_MS);

    return () => {
      if (tankTimer.current) clearTimeout(tankTimer.current);
    };
  }, [tanks]);
}
