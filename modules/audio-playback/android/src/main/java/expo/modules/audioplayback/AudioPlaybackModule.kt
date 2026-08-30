package expo.modules.audioplayback

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.core.app.NotificationCompat
import androidx.media3.common.AudioAttributes as Media3AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaStyleNotificationHelper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.net.URL
import kotlin.math.min

@OptIn(UnstableApi::class)
class AudioPlaybackModule : Module() {
  private var player: ExoPlayer? = null
  private var forwardingPlayer: ForwardingPlayer? = null
  private var mediaSession: MediaSession? = null
  private var notificationManager: NotificationManager? = null
  private var audioManager: AudioManager? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  
  private var currentTitle: String = ""
  private var currentArtist: String = ""
  private var currentAlbum: String = ""
  private var currentArtworkUrl: String? = null
  private var currentArtworkBitmap: Bitmap? = null
  private var artworkLoadJob: Job? = null
  
  private val scope = CoroutineScope(Dispatchers.IO + Job())
  private var mediaActionReceiver: BroadcastReceiver? = null
  
  private var audioFocusRequest: AudioFocusRequest? = null
  
  companion object {
    const val CHANNEL_ID = "audio_playback_channel"
    const val NOTIFICATION_ID = 1001
    const val ACTION_PREV = "expo.modules.audioplayback.ACTION_PREV"
    const val ACTION_PLAY_PAUSE = "expo.modules.audioplayback.ACTION_PLAY_PAUSE"
    const val ACTION_NEXT = "expo.modules.audioplayback.ACTION_NEXT"
    const val ACTION_STOP = "expo.modules.audioplayback.ACTION_STOP"
    const val ACTION_REPEAT = "expo.modules.audioplayback.ACTION_REPEAT"
    const val TAG = "AudioPlaybackModule"
    const val MAX_ARTWORK_SIZE = 512 // Max dimension in pixels
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
      mainHandler.post {
        setupPlayer()
      }
      setupReceiver()
    }

    OnDestroy {
      scope.coroutineContext[Job]?.cancel()
      unregisterReceiver()
      mainHandler.post {
        releaseAudioFocus()
        releasePlayer()
      }
    }

