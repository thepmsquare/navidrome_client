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
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.core.app.NotificationCompat
import androidx.media3.common.AudioAttributes
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
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.net.URL

@OptIn(UnstableApi::class)
class AudioPlaybackModule : Module() {
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
  private val scope = CoroutineScope(Dispatchers.IO)
  private var mediaActionReceiver: BroadcastReceiver? = null

  companion object {
    const val CHANNEL_ID = "audio_playback_channel"
    const val NOTIFICATION_ID = 1001
    const val ACTION_PREV = "expo.modules.audioplayback.ACTION_PREV"
    const val ACTION_PLAY_PAUSE = "expo.modules.audioplayback.ACTION_PLAY_PAUSE"
    const val ACTION_NEXT = "expo.modules.audioplayback.ACTION_NEXT"
    const val ACTION_STOP = "expo.modules.audioplayback.ACTION_STOP"
  }

  override fun definition() = ModuleDefinition {
    Name("AudioPlayback")

    Events(
      "onPlaybackStateChanged",
      "onTrackEnded",
      "onNextTrack",
      "onPreviousTrack",
      "onPlaybackError"
    )

    OnCreate {
      mainHandler.post {
        setupPlayer()
      }
      setupReceiver()
    }

    OnDestroy {
      scope.cancel()
      unregisterReceiver()
      mainHandler.post {
        releasePlayer()
      }
    }

    AsyncFunction("loadTrack") { url: String, title: String?, artist: String?, album: String?, artworkUrl: String?, playWhenReady: Boolean, promise: Promise ->
      mainHandler.post {
        try {
          setupPlayer()
          loadTrackInternal(url, title ?: "", artist ?: "", album ?: "", artworkUrl, playWhenReady)
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("ERR_LOAD_TRACK", e.message, e)
        }
      }
    }

    AsyncFunction("play") { promise: Promise ->
      mainHandler.post {
        try {
          player?.play()
          updateNotification()
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("ERR_PLAY", e.message, e)
        }
      }
    }

    AsyncFunction("pause") { promise: Promise ->
      mainHandler.post {
        try {
          player?.pause()
          updateNotification()
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("ERR_PAUSE", e.message, e)
        }
      }
    }

    AsyncFunction("stop") { promise: Promise ->
      mainHandler.post {
        try {
          player?.stop()
          hideNotification()
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("ERR_STOP", e.message, e)
        }
      }
    }

    AsyncFunction("seekTo") { positionSeconds: Double, promise: Promise ->
      mainHandler.post {
        try {
          player?.seekTo((positionSeconds * 1000).toLong())
          updateNotification()
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("ERR_SEEK", e.message, e)
        }
      }
    }

    AsyncFunction("setVolume") { volume: Float, promise: Promise ->
      mainHandler.post {
        try {
          player?.volume = volume.coerceIn(0f, 1f)
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("ERR_SET_VOLUME", e.message, e)
        }
      }
    }

    AsyncFunction("getPlaybackStatus") { promise: Promise ->
      mainHandler.post {
        try {
          promise.resolve(getPlaybackStatusMap())
        } catch (e: Exception) {
          promise.reject("ERR_STATUS", e.message, e)
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

    val audioAttributes = AudioAttributes.Builder()
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
        sendEvent(
          "onPlaybackError",
          mapOf(
            "errorCode" to error.errorCodeName,
            "message" to (error.message ?: "Playback error occurred")
          )
        )
      }
    })

    // Forwarding player intercepts hardware/media controller commands (Next, Previous)
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
                p.play()
              }
            }
          }
          ACTION_STOP -> {
            mainHandler.post {
              player?.pause()
              hideNotification()
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
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      context.registerReceiver(receiver, filter)
    }
    mediaActionReceiver = receiver
  }

  private fun unregisterReceiver() {
    val context = getContext() ?: return
    val receiver = mediaActionReceiver ?: return
    try {
      context.unregisterReceiver(receiver)
    } catch (_: Exception) {}
    mediaActionReceiver = null
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
      .setTitle(title)
      .setArtist(artist)
      .setAlbumTitle(album)
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
          val stream = URL(artworkUrl).openConnection().getInputStream()
          val bitmap = BitmapFactory.decodeStream(stream)
          currentArtworkBitmap = bitmap
          mainHandler.post {
            updateNotification()
          }
        } catch (_: Exception) {
          mainHandler.post {
            updateNotification()
          }
        }
      }
    } else {
      updateNotification()
    }
  }

  private fun createNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Audio Playback",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Media playback controls"
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

    val stopIntent = Intent(ACTION_STOP).setPackage(context.packageName)
    val stopPending = PendingIntent.getBroadcast(
      context, 104, stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val playPauseIcon = if (isPlaying) {
      android.R.drawable.ic_media_pause
    } else {
      android.R.drawable.ic_media_play
    }

    val style = MediaStyleNotificationHelper.MediaStyle(session)
      .setShowActionsInCompactView(0, 1, 2)

    val iconResId = context.resources.getIdentifier("ic_notification", "drawable", context.packageName).takeIf { it != 0 }
      ?: context.applicationInfo.icon.takeIf { it != 0 }
      ?: android.R.drawable.ic_media_play

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(iconResId)
      .setContentTitle(currentTitle.ifBlank { "Playing Audio" })
      .setContentText(if (currentArtist.isNotBlank()) currentArtist else currentAlbum)
      .setSubText(currentAlbum.takeIf { it.isNotBlank() })
      .setStyle(style)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(isPlaying)
      .addAction(android.R.drawable.ic_media_previous, "Previous", prevPending)
      .addAction(playPauseIcon, if (isPlaying) "Pause" else "Play", playPausePending)
      .addAction(android.R.drawable.ic_media_next, "Next", nextPending)
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPending)

    val artwork = currentArtworkBitmap ?: iconResId.takeIf { it != 0 }?.let {
      try {
        BitmapFactory.decodeResource(context.resources, it)
      } catch (_: Exception) {
        null
      }
    }
    artwork?.let {
      builder.setLargeIcon(it)
    }

    nm.notify(NOTIFICATION_ID, builder.build())
  }

  private fun hideNotification() {
    notificationManager?.cancel(NOTIFICATION_ID)
  }

  private fun getPlaybackStatusMap(): Map<String, Any?> {
    val p = player
    return mapOf(
      "isPlaying" to (p?.isPlaying ?: false),
      "isBuffering" to (p?.playbackState == Player.STATE_BUFFERING),
      "duration" to ((p?.duration ?: 0L).takeIf { it > 0 }?.let { it / 1000.0 } ?: 0.0),
      "position" to ((p?.currentPosition ?: 0L) / 1000.0)
    )
  }

  private fun releasePlayer() {
    hideNotification()
    mediaSession?.release()
    mediaSession = null
    player?.release()
    player = null
    forwardingPlayer = null
  }
}
