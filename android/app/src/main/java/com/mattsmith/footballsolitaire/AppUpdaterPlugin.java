package com.mattsmith.footballsolitaire;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    public static final String PREFS_NAME = "football_updater_prefs";
    public static final String KEY_LAST_SEEN_CODE = "last_seen_version_code";
    public static final String KEY_PENDING_INSTALLED = "pending_update_installed";
    public static final String KEY_PENDING_VERSION = "pending_update_version";
    public static final String KEY_PENDING_NOTES = "pending_update_notes";
    public static final String KEY_DOWNLOADED_PATH = "downloaded_apk_path";
    public static final String KEY_DOWNLOADED_VERSION = "downloaded_version";
    public static final String KEY_DOWNLOADED_CODE = "downloaded_version_code";
    public static final String KEY_DOWNLOADED_NOTES = "downloaded_notes";

    private static AppUpdaterPlugin activeInstance;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void load() {
        super.load();
        activeInstance = this;
    }

    public static void emitEventFromReceiver(String eventName, JSObject data) {
        if (activeInstance != null) {
            activeInstance.notifyListeners(eventName, data);
        }
    }

    public static void closeAppForRestart() {
        if (activeInstance != null && activeInstance.getActivity() != null) {
            activeInstance.getActivity().runOnUiThread(() -> {
                activeInstance.getActivity().finishAffinity();
            });
        }
    }

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void getInstalledVersion(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo info = pm.getPackageInfo(getContext().getPackageName(), 0);
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? info.getLongVersionCode()
                    : info.versionCode;
            String versionName = info.versionName != null ? info.versionName : "1.0.0";

            SharedPreferences prefs = getPrefs();
            long lastSeenCode = prefs.getLong(KEY_LAST_SEEN_CODE, 0);
            boolean pendingFlag = prefs.getBoolean(KEY_PENDING_INSTALLED, false);
            String pendingNotes = prefs.getString(KEY_PENDING_NOTES, "");
            boolean justUpdated = false;

            if (lastSeenCode == 0) {
                // First run ever: record baseline version code
                prefs.edit().putLong(KEY_LAST_SEEN_CODE, versionCode).apply();
            } else if (versionCode > lastSeenCode || pendingFlag) {
                justUpdated = true;
                prefs.edit()
                        .putLong(KEY_LAST_SEEN_CODE, versionCode)
                        .putBoolean(KEY_PENDING_INSTALLED, false)
                        .apply();
                // Clean up installed APK file
                String oldPath = prefs.getString(KEY_DOWNLOADED_PATH, null);
                if (oldPath != null) {
                    File f = new File(oldPath);
                    if (f.exists()) f.delete();
                    prefs.edit()
                            .remove(KEY_DOWNLOADED_PATH)
                            .remove(KEY_DOWNLOADED_VERSION)
                            .remove(KEY_DOWNLOADED_CODE)
                            .apply();
                }
            }

            String downloadedPath = prefs.getString(KEY_DOWNLOADED_PATH, null);
            String downloadedVersion = prefs.getString(KEY_DOWNLOADED_VERSION, null);
            long downloadedCode = prefs.getLong(KEY_DOWNLOADED_CODE, 0);
            String downloadedNotes = prefs.getString(KEY_DOWNLOADED_NOTES, "");
            boolean downloadedReady = downloadedPath != null
                    && new File(downloadedPath).exists()
                    && downloadedCode > versionCode;

            JSObject res = new JSObject();
            res.put("versionName", versionName);
            res.put("versionCode", versionCode);
            res.put("justUpdated", justUpdated);
            res.put("updateNotes", pendingNotes);
            res.put("downloadedReady", downloadedReady);
            res.put("downloadedVersion", downloadedVersion);
            res.put("downloadedNotes", downloadedNotes);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to read package version: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkInstallPermission(PluginCall call) {
        boolean canInstall = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            canInstall = getContext().getPackageManager().canRequestPackageInstalls();
        }
        JSObject res = new JSObject();
        res.put("canInstall", canInstall);
        call.resolve(res);
    }

    @PluginMethod
    public void requestInstallPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        String urlStr = call.getString("url");
        String version = call.getString("version", "");
        long versionCode = call.getInt("versionCode", 0);
        String notes = call.getString("notes", "");

        if (urlStr == null || urlStr.isEmpty()) {
            call.reject("Missing APK download URL");
            return;
        }

        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                File updatesDir = new File(getContext().getFilesDir(), "updates");
                if (!updatesDir.exists()) updatesDir.mkdirs();
                File outFile = new File(updatesDir, "FootballSolitaire-update.apk");
                File tmpFile = new File(updatesDir, "FootballSolitaire-update.tmp");
                if (tmpFile.exists()) tmpFile.delete();

                // Follow redirects manually across cross-domain GitHub -> S3/CDN hops
                URL currentUrl = new URL(urlStr);
                for (int redirects = 0; redirects < 6; redirects++) {
                    conn = (HttpURLConnection) currentUrl.openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("User-Agent", "FootballSolitaire-AndroidUpdater");
                    int code = conn.getResponseCode();
                    if (code >= 300 && code < 400) {
                        String loc = conn.getHeaderField("Location");
                        conn.disconnect();
                        if (loc == null) throw new Exception("Redirect without Location header");
                        currentUrl = new URL(currentUrl, loc);
                    } else {
                        break;
                    }
                }

                if (conn == null || conn.getResponseCode() >= 400) {
                    int code = conn != null ? conn.getResponseCode() : -1;
                    throw new Exception("HTTP download failed with status " + code);
                }

                long totalBytes = conn.getContentLengthLong();
                long downloaded = 0;
                int lastPercent = -1;

                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream out = new FileOutputStream(tmpFile)) {
                    byte[] buf = new byte[16384];
                    int read;
                    while ((read = in.read(buf)) != -1) {
                        out.write(buf, 0, read);
                        downloaded += read;
                        int pct = totalBytes > 0
                                ? (int) Math.min(99, (downloaded * 100L) / totalBytes)
                                : 50;
                        if (pct != lastPercent) {
                            lastPercent = pct;
                            JSObject prog = new JSObject();
                            prog.put("progress", pct);
                            prog.put("bytesDownloaded", downloaded);
                            prog.put("totalBytes", totalBytes);
                            prog.put("status", "downloading");
                            notifyListeners("downloadProgress", prog);
                        }
                    }
                    out.flush();
                }

                if (outFile.exists()) outFile.delete();
                if (!tmpFile.renameTo(outFile)) {
                    throw new Exception("Could not finalize downloaded APK file");
                }

                getPrefs().edit()
                        .putString(KEY_DOWNLOADED_PATH, outFile.getAbsolutePath())
                        .putString(KEY_DOWNLOADED_VERSION, version)
                        .putLong(KEY_DOWNLOADED_CODE, versionCode)
                        .putString(KEY_DOWNLOADED_NOTES, notes)
                        .apply();

                JSObject doneProg = new JSObject();
                doneProg.put("progress", 100);
                doneProg.put("bytesDownloaded", downloaded);
                doneProg.put("totalBytes", totalBytes > 0 ? totalBytes : downloaded);
                doneProg.put("status", "ready");
                notifyListeners("downloadProgress", doneProg);

                JSObject res = new JSObject();
                res.put("filePath", outFile.getAbsolutePath());
                res.put("version", version);
                call.resolve(res);
            } catch (Exception e) {
                JSObject errProg = new JSObject();
                errProg.put("progress", 0);
                errProg.put("status", "error");
                errProg.put("error", e.getMessage());
                notifyListeners("downloadProgress", errProg);
                call.reject("Download failed: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            JSObject res = new JSObject();
            res.put("needsPermission", true);
            call.resolve(res);
            return;
        }

        SharedPreferences prefs = getPrefs();
        String apkPath = prefs.getString(KEY_DOWNLOADED_PATH, null);
        if (apkPath == null || !new File(apkPath).exists()) {
            call.reject("No downloaded APK found. Please download the update first.");
            return;
        }

        String version = prefs.getString(KEY_DOWNLOADED_VERSION, "");
        String notes = prefs.getString(KEY_DOWNLOADED_NOTES, "");
        prefs.edit()
                .putBoolean(KEY_PENDING_INSTALLED, true)
                .putString(KEY_PENDING_VERSION, version)
                .putString(KEY_PENDING_NOTES, notes)
                .apply();

        executor.execute(() -> {
            PackageInstaller.Session session = null;
            try {
                File apkFile = new File(apkPath);
                long size = apkFile.length();
                emitInstallProgress(10, "preparing");

                PackageInstaller installer = getContext().getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(
                        PackageInstaller.SessionParams.MODE_FULL_INSTALL
                );
                params.setAppPackageName(getContext().getPackageName());
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
                }

                int sessionId = installer.createSession(params);
                session = installer.openSession(sessionId);

                try (InputStream in = new FileInputStream(apkFile);
                     OutputStream out = session.openWrite("football_solitaire_update.apk", 0, size)) {
                    byte[] buf = new byte[32768];
                    long written = 0;
                    int read;
                    int lastPct = 10;
                    while ((read = in.read(buf)) != -1) {
                        out.write(buf, 0, read);
                        written += read;
                        int pct = 15 + (int) ((written * 70L) / Math.max(1L, size));
                        if (pct != lastPct) {
                            lastPct = pct;
                            emitInstallProgress(pct, "writing");
                        }
                    }
                    session.fsync(out);
                }

                emitInstallProgress(92, "committing");

                Intent intent = new Intent(getContext(), UpdateInstallReceiver.class);
                intent.setAction(UpdateInstallReceiver.ACTION_INSTALL_STATUS);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    flags |= PendingIntent.FLAG_MUTABLE;
                }
                PendingIntent statusIntent = PendingIntent.getBroadcast(
                        getContext(),
                        sessionId,
                        intent,
                        flags
                );

                session.commit(statusIntent.getIntentSender());
                emitInstallProgress(96, "installing");

                JSObject res = new JSObject();
                res.put("started", true);
                call.resolve(res);
            } catch (Exception e) {
                if (session != null) {
                    try {
                        session.abandon();
                    } catch (Exception ignored) {}
                }
                prefs.edit().putBoolean(KEY_PENDING_INSTALLED, false).apply();
                JSObject err = new JSObject();
                err.put("message", e.getMessage());
                notifyListeners("installError", err);
                call.reject("Install failed: " + e.getMessage());
            }
        });
    }

    private void emitInstallProgress(int progress, String stage) {
        JSObject obj = new JSObject();
        obj.put("progress", progress);
        obj.put("stage", stage);
        notifyListeners("installProgress", obj);
    }
}
