package expo.modules.audioplayback

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Binder
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.annotation.OptIn
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.media3.common.AudioAttributes as Media3AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.CommandButton
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaStyleNotificationHelper
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import android.util.LruCache
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.io.File
import java.net.URL
import java.security.MessageDigest
import kotlin.math.min

@OptIn(UnstableApi::class)
class AudioPlaybackService : Service() {

  interface PlaybackEventListener {
    fun onPlaybackStateChanged(status: Map<String, Any?>)
    fun onTrackEnded()
    fun onNextTrack()
    fun onPreviousTrack()
    fun onPlaybackError(errorCode: String, message: String)
    fun onRepeatModeChanged(mode: String)
  }

  inner class LocalBinder : Binder() {
    fun getService(): AudioPlaybackService = this@AudioPlaybackService
  }

  private val binder = LocalBinder()
  private var player: ExoPlayer? = null
  private var forwardingPlayer: ForwardingPlayer? = null
  private var mediaSession: MediaSession? = null
  private var notificationManager: NotificationManager? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  private var currentTitle: String = ""
  private var currentArtist: String = ""
  private var currentAlbum: String = ""
  private var currentArtworkUrl: String? = null
  private var currentArtworkBitmap: Bitmap? = null
  private var artworkLoadJob: Job? = null
  private var currentRepeatMode: String = "off"

  private val scope = CoroutineScope(Dispatchers.IO + Job())
  private var mediaActionReceiver: BroadcastReceiver? = null

  private var eventListener: PlaybackEventListener? = null
  private var isForegroundServiceStarted = false
  private var progressRunnable: Runnable? = null

  private fun startProgressUpdates() {
    stopProgressUpdates()
    val runnable = object : Runnable {
      override fun run() {
        val p = player
        if (p != null && p.isPlaying) {
          eventListener?.onPlaybackStateChanged(getPlaybackStatusMap())
          mainHandler.postDelayed(this, 1000L)
        }
      }
    }
    progressRunnable = runnable
    mainHandler.post(runnable)
  }

  private fun stopProgressUpdates() {
    progressRunnable?.let {
      mainHandler.removeCallbacks(it)
    }
    progressRunnable = null
  }

