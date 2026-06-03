import { Howl } from 'howler';

export type SFXKey =
  | 'click'
  | 'tab'
  | 'modal_open'
  | 'modal_close'
  | 'confirm'
  | 'hatch'
  | 'reward'
  | 'notify'
  | 'shutter'
  | 'place'
  | 'error'
  | 'coin';

const BASE = import.meta.env.BASE_URL || '/';

const SFX_SRC: Record<SFXKey, string> = {
  click: `${BASE}audio/sfx/click.ogg`,
  tab: `${BASE}audio/sfx/tab.ogg`,
  modal_open: `${BASE}audio/sfx/modal_open.ogg`,
  modal_close: `${BASE}audio/sfx/modal_close.ogg`,
  confirm: `${BASE}audio/sfx/confirm.ogg`,
  hatch: `${BASE}audio/sfx/hatch.wav`,
  reward: `${BASE}audio/sfx/reward.ogg`,
  notify: `${BASE}audio/sfx/notify.ogg`,
  shutter: `${BASE}audio/sfx/shutter.wav`,
  place: `${BASE}audio/sfx/place.ogg`,
  error: `${BASE}audio/sfx/error.ogg`,
  coin: `${BASE}audio/sfx/coin.wav`,
};

// Kenney/freesound 파일별 라우드니스가 들쭉날쭉해서 키별로 보정.
const SFX_GAIN: Record<SFXKey, number> = {
  click: 0.4,
  tab: 0.5,
  modal_open: 0.5,
  modal_close: 0.5,
  confirm: 0.55,
  hatch: 0.7,
  reward: 0.65,
  notify: 0.5,
  shutter: 0.6,
  place: 0.55,
  error: 0.5,
  coin: 0.55,
};

const BGM_SRC = `${BASE}audio/bgm/main.mp3`;
const BGM_TARGET_VOL = 0.25;
const BGM_FADE_MS = 1500;

const sfxCache: Partial<Record<SFXKey, Howl>> = {};
let bgm: Howl | null = null;
let bgmEnabled = true;
let sfxEnabled = true;
let unlocked = false;
let visibilityBound = false;

function loadSfx(key: SFXKey): Howl {
  let h = sfxCache[key];
  if (!h) {
    h = new Howl({
      src: [SFX_SRC[key]],
      volume: SFX_GAIN[key],
      preload: true,
    });
    sfxCache[key] = h;
  }
  return h;
}

export function playSFX(key: SFXKey, rate = 1): void {
  if (!sfxEnabled) return;
  try {
    const h = loadSfx(key);
    const id = h.play();
    if (rate !== 1) h.rate(rate, id);
  } catch {
    // 사일런트 실패 (자동재생 차단 등) — UX에 영향 없음
  }
}

export function setSfxEnabled(enabled: boolean): void {
  sfxEnabled = enabled;
}

export function setBgmEnabled(enabled: boolean): void {
  bgmEnabled = enabled;
  if (!bgm) {
    if (enabled && unlocked) startBGM();
    return;
  }
  // 토글 시엔 pause/play 대신 볼륨만 페이드 — html5 audio의 pause→play 경합 회피.
  // 실제 pause는 visibilitychange가 담당해 배터리 절약.
  if (!bgm.playing()) bgm.play();
  bgm.fade(bgm.volume(), enabled ? BGM_TARGET_VOL : 0, enabled ? 600 : 400);
}

export function startBGM(): void {
  if (!bgmEnabled) return;
  if (!bgm) {
    bgm = new Howl({
      src: [BGM_SRC],
      loop: true,
      volume: 0,
      html5: true, // 스트리밍 — 큰 파일도 빨리 시작
    });
  }
  if (!bgm.playing()) bgm.play();
  bgm.fade(bgm.volume(), BGM_TARGET_VOL, BGM_FADE_MS);
}

/** 첫 user gesture에서 호출 — iOS/Android 자동재생 정책 우회 */
export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  if (bgmEnabled) startBGM();
  bindVisibility();
}

function bindVisibility(): void {
  if (visibilityBound) return;
  visibilityBound = true;
  document.addEventListener('visibilitychange', () => {
    if (!bgm) return;
    if (document.hidden) {
      bgm.pause();
    } else if (bgmEnabled) {
      if (!bgm.playing()) bgm.play();
    }
  });
}
