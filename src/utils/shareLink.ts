/**
 * 텍스트 + 링크 공유 (초대 링크용).
 *
 * photoNative.ts 는 파일(이미지) 공유라 경로가 다르다. 여기는 링크 전용이며
 * 공유 시트 → Web Share API → 클립보드 순으로 우아하게 떨어진다.
 */
import { isNative } from '@/services/platform';

export interface ShareLinkPayload {
  title: string;
  text: string;
  url: string;
}

/**
 * 'shared'  — 공유 시트로 넘어갔다(사용자가 닫은 경우 포함: 링크는 손에 쥐어졌다고 본다)
 * 'copied'  — 공유 시트가 없어 클립보드에 복사했다
 * 'failed'  — 둘 다 실패. 호출부는 링크를 화면에 직접 보여줘야 한다.
 */
export type ShareOutcome = 'shared' | 'copied' | 'failed';

/** 공유 시트 → Web Share API → 클립보드 순으로 시도한다. */
export async function shareText({ title, text, url }: ShareLinkPayload): Promise<ShareOutcome> {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, url, dialogTitle: title });
      return 'shared';
    } catch (e: unknown) {
      // 공유 시트를 닫으면 플러그인이 "Share canceled" 류 에러를 던진다 — 실패가 아니다.
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      if (msg.includes('cancel') || msg.includes('abort') || msg.includes('dismiss')) return 'shared';
      console.error('[shareLink] native share failed', e);
    }
  } else if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return 'shared';
      console.error('[shareLink] web share failed', e);
    }
  }

  return (await copyToClipboard(`${text}\n${url}`)) ? 'copied' : 'failed';
}

/** 클립보드 복사. 보안 컨텍스트가 아니면 execCommand 로 폴백. */
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // 아래 폴백으로
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
