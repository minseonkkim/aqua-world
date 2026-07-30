package aquaworld.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.annotation.RequiresApi;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Locale;

/**
 * 포토 모드 사진을 기기 갤러리(Pictures/AquaWorld)에 저장한다.
 *
 * @capacitor-community/media 를 쓰지 않는 이유: 그 플러그인은 저장 위치가
 * getExternalMediaDirs() — 즉 Android/media/<pkg>/ 라는 앱 전용 경로로 고정이다.
 * 앱을 지우면 사진도 같이 사라지고, 일부 갤러리 앱은 Android/ 하위를 아예 숨긴다.
 * MediaStore 에 직접 넣으면 진짜 갤러리에 들어가고 앱 삭제와 무관하게 남는다.
 */
@CapacitorPlugin(
    name = "GallerySaver",
    permissions = {
        // Android 10(Q)+ 는 scoped storage 라 권한이 아예 필요 없다.
        // 9 이하에서만 공용 Pictures 에 직접 써야 해서 요청한다.
        @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = GallerySaverPlugin.LEGACY_STORAGE)
    }
)
public class GallerySaverPlugin extends Plugin {

    static final String LEGACY_STORAGE = "legacyStorage";

    private static final String ALBUM = "AquaWorld";
    private static final String MIME_PNG = "image/png";

    // JS 쪽에서 실패 사유별로 Sentry 태그를 나누기 때문에 코드를 구분해서 던진다.
    private static final String EC_ARGUMENT = "argumentError";
    private static final String EC_ACCESS_DENIED = "accessDenied";
    private static final String EC_FILESYSTEM = "filesystemError";

    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q || hasLegacyPermission()) {
            saveInternal(call);
            return;
        }
        requestPermissionForAlias(LEGACY_STORAGE, call, "legacyPermissionCallback");
    }

    @PermissionCallback
    private void legacyPermissionCallback(PluginCall call) {
        if (!hasLegacyPermission()) {
            call.reject("저장소 권한이 거부되었습니다", EC_ACCESS_DENIED);
            return;
        }
        saveInternal(call);
    }

    private boolean hasLegacyPermission() {
        return getPermissionState(LEGACY_STORAGE) == PermissionState.GRANTED;
    }

    private void saveInternal(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        if (dataUrl == null || !dataUrl.startsWith("data:")) {
            call.reject("dataUrl 이 필요합니다", EC_ARGUMENT);
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("dataUrl 을 디코드하지 못했습니다", EC_ARGUMENT);
            return;
        }

        String fileName = call.getString("fileName", "aquaworld_" + System.currentTimeMillis());
        if (fileName == null || fileName.isEmpty()) {
            fileName = "aquaworld_" + System.currentTimeMillis();
        }
        // 확장자가 없으면 갤러리가 mime 을 못 잡는다. 합성 결과는 항상 PNG.
        if (!fileName.toLowerCase(Locale.ROOT).endsWith(".png")) {
            fileName = fileName + ".png";
        }

        try {
            Uri uri = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? saveViaMediaStore(bytes, fileName)
                : saveViaPublicDir(bytes, fileName);

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            call.resolve(result);
        } catch (IOException e) {
            call.reject("사진을 저장하지 못했습니다: " + e.getMessage(), EC_FILESYSTEM);
        }
    }

    /**
     * Android 10+ 표준 경로. MediaStore 가 곧 갤러리 인덱스라 별도 미디어 스캔이 필요 없고,
     * 앱을 삭제해도 사진이 남는다.
     */
    @RequiresApi(Build.VERSION_CODES.Q)
    private Uri saveViaMediaStore(byte[] bytes, String fileName) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();

        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
        values.put(MediaStore.Images.Media.MIME_TYPE, MIME_PNG);
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + ALBUM);
        // 쓰는 중인 반쪽짜리 파일이 갤러리에 노출되지 않도록 잠가둔다.
        values.put(MediaStore.Images.Media.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IOException("MediaStore 레코드를 만들지 못했습니다");
        }

        try (OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) {
                throw new IOException("출력 스트림을 열지 못했습니다");
            }
            out.write(bytes);
        } catch (IOException e) {
            // 실패한 레코드를 두면 갤러리에 빈 항목이 영구히 남는다.
            resolver.delete(uri, null, null);
            throw e;
        }

        values.clear();
        values.put(MediaStore.Images.Media.IS_PENDING, 0);
        resolver.update(uri, values, null, null);
        return uri;
    }

    /**
     * Android 9 이하. scoped storage 이전이라 공용 Pictures 에 직접 쓴다.
     * 이 경로는 MediaStore 가 알아서 훑지 않으므로 스캔을 명시적으로 요청해야 갤러리에 뜬다.
     */
    @SuppressWarnings("deprecation") // getExternalStoragePublicDirectory 는 API 29 에서 deprecated — 여긴 28 이하 전용
    private Uri saveViaPublicDir(byte[] bytes, String fileName) throws IOException {
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), ALBUM);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("앨범 폴더를 만들지 못했습니다: " + dir);
        }

        File file = new File(dir, fileName);
        try (OutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }

        MediaScannerConnection.scanFile(
            getContext(),
            new String[] { file.getAbsolutePath() },
            new String[] { MIME_PNG },
            null
        );
        return Uri.fromFile(file);
    }
}
