package com.baregps.trackeditor;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BareFilesPlugin.class);
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View content = findViewById(android.R.id.content);
        content.setBackgroundColor(Color.rgb(245, 246, 242));
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, insets) -> {
            int systemTypes = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets bars = insets.getInsets(systemTypes);
            Insets keyboard = insets.getInsets(WindowInsetsCompat.Type.ime());
            // Physically constrain the WebView, including fixed and scrolling UI.
            // The keyboard replaces the bottom system inset rather than adding to it.
            view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
            // Forward zeroed insets (not CONSUMED), so WebView updates after
            // keyboard/navigation changes without applying the same space twice.
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(systemTypes | WindowInsetsCompat.Type.ime(), Insets.NONE)
                .build();
        });
        content.post(() -> ViewCompat.requestApplyInsets(content));
    }
}
