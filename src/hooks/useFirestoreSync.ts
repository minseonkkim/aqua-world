import { useEffect, useRef } from 'react';
import { useTankStore } from '@/store/useTankStore';
import { saveTankCosmetics, isCloudUser } from '@/services/firebase/functions';

const DEBOUNCE_MS = 2000;

/**
 * 수조 외형(데코·조명·환경·프리셋·청결도)이 바뀔 때마다 서버(Cloud Functions)에
 * debounce 저장한다. 과거엔 클라가 Firestore 에 직접 썼지만(보안 규칙 우회), 이제는
 * 모든 쓰기를 saveTankCosmetics 한 곳으로 모은다 — 데코 인벤토리 소비/환불은 서버가
 * delta 로 재계산(권위)하고, Firestore 직접 쓰기는 보안 규칙으로 전면 차단된다.
 *
 * 경제/어종(pearl·fish·inventory 등)은 기존 전용 함수가 즉시 저장하므로 여기서 다루지 않는다.
 * 게스트(guest_)와 미설정 환경은 로컬 persist 만으로 충분해 서버를 호출하지 않는다.
 */
export function useFirestoreSync() {
  const tanks = useTankStore(s => s.tanks);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isCloudUser()) return;
    // 클라우드 유저의 수조 외형만 서버로 동기화. 전체 스냅샷이라 서버가 직전 저장본과
    // 비교해 인벤토리를 가감하므로, 디바운스로 합쳐지거나 순서가 바뀌어도 수렴한다.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      for (const tank of useTankStore.getState().tanks) {
        saveTankCosmetics({
          tankId: tank.id,
          decorations: tank.decorations,
          decorationPresets: tank.decorationPresets ?? [],
          lightMode: tank.lightMode,
          environment: tank.environment,
          cleanliness: tank.cleanliness,
          lastCleanlinessTickAt: tank.lastCleanlinessTickAt,
        }).catch(console.error);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [tanks]);

  // user 문서(decorationInventory·tutorialStep 등)는 더 이상 클라가 직접 쓰지 않는다.
  // decorationInventory → purchaseDecoration / saveTankCosmetics(서버 권위),
  // tutorialStep 완료 신호 → setTutorialStep(서버) 로 각각 영속화된다.
}
