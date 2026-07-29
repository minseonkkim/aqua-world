import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * 비동기 액션을 "결과가 나올 때까지" 잠그는 훅.
 *
 * 반환된 run 을 onClick 에 그대로 물리면, 핸들러가 Promise 를 돌려주는 동안
 * 재진입이 무시된다. 잠금은 state 가 아니라 ref 로 건다 — disabled={pending} 은
 * 리렌더 후에야 DOM 에 반영돼서, 첫 탭과 리렌더 사이에 들어온 두 번째 탭을 못 막는다.
 * (LoginPage 가 loginInFlightRef 로 같은 문제를 이미 겪었다.)
 *
 * pending 은 UI 표시용(버튼 흐리게/문구 변경)으로만 쓴다.
 *
 * 동기 핸들러는 잠글 이유가 없으므로 그대로 통과시킨다 — 연타는 tapGuard 가 막는다.
 * 서버를 치는 핸들러라면 optimistic()/서버 호출의 Promise 를 꼭 return 해야
 * 왕복이 끝날 때까지 잠긴다.
 */
export function useAsyncAction<A extends unknown[]>(
  fn: (...args: A) => unknown,
): [run: (...args: A) => void, pending: boolean] {
  // 최신 클로저를 커밋 후에 갱신한다(렌더 중 변경 금지). run 은 안정적이라
  // memo 된 자식에 그대로 넘겨도 리렌더를 유발하지 않는다.
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });

  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback((...args: A) => {
    if (inFlight.current) return;

    // 동기 예외는 잠금을 남기지 않고 그대로 올려보낸다(try/finally 없이 자연스럽게 전파).
    const result = fnRef.current(...args);

    const thenable = result as PromiseLike<unknown> | null;
    if (!thenable || typeof thenable.then !== 'function') {
      return; // 동기 핸들러 — 잠글 것이 없다
    }

    inFlight.current = true;
    setPending(true);
    const settle = () => {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    };
    // .finally 대신 then(성공, 실패) — 실패는 그대로 다시 던져
    // 기존처럼 미처리 거부로 남긴다(Sentry 리포팅 유지). 거부가 두 번 새지 않는다.
    thenable.then(settle, (err) => {
      settle();
      return Promise.reject(err);
    });
  }, []);

  return [run, pending];
}
