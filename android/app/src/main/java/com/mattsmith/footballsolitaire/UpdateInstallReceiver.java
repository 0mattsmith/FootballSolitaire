package com.mattsmith.footballsolitaire;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

import com.getcapacitor.JSObject;

public class UpdateInstallReceiver extends BroadcastReceiver {
    public static final String ACTION_INSTALL_STATUS =
            "com.mattsmith.footballsolitaire.INSTALL_STATUS";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_INSTALL_STATUS.equals(intent.getAction())) {
            return;
        }

        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);

        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirmIntent = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirmIntent != null) {
                confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(confirmIntent);
            }
        } else if (status == PackageInstaller.STATUS_SUCCESS) {
            JSObject done = new JSObject();
            done.put("progress", 100);
            done.put("stage", "complete");
            AppUpdaterPlugin.emitEventFromReceiver("installProgress", done);
            AppUpdaterPlugin.closeAppForRestart();
        } else {
            context.getSharedPreferences(AppUpdaterPlugin.PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean(AppUpdaterPlugin.KEY_PENDING_INSTALLED, false)
                    .apply();

            JSObject err = new JSObject();
            err.put("status", status);
            err.put("message", message != null ? message : "Package installation failed");
            AppUpdaterPlugin.emitEventFromReceiver("installError", err);
        }
    }
}
