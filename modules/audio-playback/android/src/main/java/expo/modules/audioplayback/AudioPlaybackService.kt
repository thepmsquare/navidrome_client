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
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
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
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.net.URL
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

  private var eventListener: PlaybackEventListener? = null
  private var isForegroundServiceStarted = false

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

    fun getInstance(): AudioPlaybackService? = instance

    fun startService(context: Context) {
      val intent = Intent(context, AudioPlaybackService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
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
    scope.coroutineContext[Job]?.cancel()
    unregisterReceiver()
    releaseAudioFocus()
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
        eventListener?.onPlaybackStateChanged(getPlaybackStatusMap())
        updateNotification()
      }

      override fun onPlaybackStateChanged(playbackState: Int) {
        if (playbackState == Player.STATE_ENDED) {
          eventListener?.onTrackEnded()
        }
        eventListener?.onPlaybackStateChanged(getPlaybackStatusMap())
        updateNotification()
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
        eventListener?.onRepeatModeChanged(modeString)
        updateSessionCustomLayout()
        updateNotification()
      }
    })

    audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager

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
    val repeatMode = player?.repeatMode ?: Player.REPEAT_MODE_OFF

    val repeatIcon = when (repeatMode) {
      Player.REPEAT_MODE_ONE -> android.R.drawable.ic_media_play
      Player.REPEAT_MODE_ALL -> android.R.drawable.ic_media_play
      else -> android.R.drawable.ic_media_pause
    }

    val repeatButton = CommandButton.Builder()
      .setDisplayName(getRepeatModeLabel(repeatMode))
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
      val p = player ?: return@post
      val newMode = when (p.repeatMode) {
        Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
        Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
        else -> Player.REPEAT_MODE_OFF
      }
      p.repeatMode = newMode
      updateSessionCustomLayout()
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

  fun playPlayback() {
    val p = player ?: return
    requestAudioFocus()
    p.play()
    startAsForegroundService()
  }

  fun pausePlayback() {
    val p = player ?: return
    p.pause()
    updateNotification()
  }

  fun stopPlayback() {
    val p = player ?: return
    p.stop()
    releaseAudioFocus()
    stopForegroundService()
  }

  fun seekTo(positionSeconds: Double) {
    player?.seekTo((positionSeconds * 1000).toLong())
    updateNotification()
  }

  fun setVolume(volume: Float) {
    player?.volume = volume.coerceIn(0f, 1f)
  }

  fun setRepeatMode(repeatMode: Int) {
    player?.repeatMode = repeatMode
    updateSessionCustomLayout()
  }

  fun isPlayerInitialized(): Boolean = player != null

  fun getPlaybackStatusMap(): Map<String, Any?> {
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

  private fun startAsForegroundService() {
    val notification = buildNotification() ?: return
    try {
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
    val repeatMode = p.repeatMode

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

    val repeatIcon = when (repeatMode) {
      Player.REPEAT_MODE_ONE -> android.R.drawable.ic_media_play
      Player.REPEAT_MODE_ALL -> android.R.drawable.ic_media_play
      else -> android.R.drawable.ic_media_pause
    }

    val style = MediaStyleNotificationHelper.MediaStyle(session)
      .setShowActionsInCompactView(0, 1, 2)

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
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

  private fun getRepeatModeLabel(repeatMode: Int): String {
    return when (repeatMode) {
      Player.REPEAT_MODE_ONE -> "repeat one"
      Player.REPEAT_MODE_ALL -> "repeat all"
      else -> "no repeat"
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

  private fun requestAudioFocus() {
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

  private fun releasePlayer() {
    try {
      stopForegroundService()
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
