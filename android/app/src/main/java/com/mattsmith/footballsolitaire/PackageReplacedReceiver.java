package com.mattsmith.footballsolitaire;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;

public class PackageReplacedReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "football_solitaire_updates";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(
                AppUpdaterPlugin.PREFS_NAME,
                Context.MODE_PRIVATE
        );
        boolean wasInAppUpdate = prefs.getBoolean(AppUpdaterPlugin.KEY_PENDING_INSTALLED, false);
        if (!wasInAppUpdate) {
            return;
        }

        String version = prefs.getString(AppUpdaterPlugin.KEY_PENDING_VERSION, "");
        String notes = prefs.getString(AppUpdaterPlugin.KEY_PENDING_NOTES, "");

        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent == null) return;
        launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );

        // Attempt immediate reopen of the app
        try {
            context.startActivity(launchIntent);
        } catch (Exception ignored) {
            // Android 12+ background launch restrictions may defer to notification below
        }

        // Also show an instant heads-up notification in case OEM policy blocked direct auto-launch
        try {
            NotificationManager nm =
                    (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    NotificationChannel channel = new NotificationChannel(
                            CHANNEL_ID,
                            "App Updates",
                            NotificationManager.IMPORTANCE_HIGH
                    );
                    nm.createNotificationChannel(channel);
                }

                PendingIntent pi = PendingIntent.getActivity(
                        context,
                        101,
                        launchIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                String title = version != null && !version.isEmpty()
                        ? "Updated to v" + version + "!"
                        : "Football Solitaire Updated!";
                String body = notes != null && !notes.isEmpty()
                        ? notes
                        : "Tap to continue playing.";

                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                        .setSmallIcon(R.mipmap.ic_launcher_round)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setAutoCancel(true)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setContentIntent(pi);

                nm.notify(9001, builder.build());
            }
        } catch (Exception ignored) {}
    }
}
