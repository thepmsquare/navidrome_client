package expo.modules.downloadservice

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DownloadServiceModule : Module() {
  companion object {
    private var instance: DownloadServiceModule? = null

    fun onCancelClicked() {
      instance?.sendEvent("onCancelDownload", emptyMap<String, Any>())
    }
  }

  private var networkCallback: ConnectivityManager.NetworkCallback? = null

  private fun checkIsWifiConnected(): Boolean {
    val context = appContext.reactContext ?: return true
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
    val activeNetwork = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(activeNetwork) ?: return false
    return caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
  }

  private fun registerNetworkCallback() {
    val context = appContext.reactContext ?: return
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
    if (networkCallback != null) return

    val callback = object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) {
        notifyNetworkState()
      }

      override fun onLost(network: Network) {
        notifyNetworkState()
      }

      override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
        notifyNetworkState()
      }
    }

    try {
      val request = NetworkRequest.Builder().build()
      cm.registerNetworkCallback(request, callback)
      networkCallback = callback
    } catch (_: Exception) {}
  }

  private fun unregisterNetworkCallback() {
    val context = appContext.reactContext ?: return
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
    try {
      networkCallback?.let { cm.unregisterNetworkCallback(it) }
    } catch (_: Exception) {}
    networkCallback = null
  }

  private fun notifyNetworkState() {
    val isWifi = checkIsWifiConnected()
    instance?.sendEvent("onNetworkChanged", mapOf("isWifi" to isWifi))
  }

  override fun definition() = ModuleDefinition {
    Name("DownloadService")

    Events("onCancelDownload", "onNetworkChanged")

    OnCreate {
      instance = this@DownloadServiceModule
      registerNetworkCallback()
    }

    OnDestroy {
      unregisterNetworkCallback()
      if (instance == this@DownloadServiceModule) {
        instance = null
      }
    }

    Function("isWifiConnected") {
      checkIsWifiConnected()
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
