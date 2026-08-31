package expo.modules.audioplayback

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

@OptIn(UnstableApi::class)
class AudioPlaybackModule : Module() {
  private var service: AudioPlaybackService? = null
  private var isBound = false
  private val mainHandler = Handler(Looper.getMainLooper())

  companion object {
    const val TAG = "AudioPlaybackModule"
  }

  private val serviceConnection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
      val localBinder = binder as? AudioPlaybackService.LocalBinder
      service = localBinder?.getService()
      service?.setEventListener(eventListener)
      isBound = true
    }

    override fun onServiceDisconnected(name: ComponentName?) {
      service?.setEventListener(null)
      service = null
      isBound = false
    }
  }

  private val eventListener = object : AudioPlaybackService.PlaybackEventListener {
    override fun onPlaybackStateChanged(status: Map<String, Any?>) {
      sendEvent("onPlaybackStateChanged", status)
    }

    override fun onTrackEnded() {
      sendEvent("onTrackEnded", emptyMap<String, Any>())
    }

    override fun onNextTrack() {
      sendEvent("onNextTrack", emptyMap<String, Any>())
    }

    override fun onPreviousTrack() {
      sendEvent("onPreviousTrack", emptyMap<String, Any>())
    }

    override fun onPlaybackError(errorCode: String, message: String) {
      sendEvent(
        "onPlaybackError",
        mapOf(
          "errorCode" to errorCode,
          "message" to message
        )
      )
    }

    override fun onRepeatModeChanged(mode: String) {
      sendEvent("onRepeatModeChanged", mapOf("mode" to mode))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AudioPlayback")

    Events(
      "onPlaybackStateChanged",
      "onTrackEnded",
      "onNextTrack",
      "onPreviousTrack",
      "onPlaybackError",
      "onRepeatModeChanged"
    )

    OnCreate {
      val context = getContext()
      if (context != null) {
        ensureServiceStarted(context)
        bindService(context)
      }
    }

    OnDestroy {
      val context = getContext()
      if (context != null && isBound) {
        try {
          context.unbindService(serviceConnection)
        } catch (e: Exception) {
          android.util.Log.w(TAG, "Error unbinding service: ${e.message}")
        }
        isBound = false
      }
      service?.setEventListener(null)
      service = null
    }

    AsyncFunction("loadTrack") { url: String, title: String?, artist: String?, album: String?, artworkUrl: String?, playWhenReady: Boolean, promise: Promise ->
      mainHandler.post {
        try {
          if (url.isBlank()) {
            promise.reject("ERR_INVALID_URL", "URL cannot be empty", null)
            return@post
          }

          val context = getContext()
          if (context != null) {
            ensureServiceStarted(context)
            bindService(context)
          }

          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_SERVICE", "Audio playback service not available", null)
            return@post
          }

          s.loadTrack(url, title ?: "", artist ?: "", album ?: "", artworkUrl, playWhenReady)
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error loading track: ${e.message}", e)
          promise.reject("ERR_LOAD_TRACK", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("play") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.playPlayback()
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error playing: ${e.message}", e)
          promise.reject("ERR_PLAY", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("pause") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.pausePlayback()
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error pausing: ${e.message}", e)
          promise.reject("ERR_PAUSE", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("stop") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.stopPlayback()
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error stopping: ${e.message}", e)
          promise.reject("ERR_STOP", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("seekTo") { positionSeconds: Double, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          if (positionSeconds < 0) {
            promise.reject("ERR_INVALID_POSITION", "Position cannot be negative", null)
            return@post
          }
          s.seekTo(positionSeconds)
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error seeking: ${e.message}", e)
          promise.reject("ERR_SEEK", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("setVolume") { volume: Float, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.setVolume(volume)
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error setting volume: ${e.message}", e)
          promise.reject("ERR_SET_VOLUME", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("setRepeatMode") { mode: String, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          val repeatMode = when (mode.lowercase()) {
            "off" -> Player.REPEAT_MODE_OFF
            "one" -> Player.REPEAT_MODE_ONE
            "all" -> Player.REPEAT_MODE_ALL
            else -> {
              promise.reject("ERR_INVALID_REPEAT_MODE", "Mode must be 'off', 'one', or 'all'", null)
              return@post
            }
          }
          s.setRepeatMode(repeatMode)
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error setting repeat mode: ${e.message}", e)
          promise.reject("ERR_REPEAT_MODE", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("getPlaybackStatus") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s != null) {
            promise.resolve(s.getPlaybackStatusMap())
          } else {
            promise.resolve(
              mapOf(
                "isPlaying" to false,
                "isBuffering" to false,
                "duration" to 0.0,
                "position" to 0.0,
                "repeatMode" to "off"
              )
            )
          }
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error getting status: ${e.message}", e)
          promise.reject("ERR_STATUS", e.message ?: "Unknown error", e)
        }
      }
    }
  }

  private fun getContext(): Context? {
    return appContext.reactContext
  }

  private fun ensureServiceStarted(context: Context) {
    AudioPlaybackService.startService(context)
  }

  private fun bindService(context: Context) {
    if (isBound) return
    val intent = Intent(context, AudioPlaybackService::class.java)
    try {
      context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Failed to bind to AudioPlaybackService: ${e.message}", e)
    }
  }

  private fun getOrFindService(): AudioPlaybackService? {
    if (service != null) return service
    val instance = AudioPlaybackService.getInstance()
    if (instance != null) {
      service = instance
      service?.setEventListener(eventListener)
      return service
    }
    return null
  }
}