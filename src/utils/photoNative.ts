// 포토 모드 — 네이티브(Capacitor) 저장/공유
// 웹에서는 절대 호출되지 않는다: photoCompose.ts 가 isNative() 로 분기 후 동적 import.
//
// 웹(브라우저)에선 navigator.share / <a download> 가 동작하지만
// Capacitor WebView(Android)에선 둘 다 무반응이라 네이티브 플러그인으로 처리한다.
//  - 저장: @capacitor-community/media → 갤러리(카메라 롤)에 저장
//  - 공유: @capacitor/filesystem 캐시 파일 + @capacitor/share → 네이티브 공유 시트
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Media } from '@capacitor-community/media';
import { platformName } from '@/services/platform';

// 갤러리에 표시될 앨범 이름. Android 에선 getExternalMediaDirs 하위 폴더로 생성된다
// (앱 전용 미디어 경로 — 별도 저장소 권한 불필요, MediaStore 가 자동 인덱싱).
const ALBUM_NAME = 'AquaWorld';

/** Blob → data URL (data:image/png;base64,... 프리픽스 포함). Media.savePhoto 입력용. */
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

/** 네이티브 갤러리 저장. 성공 시 true. */
export async function saveToGalleryNative(blob: Blob): Promise<boolean> {
  try {
    const dataUrl = await blobToDataUrl(blob);
    const fileName = `aquaworld_${Date.now()}`; // 확장자는 플러그인이 mime 로 추론

    if (platformName() === 'android') {
      // Android: savePhoto 는 대상 앨범(디렉터리)이 반드시 존재해야 한다.
      // getExternalMediaDirs 기반이라 저장소 권한이 필요 없다.
      const { path } = await Media.getAlbumsPath();
      const albumIdentifier = `${path}/${ALBUM_NAME}`;
      try {
        await Media.createAlbum({ name: ALBUM_NAME });
      } catch {
        // 이미 존재하면 reject — 무시하고 진행
      }
      await Media.savePhoto({ path: dataUrl, albumIdentifier, fileName });
    } else {
      // iOS/기타: 앨범 지정 없이 카메라 롤에 저장
      await Media.savePhoto({ path: dataUrl, fileName });
    }
    return true;
  } catch (e) {
    console.error('[PhotoMode] native save failed', e);
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
