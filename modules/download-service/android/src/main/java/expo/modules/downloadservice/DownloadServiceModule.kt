package expo.modules.downloadservice

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DownloadServiceModule : Module() {
  companion object {
    private var instance: DownloadServiceModule? = null

    fun onCancelClicked() {
      instance?.sendEvent("onCancelDownload")
    }
  }

  override fun definition() = ModuleDefinition {
    Name("DownloadService")

    Events("onCancelDownload")

    OnCreate {
      instance = this@DownloadServiceModule
    }

    OnDestroy {
      if (instance == this@DownloadServiceModule) {
        instance = null
      }
    }

    Function("startForegroundService") { title: String, text: String, progress: Int, max: Int ->
      val context = appContext.reactContext ?: return@Function false
      val intent = Intent(context, DownloadService::class.java).apply {
        action = DownloadService.ACTION_START
        putExtra(DownloadService.EXTRA_TITLE, title)
        putExtra(DownloadService.EXTRA_TEXT, text)
        putExtra(DownloadService.EXTRA_PROGRESS, progress)
        putExtra(DownloadService.EXTRA_MAX, max)
      }
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        true
      } catch (_: Exception) {
        false
      }
    }

    Function("updateProgress") { title: String, text: String, progress: Int, max: Int ->
      val context = appContext.reactContext ?: return@Function false
      val intent = Intent(context, DownloadService::class.java).apply {
        action = DownloadService.ACTION_UPDATE
        putExtra(DownloadService.EXTRA_TITLE, title)
        putExtra(DownloadService.EXTRA_TEXT, text)
        putExtra(DownloadService.EXTRA_PROGRESS, progress)
        putExtra(DownloadService.EXTRA_MAX, max)
      }
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        true
      } catch (_: Exception) {
        false
      }
    }

    Function("stopForegroundService") {
      val context = appContext.reactContext ?: return@Function false
      val intent = Intent(context, DownloadService::class.java).apply {
        action = DownloadService.ACTION_STOP
      }
      try {
        context.startService(intent)
        true
      } catch (_: Exception) {
        false
      }
    }
  }
}