  companion object {
    const val CHANNEL_ID = "audio_playback_channel"
    const val NOTIFICATION_ID = 1001
    const val ACTION_PREV = "expo.modules.audioplayback.ACTION_PREV"
    const val ACTION_PLAY_PAUSE = "expo.modules.audioplayback.ACTION_PLAY_PAUSE"
    const val ACTION_NEXT = "expo.modules.audioplayback.ACTION_NEXT"
    const val ACTION_STOP = "expo.modules.audioplayback.ACTION_STOP"
    const val ACTION_REPEAT = "expo.modules.audioplayback.ACTION_REPEAT"
    const val TAG = "AudioPlaybackService"
    const val MAX_ARTWORK_SIZE = 512

    private var instance: AudioPlaybackService? = null

    private val artworkMemoryCache = object : LruCache<String, Bitmap>(25) {
      override fun sizeOf(key: String, bitmap: Bitmap): Int {
        return 1
      }
    }

    fun getInstance(): AudioPlaybackService? = instance

    fun startService(context: Context) {
      val intent = Intent(context, AudioPlaybackService::class.java)
      try {
        context.startService(intent)
      } catch (e: Exception) {
        android.util.Log.w(TAG, "Failed to start service: ${e.message}")
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    instance = this
    setupPlayer()
    setupReceiver()
  }

  override fun onBind(intent: Intent?): IBinder {
    return binder
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_PREV -> handlePrevious()
      ACTION_NEXT -> handleNext()
      ACTION_PLAY_PAUSE -> handlePlayPause()
      ACTION_STOP -> handleStop()
      ACTION_REPEAT -> handleRepeat()
    }
    return START_STICKY
  }

  override fun onDestroy() {
    stopProgressUpdates()
    scope.coroutineContext[Job]?.cancel()
    unregisterReceiver()
    releasePlayer()
    instance = null
    super.onDestroy()
  }

  fun setEventListener(listener: PlaybackEventListener?) {
    this.eventListener = listener
  }

  private fun getSmallIconResId(): Int {
    return try {
      R.drawable.ic_notification
    } catch (_: Exception) {
      val resId = resources.getIdentifier("ic_notification", "drawable", packageName)
      if (resId != 0) resId else applicationInfo.icon
    }
  }

  private fun setupPlayer() {
    if (player != null) return

    createNotificationChannel()

    val audioAttributes = Media3AudioAttributes.Builder()
      .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
      .setUsage(C.USAGE_MEDIA)
      .build()

    val exoPlayer = ExoPlayer.Builder(this)
      .setLooper(Looper.getMainLooper())
      .setAudioAttributes(audioAttributes, true)
      .setHandleAudioBecomingNoisy(true)
      .build()

    exoPlayer.addListener(object : Player.Listener {
      override fun onIsPlayingChanged(isPlaying: Boolean) {
        if (isPlaying) {
          startProgressUpdates()
        } else {
          stopProgressUpdates()
        }
        eventListener?.onPlaybackStateChanged(getPlaybackStatusMap())
        updateNotification()
      }

      override fun onPlaybackStateChanged(playbackState: Int) {
        if (playbackState == Player.STATE_ENDED) {
          stopProgressUpdates()
          eventListener?.onTrackEnded()
        }
        eventListener?.onPlaybackStateChanged(getPlaybackStatusMap())
        updateNotification()
      }

      override fun onPositionDiscontinuity(
        oldPosition: Player.PositionInfo,
        newPosition: Player.PositionInfo,
        reason: Int
      ) {
        if (reason == Player.DISCONTINUITY_REASON_AUTO_TRANSITION &&
            player?.repeatMode == Player.REPEAT_MODE_ONE) {
          eventListener?.onPlaybackStateChanged(getPlaybackStatusMap())
        }
      }

      override fun onPlayerError(error: PlaybackException) {
        android.util.Log.e(TAG, "Playback error: ${error.errorCodeName}", error)
        eventListener?.onPlaybackError(
          error.errorCodeName,
          error.message ?: "Playback error occurred"
        )
      }

      override fun onRepeatModeChanged(repeatMode: Int) {
        val modeString = when (repeatMode) {
          Player.REPEAT_MODE_ONE -> "one"
          Player.REPEAT_MODE_ALL -> "all"
          else -> "off"
        }
        if (modeString != currentRepeatMode) {
          currentRepeatMode = modeString
          eventListener?.onRepeatModeChanged(modeString)
          updateSessionCustomLayout()
          updateNotification()
        }
      }
    })

    val customPlayer = object : ForwardingPlayer(exoPlayer) {
      override fun getAvailableCommands(): Player.Commands {
        return super.getAvailableCommands().buildUpon()
          .add(Player.COMMAND_PLAY_PAUSE)
          .add(Player.COMMAND_SEEK_TO_NEXT)
          .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
          .add(Player.COMMAND_SEEK_TO_PREVIOUS)
          .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
          .add(Player.COMMAND_STOP)
          .add(Player.COMMAND_SET_REPEAT_MODE)
          .build()
      }

      override fun isCommandAvailable(command: Int): Boolean {
        return when (command) {
          Player.COMMAND_PLAY_PAUSE,
          Player.COMMAND_SEEK_TO_NEXT,
          Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
          Player.COMMAND_SEEK_TO_PREVIOUS,
          Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
          Player.COMMAND_STOP,
          Player.COMMAND_SET_REPEAT_MODE -> true
          else -> super.isCommandAvailable(command)
        }
      }

      override fun seekToNext() {
        eventListener?.onNextTrack()
      }

      override fun seekToNextMediaItem() {
        eventListener?.onNextTrack()
      }

      override fun seekToPrevious() {
        eventListener?.onPreviousTrack()
      }

      override fun seekToPreviousMediaItem() {
        eventListener?.onPreviousTrack()
      }

      override fun stop() {
        super.stop()
        stopPlayback()
      }
    }

    val repeatCommand = SessionCommand(ACTION_REPEAT, Bundle.EMPTY)
    val stopCommand = SessionCommand(ACTION_STOP, Bundle.EMPTY)

    val session = MediaSession.Builder(this, customPlayer)
      .setId("AudioPlaybackSession")
      .setCallback(object : MediaSession.Callback {
        override fun onConnect(
          session: MediaSession,
          controller: MediaSession.ControllerInfo
        ): MediaSession.ConnectionResult {
          val sessionCommands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
            .add(repeatCommand)
            .add(stopCommand)
            .build()
          val playerCommands = MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS.buildUpon()
            .add(Player.COMMAND_PLAY_PAUSE)
            .add(Player.COMMAND_SEEK_TO_NEXT)
            .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
            .add(Player.COMMAND_SEEK_TO_PREVIOUS)
            .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
            .add(Player.COMMAND_STOP)
            .add(Player.COMMAND_SET_REPEAT_MODE)
            .build()
          return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
            .setAvailableSessionCommands(sessionCommands)
            .setAvailablePlayerCommands(playerCommands)
            .build()
        }

        override fun onCustomCommand(
          session: MediaSession,
          controller: MediaSession.ControllerInfo,
          customCommand: SessionCommand,
          args: Bundle
        ): ListenableFuture<SessionResult> {
          when (customCommand.customAction) {
            ACTION_REPEAT -> handleRepeat()
            ACTION_STOP -> handleStop()
          }
          return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
        }
      })
      .build()

    player = exoPlayer
    forwardingPlayer = customPlayer
    mediaSession = session
    notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager

    updateSessionCustomLayout()
  }

  private fun updateSessionCustomLayout() {
    val session = mediaSession ?: return
    val repeatIcon = getRepeatIconResId(currentRepeatMode)

    val repeatButton = CommandButton.Builder()
      .setDisplayName(getRepeatModeLabel(currentRepeatMode))
      .setSessionCommand(SessionCommand(ACTION_REPEAT, Bundle.EMPTY))
      .setIconResId(repeatIcon)
      .build()

    val stopButton = CommandButton.Builder()
      .setDisplayName("stop")
      .setSessionCommand(SessionCommand(ACTION_STOP, Bundle.EMPTY))
      .setIconResId(android.R.drawable.ic_menu_close_clear_cancel)
      .build()

    session.setCustomLayout(listOf(repeatButton, stopButton))
  }

  private fun setupReceiver() {
    if (mediaActionReceiver != null) return

    val receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context?, intent: Intent?) {
        when (intent?.action) {
          ACTION_PREV -> handlePrevious()
          ACTION_NEXT -> handleNext()
          ACTION_PLAY_PAUSE -> handlePlayPause()
          ACTION_STOP -> handleStop()
          ACTION_REPEAT -> handleRepeat()
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
        registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        @Suppress("UnspecifiedRegisterReceiverFlag")
        registerReceiver(receiver, filter)
      }
      mediaActionReceiver = receiver
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Failed to register receiver: ${e.message}", e)
    }
  }

