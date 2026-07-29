/**
 * 전역 연타(중복 탭) 차단.
 *
 * 같은 버튼을 COOLDOWN_MS 안에 다시 누르면 그 클릭을 통째로 삼킨다.
 * document 의 캡처 단계에 붙기 때문에 React 루트(#root)까지 이벤트가 내려가지 못하고,
 * 결과적으로 onClick 이 아예 호출되지 않는다 — 각 버튼을 고칠 필요가 없다.
 *
 * 이건 "물리적 연타"만 막는 1차 방어선이다. 서버 왕복이 COOLDOWN_MS 보다 길면
 * 그 뒤의 탭은 다시 통과하므로, 서버를 치는 액션은 useAsyncAction 으로 응답까지 잠근다.
 *
 * 빠른 반복 입력이 정상인 버튼(데코 회전/확대 등)은 data-tap-repeat 속성으로 제외한다.
 */

const COOLDOWN_MS = 350;
const INTERACTIVE = 'button, a, [role="button"]';

/** 요소별 마지막으로 통과시킨 클릭 시각. WeakMap 이라 DOM 이 사라지면 함께 수거된다. */
const lastAcceptedAt = new WeakMap<Element, number>();

function onClickCapture(e: MouseEvent): void {
  const target = e.target;
  if (!(target instanceof Element)) return;

  const el = target.closest(INTERACTIVE);
  if (!el || el.hasAttribute('data-tap-repeat')) return;

  const now = e.timeStamp || performance.now();
  const prev = lastAcceptedAt.get(el);
  if (prev !== undefined && now - prev < COOLDOWN_MS) {
    // 같은 버튼의 연타 — React 핸들러까지 내려보내지 않는다.
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  lastAcceptedAt.set(el, now);
}

let installed = false;

export function installTapGuard(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', onClickCapture, true);
}