    AsyncFunction("loadTrack") { url: String, title: String?, artist: String?, album: String?, artworkUrl: String?, playWhenReady: Boolean, promise: Promise ->
      mainHandler.post {
        try {
          // Input validation
          if (url.isBlank()) {
            promise.reject("ERR_INVALID_URL", "URL cannot be empty", null)
            return@post
          }
          
          setupPlayer()
          loadTrackInternal(url, title ?: "", artist ?: "", album ?: "", artworkUrl, playWhenReady)
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
          if (player == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          requestAudioFocus()
          player?.play()
          updateNotification()
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
          if (player == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          player?.pause()
          updateNotification()
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
          if (player == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          player?.stop()
          releaseAudioFocus()
          hideNotification()
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
          if (player == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          if (positionSeconds < 0) {
            promise.reject("ERR_INVALID_POSITION", "Position cannot be negative", null)
            return@post
          }
          player?.seekTo((positionSeconds * 1000).toLong())
          updateNotification()
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
          if (player == null) {
            promise.reject("ERR_NO_PLAYER", "Player not initialized", null)
            return@post
          }
          val clampedVolume = volume.coerceIn(0f, 1f)
          player?.volume = clampedVolume
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
          if (player == null) {
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
          player?.repeatMode = repeatMode
          updateNotification()
          sendEvent("onRepeatModeChanged", mapOf("mode" to mode))
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
          promise.resolve(getPlaybackStatusMap())
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

  private fun setupPlayer() {
    val context = getContext() ?: return
    if (player != null) return

    createNotificationChannel(context)

    val audioAttributes = Media3AudioAttributes.Builder()
      .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
      .setUsage(C.USAGE_MEDIA)
      .build()

    val exoPlayer = ExoPlayer.Builder(context)
      .setLooper(Looper.getMainLooper())
      .setAudioAttributes(audioAttributes, true)
      .setHandleAudioBecomingNoisy(true)
      .build()

    exoPlayer.addListener(object : Player.Listener {
      override fun onIsPlayingChanged(isPlaying: Boolean) {
        sendEvent("onPlaybackStateChanged", getPlaybackStatusMap())
        updateNotification()
      }

      override fun onPlaybackStateChanged(playbackState: Int) {
        if (playbackState == Player.STATE_ENDED) {
          sendEvent("onTrackEnded", emptyMap<String, Any>())
        }
        sendEvent("onPlaybackStateChanged", getPlaybackStatusMap())
        updateNotification()
      }

      override fun onPlayerError(error: PlaybackException) {
        android.util.Log.e(TAG, "Playback error: ${error.errorCodeName}", error)
        sendEvent(
          "onPlaybackError",
          mapOf(
            "errorCode" to error.errorCodeName,
            "message" to (error.message ?: "Playback error occurred")
          )
        )
      }

      override fun onRepeatModeChanged(repeatMode: Int) {
        val modeString = when (repeatMode) {
          Player.REPEAT_MODE_ONE -> "one"
          Player.REPEAT_MODE_ALL -> "all"
          else -> "off"
        }
        sendEvent("onRepeatModeChanged", mapOf("mode" to modeString))
        updateNotification()
      }
    })

    audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

    // Forwarding player intercepts hardware/media controller commands
    val customPlayer = object : ForwardingPlayer(exoPlayer) {
      override fun getAvailableCommands(): Player.Commands {
        return super.getAvailableCommands().buildUpon()
          .add(Player.COMMAND_SEEK_TO_NEXT)
          .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
          .add(Player.COMMAND_SEEK_TO_PREVIOUS)
          .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
          .add(Player.COMMAND_STOP)
          .build()
      }

      override fun isCommandAvailable(command: Int): Boolean {
        return when (command) {
          Player.COMMAND_SEEK_TO_NEXT,
          Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
          Player.COMMAND_SEEK_TO_PREVIOUS,
          Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
          Player.COMMAND_STOP -> true
          else -> super.isCommandAvailable(command)
        }
      }

      override fun seekToNext() {
        sendEvent("onNextTrack", emptyMap<String, Any>())
      }

      override fun seekToNextMediaItem() {
        sendEvent("onNextTrack", emptyMap<String, Any>())
      }

      override fun seekToPrevious() {
        sendEvent("onPreviousTrack", emptyMap<String, Any>())
      }

      override fun seekToPreviousMediaItem() {
        sendEvent("onPreviousTrack", emptyMap<String, Any>())
      }

      override fun stop() {
        super.stop()
        releaseAudioFocus()
        hideNotification()
      }
    }

    val session = MediaSession.Builder(context, customPlayer)
      .setId("AudioPlaybackSession")
      .setCallback(object : MediaSession.Callback {
        override fun onConnect(
          session: MediaSession,
          controller: MediaSession.ControllerInfo
        ): MediaSession.ConnectionResult {
          val sessionCommands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon().build()
          val playerCommands = MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS.buildUpon()
            .add(Player.COMMAND_SEEK_TO_NEXT)
            .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
            .add(Player.COMMAND_SEEK_TO_PREVIOUS)
            .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
            .add(Player.COMMAND_STOP)
            .build()
          return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
            .setAvailableSessionCommands(sessionCommands)
            .setAvailablePlayerCommands(playerCommands)
            .build()
        }
      })
      .build()

    player = exoPlayer
    forwardingPlayer = customPlayer
    mediaSession = session
    notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
  }

  private fun setupReceiver() {
    val context = getContext() ?: return
    if (mediaActionReceiver != null) return

    val receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context?, intent: Intent?) {
        when (intent?.action) {
          ACTION_PREV -> {
            sendEvent("onPreviousTrack", emptyMap<String, Any>())
          }
          ACTION_NEXT -> {
            sendEvent("onNextTrack", emptyMap<String, Any>())
          }
          ACTION_PLAY_PAUSE -> {
            mainHandler.post {
              val p = player ?: return@post
              if (p.isPlaying) {
                p.pause()
              } else {
                requestAudioFocus()
                p.play()
              }
            }
          }
          ACTION_STOP -> {
            mainHandler.post {
              player?.pause()
              releaseAudioFocus()
              hideNotification()
            }
          }
          ACTION_REPEAT -> {
            mainHandler.post {
              val p = player ?: return@post
              val newMode = when (p.repeatMode) {
                Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
                Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
                else -> Player.REPEAT_MODE_OFF
              }
              p.repeatMode = newMode
            }
          }
        }
      }
    }

    val filter = IntentFilter().apply {
      addAction(ACTION_PREV)
      addAction(ACTION_PLAY_PAUSE)
      addAction(ACTION_NEXT)
      addAction(ACTION_STOP)
      addAction(ACTION_REPEAT)
    }

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        @Suppress("UnspecifiedRegisterReceiverFlag")
        context.registerReceiver(receiver, filter)
      }
      mediaActionReceiver = receiver
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Failed to register receiver: ${e.message}", e)
    }
  }

  private fun unregisterReceiver() {
    val context = getContext() ?: return
    val receiver = mediaActionReceiver ?: return
    try {
      context.unregisterReceiver(receiver)
    } catch (e: Exception) {
      android.util.Log.w(TAG, "Failed to unregister receiver: ${e.message}")
    }
    mediaActionReceiver = null
  }

  private fun requestAudioFocus() {
    val context = getContext() ?: return
    val am = audioManager ?: return

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val audioAttributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build()

        val audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
          .setAudioAttributes(audioAttributes)
          .setAcceptsDelayedFocusGain(false)
          .build()

        this.audioFocusRequest = audioFocusRequest
        am.requestAudioFocus(audioFocusRequest)
      } else {
        @Suppress("DEPRECATION")
        am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
      }
    } catch (e: Exception) {
      android.util.Log.w(TAG, "Failed to request audio focus: ${e.message}")
    }
  }

  private fun releaseAudioFocus() {
    val am = audioManager ?: return

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        audioFocusRequest?.let { am.abandonAudioFocusRequest(it) }
        audioFocusRequest = null
      } else {
        @Suppress("DEPRECATION")
        am.abandonAudioFocus(null)
      }
    } catch (e: Exception) {
      android.util.Log.w(TAG, "Failed to release audio focus: ${e.message}")
    }
  }

