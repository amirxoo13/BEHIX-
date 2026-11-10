package ir.behix.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Saves an exported film from the app cache (Cache/exports/...) into the shared gallery under Movies/BEHIX.
 * Uses MediaStore with RELATIVE_PATH, so Android 10+ needs no storage permission. Older Android versions are
 * reported as unavailable and the web layer falls back to the share sheet.
 */
@CapacitorPlugin(name = "BehixMedia")
public class MediaSavePlugin extends Plugin {

    @PluginMethod
    public void saveVideo(PluginCall call) {
        String path = call.getString("path");
        String name = call.getString("name", "behix.mp4");
        String mime = call.getString("mime", "video/mp4");
        if (path == null || path.isEmpty()) {
            call.reject("path is required");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.unavailable("Saving to the gallery needs Android 10 or newer.");
            return;
        }
        File source;
        try {
            File exportsRoot = new File(getContext().getCacheDir(), "exports").getCanonicalFile();
            source = new File(getContext().getCacheDir(), path).getCanonicalFile();
            if (!source.getPath().startsWith(exportsRoot.getPath() + File.separator) || !source.isFile()) {
                call.reject("File is not an export in the app cache.");
                return;
            }
        } catch (IOException e) {
            call.reject("Invalid export path.", e);
            return;
        }
        final File input = source;
        new Thread(() -> copyToGallery(call, input, name, mime)).start();
    }

    private void copyToGallery(PluginCall call, File input, String name, String mime) {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/BEHIX");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri collection = MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri item = null;
        try {
            item = resolver.insert(collection, values);
            if (item == null) throw new IOException("MediaStore insert failed");
            try (InputStream in = new FileInputStream(input); OutputStream out = resolver.openOutputStream(item)) {
                if (out == null) throw new IOException("Cannot open gallery file");
                byte[] buffer = new byte[1 << 20];
                int read;
                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            }
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(item, done, null, null);
            JSObject result = new JSObject();
            result.put("uri", item.toString());
            call.resolve(result);
        } catch (Exception e) {
            if (item != null) resolver.delete(item, null, null);
            call.reject("Saving to the gallery failed: " + e.getMessage(), e);
        }
    }
}
