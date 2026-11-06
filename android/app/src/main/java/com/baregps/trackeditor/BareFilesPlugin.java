package com.baregps.trackeditor;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.database.Cursor;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "BareFiles")
public class BareFilesPlugin extends Plugin {
    private final JSArray incoming = new JSArray();
    private final JSArray errors = new JSArray();
    private byte[] exportData;
    private boolean actionOpen;
    private static final int MAX_BYTES = 15 * 1024 * 1024;

    @Override public void load() { bridge.execute(() -> receive(getActivity().getIntent())); }
    @Override protected void handleOnNewIntent(Intent intent) { bridge.execute(() -> receive(intent)); }

    private synchronized void receive(Intent intent) {
        if (intent == null || intent.getBooleanExtra("baregpsHandled", false)) return;
        String action = intent.getAction();
        if (!Intent.ACTION_VIEW.equals(action) && !Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return;
        intent.putExtra("baregpsHandled", true);
        List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_VIEW.equals(action) && intent.getData() != null) uris.add(intent.getData());
        else if (Intent.ACTION_SEND.equals(action)) { Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM); if (uri != null) uris.add(uri); }
        else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) { ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM); if (list != null) uris.addAll(list); }
        for (Uri uri : uris.subList(0, Math.min(20, uris.size()))) {
            try { incoming.put(read(uri)); } catch (Exception e) { errors.put("Could not open GPX: " + e.getMessage()); }
        }
        if (uris.size() > 20) errors.put("Only the first 20 files were opened. Open the others separately.");
        notifyListeners("filesOpened", new JSObject(), true);
    }
    @PluginMethod public synchronized void pending(PluginCall call) {
        JSObject result = new JSObject();
        try {
            result.put("files", new JSArray(incoming.toList())); result.put("errors", new JSArray(errors.toList()));
            while (incoming.length() > 0) incoming.remove(0);
            while (errors.length() > 0) errors.remove(0);
            call.resolve(result);
        } catch (org.json.JSONException e) { call.reject("Could not read incoming GPX files. Please open them again from Files.", e); }
    }
    @PluginMethod public void pick(PluginCall call) {
        if (actionOpen) { call.reject("A file action is already open."); return; }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        actionOpen = true;
        try { startActivityForResult(call, intent, "picked"); }
        catch (Exception e) { actionOpen = false; call.reject("No Files app is available to open GPX files.", e); }
    }
    @ActivityCallback private void picked(PluginCall call, ActivityResult result) {
        actionOpen = false;
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) { call.reject("File action cancelled.", "CANCELLED"); return; }
        Intent data = result.getData();
        if (data == null) { call.reject("No files were returned by the Files app."); return; }
        try {
            JSArray files = new JSArray();
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                if (count > 20) throw new IOException("Choose up to 20 files at a time.");
                long bytes = 0;
                for (int i = 0; i < count; i++) {
                    JSObject file = read(data.getClipData().getItemAt(i).getUri());
                    bytes += file.getString("data", "").length() * 3L / 4;
                    if(bytes > 30 * 1024 * 1024) throw new IOException("Choose up to 30 MB of files at a time.");
                    files.put(file);
                }
            } else if (data.getData() != null) files.put(read(data.getData()));
            JSObject response = new JSObject(); response.put("files", files); call.resolve(response);
        } catch (Exception e) { call.reject("Could not read the selected files: " + e.getMessage(), e); }
    }
    private JSObject read(Uri uri) throws IOException {
        String name = "Imported track.gpx";
        try (Cursor cursor = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameCol = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME), sizeCol = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameCol >= 0 && !cursor.isNull(nameCol)) name = cursor.getString(nameCol);
                if (sizeCol >= 0 && !cursor.isNull(sizeCol) && cursor.getLong(sizeCol) > MAX_BYTES) throw new IOException(name + " is over 15 MB.");
            }
        }
        try (InputStream input = getContext().getContentResolver().openInputStream(uri); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IOException("The file provider did not return a readable file.");
            byte[] buffer = new byte[8192]; int bytes;
            while ((bytes = input.read(buffer)) != -1) {
                if (output.size() + bytes > MAX_BYTES) throw new IOException(name + " is over 15 MB.");
                output.write(buffer, 0, bytes);
            }
            JSObject file = new JSObject(); file.put("name", name); file.put("data", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)); return file;
        }
    }
    @PluginMethod public void save(PluginCall call) {
        if (actionOpen) { call.reject("A file action is already open."); return; }
        try {
            String encoded = call.getString("data"), name = call.getString("name", "BareGPS track.gpx");
            if (encoded == null) throw new IOException("The GPX file was not prepared.");
            exportData = Base64.decode(encoded, Base64.DEFAULT);
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("application/gpx+xml"); intent.putExtra(Intent.EXTRA_TITLE, name);
            actionOpen = true; startActivityForResult(call, intent, "saved");
        } catch (Exception e) { actionOpen = false; exportData = null; call.reject("Could not prepare GPX export: " + e.getMessage(), e); }
    }
    @ActivityCallback private void saved(PluginCall call, ActivityResult result) {
        actionOpen = false;
        try {
            if (call == null) return;
            if (result.getResultCode() != Activity.RESULT_OK) { call.reject("File action cancelled.", "CANCELLED"); return; }
            Uri uri = result.getData() == null ? null : result.getData().getData();
            if (uri == null || exportData == null) { call.reject("No save location was returned. Try saving again."); return; }
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IOException("The location could not be written.");
                output.write(exportData); output.flush();
            }
            JSObject response = new JSObject(); response.put("saved", true); call.resolve(response);
        } catch (Exception e) { if (call != null) call.reject("Could not save GPX: " + e.getMessage() + ". Try a different location.", e); }
        finally { exportData = null; }
    }
}
