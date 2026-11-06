package com.baregps.trackeditor;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BareFilesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