  private fun loadTrackInternal(
    url: String,
    title: String,
    artist: String,
    album: String,
    artworkUrl: String?,
    playWhenReady: Boolean
  ) {
    val p = player ?: return
    currentTitle = title
    currentArtist = artist
    currentAlbum = album
    currentArtworkUrl = artworkUrl
    currentArtworkBitmap = null

    val mediaMetadata = MediaMetadata.Builder()
      .setTitle(title.takeIf { it.isNotBlank() })
      .setArtist(artist.takeIf { it.isNotBlank() })
      .setAlbumTitle(album.takeIf { it.isNotBlank() })
      .build()

    val mediaItem = MediaItem.Builder()
      .setUri(Uri.parse(url))
      .setMediaMetadata(mediaMetadata)
      .build()

    p.setMediaItem(mediaItem)
    p.prepare()
    p.playWhenReady = playWhenReady

    if (!artworkUrl.isNullOrBlank()) {
      artworkLoadJob?.cancel()
      artworkLoadJob = scope.launch {
        try {
          loadArtwork(artworkUrl)
        } catch (e: Exception) {
          android.util.Log.w(TAG, "Failed to load artwork: ${e.message}")
          mainHandler.post {
            updateNotification()
          }
        }
      }
    } else {
      updateNotification()
    }
  }

  private suspend fun loadArtwork(artworkUrl: String) {
    try {
      val connection = URL(artworkUrl).openConnection()
      connection.connectTimeout = 5000
      connection.readTimeout = 5000

      val bytes = connection.getInputStream().use { it.readBytes() }

      val options = BitmapFactory.Options().apply {
        inJustDecodeBounds = true
      }
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)

      // Calculate inSampleSize for downsampling
      val inSampleSize = calculateInSampleSize(
        options.outWidth,
        options.outHeight,
        MAX_ARTWORK_SIZE,
        MAX_ARTWORK_SIZE
      )

      options.inJustDecodeBounds = false
      options.inSampleSize = inSampleSize

      val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
      if (bitmap != null) {
        currentArtworkBitmap = bitmap
      }
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Artwork loading error: ${e.message}", e)
      throw e
    }