  private fun unregisterReceiver() {
    val receiver = mediaActionReceiver ?: return
    try {
      unregisterReceiver(receiver)
    } catch (e: Exception) {
      android.util.Log.w(TAG, "Failed to unregister receiver: ${e.message}")
    }
    mediaActionReceiver = null
  }

  private fun handlePrevious() {
    eventListener?.onPreviousTrack()
  }

  private fun handleNext() {
    eventListener?.onNextTrack()
  }

  private fun handlePlayPause() {
    mainHandler.post {
      val p = player ?: return@post
      if (p.isPlaying) {
        pausePlayback()
      } else {
        playPlayback()
      }
    }
  }

  private fun handleStop() {
    mainHandler.post {
      stopPlayback()
    }
  }

  private fun handleRepeat() {
    mainHandler.post {
      val newMode = when (currentRepeatMode) {
        "off" -> "all"
        "all" -> "one"
        else -> "off"
      }
      setRepeatMode(newMode)
      eventListener?.onRepeatModeChanged(newMode)
    }
  }

  fun loadTrack(
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
    val cachedBitmap = if (!artworkUrl.isNullOrBlank()) artworkMemoryCache.get(artworkUrl) else null
    currentArtworkBitmap = cachedBitmap

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
      if (cachedBitmap != null) {
        updateNotification()
      } else {
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
      }
    } else {
      updateNotification()
    }
  }

  fun playPlayback() {
    val p = player ?: return
    p.play()
    startAsForegroundService()
  }

  fun pausePlayback() {
    val p = player ?: return
    p.pause()
    updateNotification()
  }

  fun stopPlayback() {
    stopProgressUpdates()
    val p = player ?: return
    p.stop()
    stopForegroundService()
  }

  fun seekTo(positionSeconds: Double) {
    player?.seekTo((positionSeconds * 1000).toLong())
    updateNotification()
  }

  fun setVolume(volume: Float) {
    player?.volume = volume.coerceIn(0f, 1f)
  }

  fun setRepeatMode(mode: String) {
    val normalized = mode.lowercase()
    currentRepeatMode = when (normalized) {
      "one" -> "one"
      "all" -> "all"
      else -> "off"
    }
    // In a single-item timeline architecture, ExoPlayer only handles REPEAT_MODE_ONE natively.
    // "all" and "off" must let ExoPlayer reach STATE_ENDED so TypeScript can sequence the queue.
    player?.repeatMode = if (currentRepeatMode == "one") {
      Player.REPEAT_MODE_ONE
    } else {
      Player.REPEAT_MODE_OFF
    }
    updateSessionCustomLayout()
    updateNotification()
  }

  fun isPlayerInitialized(): Boolean = player != null

  fun getPlaybackStatusMap(): Map<String, Any?> {
    val p = player
    return mapOf(
      "isPlaying" to (p?.isPlaying ?: false),
      "isBuffering" to (p?.playbackState == Player.STATE_BUFFERING),
      "duration" to ((p?.duration ?: 0L).takeIf { it > 0 }?.let { it / 1000.0 } ?: 0.0),
      "position" to ((p?.currentPosition ?: 0L) / 1000.0),
      "repeatMode" to currentRepeatMode
    )
  }

  private fun startAsForegroundService() {
    val notification = buildNotification() ?: return
    try {
      try {
        startService(Intent(this, AudioPlaybackService::class.java))
      } catch (e: Exception) {
        android.util.Log.w(TAG, "Failed to call startService: ${e.message}")
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ServiceCompat.startForeground(
          this,
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
      isForegroundServiceStarted = true
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Failed to start foreground service: ${e.message}", e)
    }
  }

  private fun stopForegroundService() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(STOP_FOREGROUND_REMOVE)
      } else {
        @Suppress("DEPRECATION")
        stopForeground(true)
      }
      isForegroundServiceStarted = false
      notificationManager?.cancel(NOTIFICATION_ID)
    } catch (e: Exception) {
      android.util.Log.w(TAG, "Failed to stop foreground service: ${e.message}")
    }
  }

  private fun createNotificationChannel() {
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
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      nm?.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification? {
    val p = player ?: return null
    val session = mediaSession ?: return null

    val isPlaying = p.isPlaying

    val prevIntent = Intent(ACTION_PREV).setPackage(packageName)
    val prevPending = PendingIntent.getBroadcast(
      this, 101, prevIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val playPauseIntent = Intent(ACTION_PLAY_PAUSE).setPackage(packageName)
    val playPausePending = PendingIntent.getBroadcast(
      this, 102, playPauseIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val nextIntent = Intent(ACTION_NEXT).setPackage(packageName)
    val nextPending = PendingIntent.getBroadcast(
      this, 103, nextIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val repeatIntent = Intent(ACTION_REPEAT).setPackage(packageName)
    val repeatPending = PendingIntent.getBroadcast(
      this, 104, repeatIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val stopIntent = Intent(ACTION_STOP).setPackage(packageName)
    val stopPending = PendingIntent.getBroadcast(
      this, 105, stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val iconResId = getSmallIconResId()

    val playPauseIcon = if (isPlaying) {
      android.R.drawable.ic_media_pause
    } else {
      android.R.drawable.ic_media_play
    }

    val repeatIcon = getRepeatIconResId(currentRepeatMode)

    val style = MediaStyleNotificationHelper.MediaStyle(session)
      .setShowActionsInCompactView(0, 1, 2)

    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val contentPendingIntent = if (launchIntent != null) {
      PendingIntent.getActivity(
        this,
        100,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    } else null

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(iconResId)
      .setContentTitle(currentTitle.ifBlank { "playing audio" })
      .setContentText(if (currentArtist.isNotBlank()) currentArtist else currentAlbum)
      .setSubText(currentAlbum.takeIf { it.isNotBlank() })
      .setStyle(style)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(isPlaying)
      .setContentIntent(contentPendingIntent)
      .addAction(android.R.drawable.ic_media_previous, "previous", prevPending)
      .addAction(playPauseIcon, if (isPlaying) "pause" else "play", playPausePending)
      .addAction(android.R.drawable.ic_media_next, "next", nextPending)
      .addAction(repeatIcon, getRepeatModeLabel(currentRepeatMode), repeatPending)
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "stop", stopPending)

    val artwork = currentArtworkBitmap ?: iconResId.takeIf { it != 0 }?.let {
      try {
        BitmapFactory.decodeResource(resources, it)
      } catch (e: Exception) {
        android.util.Log.w(TAG, "Failed to decode resource icon: ${e.message}")
        null
      }
    }

    artwork?.let {
      builder.setLargeIcon(it)
    }

    return builder.build()
  }

  private fun updateNotification() {
    val notification = buildNotification() ?: return
    val nm = notificationManager ?: return
    try {
      if (player?.isPlaying == true && !isForegroundServiceStarted) {
        startAsForegroundService()
      } else {
        nm.notify(NOTIFICATION_ID, notification)
      }
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Failed to update notification: ${e.message}", e)
    }
  }

  private fun getRepeatIconResId(mode: String): Int {
    return try {
      val resName = when (mode) {
        "one" -> "ic_repeat_one"
        "all" -> "ic_repeat"
        else -> "ic_repeat_off"
      }
      val resId = resources.getIdentifier(resName, "drawable", packageName)
      if (resId != 0) resId else android.R.drawable.ic_menu_rotate
    } catch (_: Exception) {
      android.R.drawable.ic_menu_rotate
    }
  }

  private fun getRepeatModeLabel(mode: String): String {
    return when (mode) {
      "one" -> "repeat one"
      "all" -> "repeat all"
      else -> "repeat off"
    }
  }

  private fun getArtworkCacheDir(): File {
    val dir = File(cacheDir, "artwork_cache")
    if (!dir.exists()) {
      dir.mkdirs()
    }
    return dir
  }

  private fun getArtworkCacheFile(url: String): File {
    val hash = MessageDigest.getInstance("MD5")
      .digest(url.toByteArray())
      .joinToString("") { "%02x".format(it) }
    return File(getArtworkCacheDir(), "$hash.img")
  }

  private suspend fun loadArtwork(artworkUrl: String) {
    try {
      var bitmap = artworkMemoryCache.get(artworkUrl)

      if (bitmap == null) {
        val cacheFile = getArtworkCacheFile(artworkUrl)
        val bytes: ByteArray = if (cacheFile.exists() && cacheFile.length() > 0) {
          try {
            cacheFile.readBytes()
          } catch (e: Exception) {
            android.util.Log.w(TAG, "Error reading artwork from disk cache: ${e.message}")
            ByteArray(0)
          }
        } else {
          ByteArray(0)
        }

        val finalBytes: ByteArray = if (bytes.isNotEmpty()) {
          bytes
        } else {
          val fetchedBytes = if (artworkUrl.startsWith("file:") || artworkUrl.startsWith("content:")) {
            val uri = Uri.parse(artworkUrl)
            contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: ByteArray(0)
          } else {
            val connection = URL(artworkUrl).openConnection()
            connection.connectTimeout = 5000
            connection.readTimeout = 5000
            connection.getInputStream().use { it.readBytes() }
          }

          if (fetchedBytes.isNotEmpty()) {
            try {
              cacheFile.writeBytes(fetchedBytes)
            } catch (e: Exception) {
              android.util.Log.w(TAG, "Error writing artwork to disk cache: ${e.message}")
            }
          }
          fetchedBytes
        }

        if (finalBytes.isNotEmpty()) {
          val options = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
          }
          BitmapFactory.decodeByteArray(finalBytes, 0, finalBytes.size, options)

          val inSampleSize = calculateInSampleSize(
            options.outWidth,
            options.outHeight,
            MAX_ARTWORK_SIZE,
            MAX_ARTWORK_SIZE
          )

          options.inJustDecodeBounds = false
          options.inSampleSize = inSampleSize

          val decoded = BitmapFactory.decodeByteArray(finalBytes, 0, finalBytes.size, options)
          if (decoded != null) {
            artworkMemoryCache.put(artworkUrl, decoded)
            bitmap = decoded
          }
        }
      }

      if (bitmap != null && currentArtworkUrl == artworkUrl) {
        currentArtworkBitmap = bitmap
        mainHandler.post {
          updateNotification()
        }
      }
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Artwork loading error: ${e.message}", e)
      throw e
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

  private fun releasePlayer() {
    try {
      stopForegroundService()
      mediaSession?.release()
      mediaSession = null
      player?.release()
      player = null
      forwardingPlayer = null
      currentArtworkBitmap = null
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Error releasing player: ${e.message}", e)
    }
  }
}
