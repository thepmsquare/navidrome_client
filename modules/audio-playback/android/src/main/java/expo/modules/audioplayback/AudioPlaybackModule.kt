package expo.modules.audioplayback

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.net.Uri
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes as Media3AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

@OptIn(UnstableApi::class)
class AudioPlaybackModule : Module() {
  private var service: AudioPlaybackService? = null
  private var isBound = false
  private val mainHandler = Handler(Looper.getMainLooper())
  private var testPlayer: ExoPlayer? = null

  companion object {
    const val TAG = "AudioPlaybackModule"
  }

  private fun releaseTestPlayer() {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      testPlayer?.let { p ->
        try {
          p.stop()
          p.clearMediaItems()
          p.release()
        } catch (e: Exception) {
          android.util.Log.w(TAG, "Error releasing testPlayer: ${e.message}")
        }
      }
      testPlayer = null
    } else {
      mainHandler.post {
        releaseTestPlayer()
      }
    }
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

    override fun onPlaybackStopped() {
      sendEvent("onPlaybackStopped", emptyMap<String, Any>())
    }

    override fun onMediaItemTransition(index: Int, mediaId: String) {
      sendEvent(
        "onMediaItemTransition",
        mapOf(
          "index" to index,
          "mediaId" to mediaId
        )
      )
    }

    override fun onSleepTimerExpired() {
      sendEvent("onSleepTimerExpired", emptyMap<String, Any>())
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
      "onRepeatModeChanged",
      "onPlaybackStopped",
      "onMediaItemTransition",
      "onSleepTimerExpired"
    )

    OnCreate {
      val context = getContext()
      if (context != null) {
        bindService(context)
      }
    }