    mainHandler.post {
      updateNotification()
    }
  }

  private fun calculateInSampleSize(
    srcWidth: Int,
    srcHeight: Int,
    reqWidth: Int,
    reqHeight: Int
  ): Int {
    var inSampleSize = 1
    if (srcHeight > reqHeight || srcWidth > reqWidth) {
      val heightRatio = srcHeight / reqHeight
      val widthRatio = srcWidth / reqWidth
      inSampleSize = min(heightRatio, widthRatio)
    }
    return inSampleSize
  }

  private fun createNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "audio playback",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "media playback controls"
        setShowBadge(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      nm?.createNotificationChannel(channel)
    }
  }

  private fun updateNotification() {
    val context = getContext() ?: return
    val session = mediaSession ?: return
    val p = player ?: return
    val nm = notificationManager ?: return

    val isPlaying = p.isPlaying
    val repeatMode = p.repeatMode

    val prevIntent = Intent(ACTION_PREV).setPackage(context.packageName)
    val prevPending = PendingIntent.getBroadcast(
      context, 101, prevIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val playPauseIntent = Intent(ACTION_PLAY_PAUSE).setPackage(context.packageName)
    val playPausePending = PendingIntent.getBroadcast(
      context, 102, playPauseIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val nextIntent = Intent(ACTION_NEXT).setPackage(context.packageName)
    val nextPending = PendingIntent.getBroadcast(
      context, 103, nextIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val repeatIntent = Intent(ACTION_REPEAT).setPackage(context.packageName)
    val repeatPending = PendingIntent.getBroadcast(
      context, 104, repeatIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val stopIntent = Intent(ACTION_STOP).setPackage(context.packageName)
    val stopPending = PendingIntent.getBroadcast(
      context, 105, stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val playPauseIcon = if (isPlaying) {
      android.R.drawable.ic_media_pause
    } else {
      android.R.drawable.ic_media_play
    }

    val repeatIcon = when (repeatMode) {
      Player.REPEAT_MODE_ONE -> android.R.drawable.ic_media_play
      Player.REPEAT_MODE_ALL -> android.R.drawable.ic_media_play
      else -> android.R.drawable.ic_media_pause
    }

    val style = MediaStyleNotificationHelper.MediaStyle(session)
      .setShowActionsInCompactView(0, 1, 2)

    val iconResId = context.resources.getIdentifier("ic_notification", "drawable", context.packageName).takeIf { it != 0 }
      ?: context.applicationInfo.icon.takeIf { it != 0 }
      ?: android.R.drawable.ic_media_play

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(iconResId)
      .setContentTitle(currentTitle.ifBlank { "playing audio" })
      .setContentText(if (currentArtist.isNotBlank()) currentArtist else currentAlbum)
      .setSubText(currentAlbum.takeIf { it.isNotBlank() })
      .setStyle(style)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(isPlaying)
      .addAction(android.R.drawable.ic_media_previous, "previous", prevPending)
      .addAction(playPauseIcon, if (isPlaying) "pause" else "play", playPausePending)
      .addAction(android.R.drawable.ic_media_next, "next", nextPending)
      .addAction(repeatIcon, getRepeatModeLabel(repeatMode), repeatPending)
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "stop", stopPending)

    val artwork = currentArtworkBitmap ?: iconResId.takeIf { it != 0 }?.let {
      try {
        BitmapFactory.decodeResource(context.resources, it)
      } catch (e: Exception) {
        android.util.Log.w(TAG, "Failed to decode resource icon: ${e.message}")
        null
      }
    }
    artwork?.let {
      builder.setLargeIcon(it)
    }

    try {
      nm.notify(NOTIFICATION_ID, builder.build())
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Failed to notify: ${e.message}", e)
    }
  }

  private fun getRepeatModeLabel(repeatMode: Int): String {
    return when (repeatMode) {
      Player.REPEAT_MODE_ONE -> "repeat one"
      Player.REPEAT_MODE_ALL -> "repeat all"
      else -> "no repeat"
    }
  }

  private fun hideNotification() {
    try {
      notificationManager?.cancel(NOTIFICATION_ID)
    } catch (e: Exception) {
      android.util.Log.w(TAG, "Failed to hide notification: ${e.message}")
    }
  }

  private fun getPlaybackStatusMap(): Map<String, Any?> {
    val p = player
    val repeatModeString = when (p?.repeatMode) {
      Player.REPEAT_MODE_ONE -> "one"
      Player.REPEAT_MODE_ALL -> "all"
      else -> "off"
    }
    return mapOf(
      "isPlaying" to (p?.isPlaying ?: false),
      "isBuffering" to (p?.playbackState == Player.STATE_BUFFERING),
      "duration" to ((p?.duration ?: 0L).takeIf { it > 0 }?.let { it / 1000.0 } ?: 0.0),
      "position" to ((p?.currentPosition ?: 0L) / 1000.0),
      "repeatMode" to repeatModeString
    )
  }

  private fun releasePlayer() {
    try {
      hideNotification()
      mediaSession?.release()
      mediaSession = null
      player?.release()
      player = null
      forwardingPlayer = null
      currentArtworkBitmap?.recycle()
      currentArtworkBitmap = null
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Error releasing player: ${e.message}", e)
    }
  }
}