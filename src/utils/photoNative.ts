// 포토 모드 — 네이티브(Capacitor) 저장/공유
// 웹에서는 절대 호출되지 않는다: photoCompose.ts 가 isNative() 로 분기 후 동적 import.
//
// 웹(브라우저)에선 navigator.share / <a download> 가 동작하지만
// Capacitor WebView(Android)에선 둘 다 무반응이라 네이티브 플러그인으로 처리한다.
//  - 저장: GallerySaver(자체 플러그인) → MediaStore 로 Pictures/AquaWorld 에 저장
//  - 공유: @capacitor/filesystem 캐시 파일 + @capacitor/share → 네이티브 공유 시트
import { registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { platformName } from '@/services/platform';

/**
 * 구현: android/app/src/main/java/aquaworld/app/GallerySaverPlugin.java
 * 현재 네이티브 타깃이 Android 뿐이라 Android 구현만 있다 — iOS 를 추가하면 같은 이름으로 붙여야 한다.
 */
interface GallerySaverPlugin {
  /** 갤러리(Pictures/AquaWorld)에 PNG 저장. 실패 시 사유 code 를 실어 reject 한다. */
  save(options: { dataUrl: string; fileName?: string }): Promise<{ uri: string }>;
}

const GallerySaver = registerPlugin<GallerySaverPlugin>('GallerySaver');

/** Blob → data URL (data:image/png;base64,... 프리픽스 포함). GallerySaver.save 입력용. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader 실패'));
    reader.readAsDataURL(blob);
  });
}

/** data URL 에서 base64 본문만 (Filesystem.writeFile 입력용 — 프리픽스 제거). */
function stripBase64Prefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

/** 캐시에 PNG 파일로 쓰고 file:// URI 를 반환 (Share 플러그인 입력용). */
async function writeToCache(blob: Blob): Promise<string> {
  const fileName = `aquaworld_${Date.now()}.png`;
  const dataUrl = await blobToDataUrl(blob);
  await Filesystem.writeFile({
    path: fileName,
    data: stripBase64Prefix(dataUrl),
    directory: Directory.Cache,
  });
  const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
  return uri;
}

let sentryPromise: Promise<typeof import('@sentry/react')> | null = null;
function getSentry() {
  if (!sentryPromise) sentryPromise = import('@sentry/react');
  return sentryPromise;
}

/**
 * 저장 실패는 사용자에게 "저장 실패" 토스트 한 줄로만 보이고 끝난다.
 * 사유(권한 거부/용량 부족/MediaStore 거절)를 남기지 않으면 실기기에서 추적할 방법이 없어
 * 플러그인이 reject 에 실어 보낸 code 를 태그로 올려 사유별로 묶이게 한다.
 */
function reportSaveFailure(e: unknown): void {
  const err = e as { message?: string; code?: string } | null;
  const code = err?.code ?? 'unknown';
  console.error('[PhotoMode] native save failed', e);
  void getSentry()
    .then(S =>
      S.captureMessage(`[photo] gallery save failed: ${code}`, {
        level: 'warning',
        tags: { photo_save_code: code },
        extra: { message: err?.message ?? String(e), platform: platformName() },
      }),
    )
    .catch(() => {});
}

/** 네이티브 갤러리 저장. 성공 시 true. */
export async function saveToGalleryNative(blob: Blob): Promise<boolean> {
  try {
    const dataUrl = await blobToDataUrl(blob);
    await GallerySaver.save({ dataUrl, fileName: `aquaworld_${Date.now()}.png` });
    return true;
  } catch (e: unknown) {
    reportSaveFailure(e);
    return false;
  }
}

/** 네이티브 공유 시트. 사용자가 닫으면 'cancelled'. */
export async function sharePhotoNative(blob: Blob): Promise<'shared' | 'cancelled' | 'error'> {
  try {
    const uri = await writeToCache(blob);
    await Share.share({
      title: 'AquaWorld',
      text: '내 수족관 한 컷! 🐟',
      files: [uri],
      dialogTitle: '사진 공유',
    });
    return 'shared';
  } catch (e: unknown) {
    // 공유 시트를 닫으면 플러그인이 "Share canceled" 류 에러를 던진다.
    const msg = e instanceof Error ? e.message.toLowerCase() : '';
    if (msg.includes('cancel') || msg.includes('abort') || msg.includes('dismiss')) return 'cancelled';
    console.error('[PhotoMode] native share failed', e);
    return 'error';
  }
}