    OnDestroy {
      releaseTestPlayer()
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

    AsyncFunction("playTestSound") { url: String, promise: Promise ->
      mainHandler.post {
        try {
          if (url.isBlank()) {
            promise.reject("ERR_INVALID_URL", "URL cannot be empty", null)
            return@post
          }

          val context = getContext()
          if (context == null) {
            promise.reject("ERR_NO_CONTEXT", "Context not available", null)
            return@post
          }

          releaseTestPlayer()

          val testAudioAttributes = Media3AudioAttributes.Builder()
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .setUsage(C.USAGE_MEDIA)
            .build()

          val player = ExoPlayer.Builder(context)
            .setLooper(Looper.getMainLooper())
            .setAudioAttributes(testAudioAttributes, false)
            .setHandleAudioBecomingNoisy(true)
            .build()

          player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
              if (playbackState == Player.STATE_ENDED) {
                releaseTestPlayer()
              }
            }

            override fun onPlayerError(error: PlaybackException) {
              android.util.Log.w(TAG, "Test sound error: ${error.errorCodeName}", error)
              releaseTestPlayer()
            }
          })

          val mediaItem = MediaItem.fromUri(Uri.parse(url))
          player.setMediaItem(mediaItem)
          player.prepare()
          player.playWhenReady = true
          testPlayer = player

          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error playing test sound: ${e.message}", e)
          releaseTestPlayer()
          promise.reject("ERR_PLAY_TEST_SOUND", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("stopTestSound") { promise: Promise ->
      mainHandler.post {
        try {
          releaseTestPlayer()
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error stopping test sound: ${e.message}", e)
          promise.reject("ERR_STOP_TEST_SOUND", e.message ?: "Unknown error", e)
        }
      }
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

    AsyncFunction("setPlaylist") { items: List<Map<String, Any?>>, startIndex: Int, initialPositionSeconds: Double, promise: Promise ->
      mainHandler.post {
        try {
          if (items.isEmpty()) {
            promise.reject("ERR_EMPTY_PLAYLIST", "Playlist cannot be empty", null)
            return@post
          }

          val context = getContext()
          if (context != null) {
            bindService(context)
          }

          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_SERVICE", "Audio playback service not available", null)
            return@post
          }

          s.setPlaylist(items, startIndex, initialPositionSeconds)
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error setting playlist: ${e.message}", e)
          promise.reject("ERR_SET_PLAYLIST", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("addPlaylistItem") { item: Map<String, Any?>, index: Int?, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.addPlaylistItem(item, index)
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error adding playlist item: ${e.message}", e)
          promise.reject("ERR_ADD_PLAYLIST_ITEM", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("removePlaylistItem") { index: Int, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.removePlaylistItem(index)
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error removing playlist item: ${e.message}", e)
          promise.reject("ERR_REMOVE_PLAYLIST_ITEM", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("movePlaylistItem") { fromIndex: Int, toIndex: Int, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.movePlaylistItem(fromIndex, toIndex)
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error moving playlist item: ${e.message}", e)
          promise.reject("ERR_MOVE_PLAYLIST_ITEM", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("clearPlaylist") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.clearPlaylist()
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error clearing playlist: ${e.message}", e)
          promise.reject("ERR_CLEAR_PLAYLIST", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("seekToTrack") { index: Int, positionSeconds: Double, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.seekToTrack(index, positionSeconds)
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error seeking to track: ${e.message}", e)
          promise.reject("ERR_SEEK_TRACK", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("updatePlaylistItemUri") { index: Int, url: String, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.updatePlaylistItemUri(index, url)
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error updating playlist item uri: ${e.message}", e)
          promise.reject("ERR_UPDATE_ITEM_URI", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("setShuffleModeEnabled") { enabled: Boolean, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.setShuffleModeEnabled(enabled)
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error setting shuffle mode: ${e.message}", e)
          promise.reject("ERR_SET_SHUFFLE", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("getPlaylistState") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s != null) {
            promise.resolve(s.getPlaylistStateMap())
          } else {
            promise.resolve(null)
          }
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error getting playlist state: ${e.message}", e)
          promise.reject("ERR_GET_PLAYLIST_STATE", e.message ?: "Unknown error", e)
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

    AsyncFunction("getVolume") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          promise.resolve((s?.getVolume() ?: 1.0f).toDouble())
        } catch (e: Exception) {
          promise.resolve(1.0)
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
          val normalized = mode.lowercase()
          if (normalized != "off" && normalized != "one" && normalized != "all") {
            promise.reject("ERR_INVALID_REPEAT_MODE", "Mode must be 'off', 'one', or 'all'", null)
            return@post
          }
          s.setRepeatMode(normalized)
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error setting repeat mode: ${e.message}", e)
          promise.reject("ERR_REPEAT_MODE", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("setPlaybackSpeed") { speed: Double, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.setPlaybackSpeed(speed.toFloat())
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error setting playback speed: ${e.message}", e)
          promise.reject("ERR_SET_SPEED", e.message ?: "Unknown error", e)
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
                "repeatMode" to "off",
                "playbackSpeed" to 1.0
              )
            )
          }
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error getting status: ${e.message}", e)
          promise.reject("ERR_STATUS", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("setStopOnAppDismissed") { stop: Boolean, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s != null) {
            s.setStopOnAppDismissed(stop)
          } else {
            val ctx = getContext()
            if (ctx != null) {
              val prefs = ctx.getSharedPreferences(AudioPlaybackService.PREFS_NAME, Context.MODE_PRIVATE)
              prefs.edit().putBoolean(AudioPlaybackService.PREF_STOP_ON_APP_DISMISSED, stop).apply()
            }
          }
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error setting stop on app dismissed: ${e.message}", e)
          promise.reject("ERR_STOP_ON_DISMISSED", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("getCompletedTracks") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          promise.resolve(s?.getCompletedTracks() ?: emptyList<Map<String, Any>>())
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error getting completed tracks: ${e.message}", e)
          promise.resolve(emptyList<Map<String, Any>>())
        }
      }
    }

    AsyncFunction("clearCompletedTracks") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          s?.clearCompletedTracks()
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error clearing completed tracks: ${e.message}", e)
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("setSleepTimer") { durationMs: Double, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          s.setSleepTimer(durationMs.toLong())
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error setting sleep timer: ${e.message}", e)
          promise.reject("ERR_SET_SLEEP_TIMER", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("cancelSleepTimer") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          s?.cancelSleepTimer()
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error cancelling sleep timer: ${e.message}", e)
          promise.reject("ERR_CANCEL_SLEEP_TIMER", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("getSleepTimerRemainingSeconds") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          if (s != null) {
            promise.resolve(s.getSleepTimerRemainingSeconds())
          } else {
            promise.resolve(0.0)
          }
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error getting sleep timer remaining seconds: ${e.message}", e)
          promise.reject("ERR_GET_SLEEP_TIMER", e.message ?: "Unknown error", e)
        }
      }
    }

    AsyncFunction("getPendingAutoCacheTracks") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          promise.resolve(s?.getPendingAutoCacheTracks() ?: emptyList<Map<String, Any>>())
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error getting pending auto cache tracks: ${e.message}", e)
          promise.resolve(emptyList<Map<String, Any>>())
        }
      }
    }

    AsyncFunction("clearPendingAutoCacheTracks") { promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          s?.clearPendingAutoCacheTracks()
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Error clearing pending auto cache tracks: ${e.message}", e)
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("setAutoCacheEnabled") { enabled: Boolean, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          s?.setAutoCacheEnabled(enabled)
          val ctx = appContext.reactContext
          if (ctx != null) {
            val prefs = ctx.getSharedPreferences(AudioPlaybackService.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(AudioPlaybackService.PREF_AUTO_CACHE_ENABLED, enabled).apply()
          }
          promise.resolve(null)
        } catch (e: Exception) {
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("setDownloadWifiOnly") { wifiOnly: Boolean, promise: Promise ->
      mainHandler.post {
        try {
          val s = getOrFindService()
          s?.setDownloadWifiOnly(wifiOnly)
          val ctx = appContext.reactContext
          if (ctx != null) {
            val prefs = ctx.getSharedPreferences(AudioPlaybackService.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(AudioPlaybackService.PREF_DOWNLOAD_WIFI_ONLY, wifiOnly).apply()
          }
          promise.resolve(null)
        } catch (e: Exception) {
          promise.resolve(null)
        }
      }
    }
  }

  private fun getContext(): Context? {
    return appContext.reactContext
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