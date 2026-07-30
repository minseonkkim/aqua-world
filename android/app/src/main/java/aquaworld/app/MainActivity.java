package aquaworld.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 브릿지가 super.onCreate 에서 초기화되므로 자체 플러그인은 그 전에 등록해야 잡힌다.
        registerPlugin(GallerySaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
