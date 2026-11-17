package expo.modules.syncservice

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SyncServiceModule : Module() {
  companion object {
    private var instance: SyncServiceModule? = null

    fun onCancelClicked() {
      instance?.sendEvent("onCancelSync")
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SyncService")

    Events("onCancelSync")

    OnCreate {
      instance = this@SyncServiceModule
    }

    OnDestroy {
      if (instance == this@SyncServiceModule) {
        instance = null
      }
    }

    Function("startForegroundService") { title: String, text: String, progress: Int, max: Int ->
      val context = appContext.reactContext ?: return@Function false
      val intent = Intent(context, SyncService::class.java).apply {
        action = SyncService.ACTION_START
        putExtra(SyncService.EXTRA_TITLE, title)
        putExtra(SyncService.EXTRA_TEXT, text)
        putExtra(SyncService.EXTRA_PROGRESS, progress)
        putExtra(SyncService.EXTRA_MAX, max)
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
      val intent = Intent(context, SyncService::class.java).apply {
        action = SyncService.ACTION_UPDATE
        putExtra(SyncService.EXTRA_TITLE, title)
        putExtra(SyncService.EXTRA_TEXT, text)
        putExtra(SyncService.EXTRA_PROGRESS, progress)
        putExtra(SyncService.EXTRA_MAX, max)
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
      val intent = Intent(context, SyncService::class.java).apply {
        action = SyncService.ACTION_STOP
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
