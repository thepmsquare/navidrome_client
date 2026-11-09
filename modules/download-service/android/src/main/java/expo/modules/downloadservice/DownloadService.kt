package expo.modules.downloadservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

class DownloadService : Service() {

  companion object {
    const val CHANNEL_ID = "download_channel"
    const val NOTIFICATION_ID = 2001

    const val ACTION_START = "expo.modules.downloadservice.ACTION_START"
    const val ACTION_UPDATE = "expo.modules.downloadservice.ACTION_UPDATE"
    const val ACTION_CANCEL = "expo.modules.downloadservice.ACTION_CANCEL"
    const val ACTION_STOP = "expo.modules.downloadservice.ACTION_STOP"

    const val EXTRA_TITLE = "extra_title"
    const val EXTRA_TEXT = "extra_text"
    const val EXTRA_PROGRESS = "extra_progress"
    const val EXTRA_MAX = "extra_max"

    private const val TAG = "DownloadService"
  }

  private var notificationManager: NotificationManager? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var isForegroundStarted = false

  override fun onCreate() {
    super.onCreate()
    notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> handleStart(intent)
      ACTION_UPDATE -> handleUpdate(intent)
      ACTION_CANCEL -> handleCancel()
      ACTION_STOP -> handleStop()
    }
    return START_NOT_STICKY
  }

  private fun handleStart(intent: Intent?) {
    acquireWakeLock()
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "downloading"
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: ""
    val progress = intent?.getIntExtra(EXTRA_PROGRESS, 0) ?: 0
    val max = intent?.getIntExtra(EXTRA_MAX, 100) ?: 100

    val notification = buildNotification(title, text, progress, max)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ServiceCompat.startForeground(
          this,
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
      isForegroundStarted = true
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Failed to start foreground download service: ${e.message}", e)
    }
  }

  private fun handleUpdate(intent: Intent?) {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "downloading"
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: ""
    val progress = intent?.getIntExtra(EXTRA_PROGRESS, 0) ?: 0
    val max = intent?.getIntExtra(EXTRA_MAX, 100) ?: 100

    if (!isForegroundStarted) {
      handleStart(intent)
      return
    }

    val notification = buildNotification(title, text, progress, max)
    notificationManager?.notify(NOTIFICATION_ID, notification)
  }

  private fun handleCancel() {
    DownloadServiceModule.onCancelClicked()
    stopForegroundService()
    stopSelf()
  }

  private fun handleStop() {
    stopForegroundService()
    stopSelf()
  }

  private fun buildNotification(
    title: String,
    text: String,
    progress: Int,
    max: Int
  ): Notification {
    createNotificationChannel()

    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val contentPendingIntent = if (launchIntent != null) {
      PendingIntent.getActivity(
        this,
        0,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    } else null

    val cancelIntent = Intent(this, DownloadService::class.java).apply {
      action = ACTION_CANCEL
    }
    val cancelPendingIntent = PendingIntent.getService(
      this,
      1,
      cancelIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(getSmallIconResId())
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .addAction(
        android.R.drawable.ic_menu_close_clear_cancel,
        "cancel",
        cancelPendingIntent
      )

    if (contentPendingIntent != null) {
      builder.setContentIntent(contentPendingIntent)
    }

    if (max > 0) {
      builder.setProgress(max, progress.coerceIn(0, max), false)
    } else {
      builder.setProgress(0, 0, true)
    }

    return builder.build()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "downloads",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "background song downloads"
        setShowBadge(false)
      }
      notificationManager?.createNotificationChannel(channel)
    }
  }

  private fun acquireWakeLock() {
    if (wakeLock == null) {
      val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
      wakeLock = powerManager?.newWakeLock(
        PowerManager.PARTIAL_WAKE_LOCK,
        "navidrome:download_wake_lock"
      )?.apply {
        setReferenceCounted(false)
        acquire(60 * 60 * 1000L) // 1 hour safety timeout
      }
    }
  }

  private fun releaseWakeLock() {
    try {
      if (wakeLock?.isHeld == true) {
        wakeLock?.release()
      }
    } catch (_: Exception) {}
    wakeLock = null
  }

  private fun stopForegroundService() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(STOP_FOREGROUND_REMOVE)
      } else {
        @Suppress("DEPRECATION")
        stopForeground(true)
      }
      isForegroundStarted = false
      notificationManager?.cancel(NOTIFICATION_ID)
    } catch (e: Exception) {
      android.util.Log.w(TAG, "Failed to stop foreground download service: ${e.message}")
    }
    releaseWakeLock()
  }

  private fun getSmallIconResId(): Int {
    return try {
      val resId = resources.getIdentifier("ic_notification", "drawable", packageName)
      if (resId != 0) resId else applicationInfo.icon
    } catch (_: Exception) {
      applicationInfo.icon
    }
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
    stopForegroundService()
    stopSelf()
  }

  override fun onDestroy() {
    stopForegroundService()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}

