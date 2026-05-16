import 'dart:async';
import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';
import 'package:navidrome_client/services/event_log_service.dart';
import 'package:navidrome_client/services/session_service.dart';

/// Custom AudioHandler that manages the bridge between Navidrome playback
/// and the system MediaSession.
///
/// It implements a "Legacy Multi-Click" fallback for headsets that do not
/// support native SKIP_TO_NEXT/PREVIOUS events and instead send repeated
/// HEADSETHOOK clicks.
class NavidromeAudioHandler extends BaseAudioHandler with SeekHandler {
  static NavidromeAudioHandler? _instance;
  static NavidromeAudioHandler? get instance => _instance;

  final AudioPlayer _player;
  final _log = EventLogService();
  final _sessionService = SessionService();

  Timer? _clickTimer;
  int _clickCount = 0;

  /// Flag set when a native skip command is received from the OS.
  /// Used to suppress manual multi-click interpretation during a burst.
  bool _nativeSkipFired = false;
  Timer? _nativeSkipResetTimer;

  bool _legacyMultiClickEnabled = true;

  NavidromeAudioHandler(this._player) {
    _instance = this;
    _player.playbackEventStream.map(_transformEvent).pipe(playbackState);

    // Sync media item metadata
    _player.currentIndexStream.listen((index) {
      if (index != null &&
          _player.sequence != null &&
          index < _player.sequence!.length) {
        final source = _player.sequence![index];
        if (source.tag is MediaItem) {
          mediaItem.add(source.tag as MediaItem);
        }
      }
    });

    // Sync playback queue
    _player.sequenceStream.listen((sequence) {
      if (sequence == null) return;
      final queueItems =
          sequence.map((source) => source.tag as MediaItem).toList();
      queue.add(queueItems);
    });

    // Load initial preference
    _sessionService.legacyHeadsetMultiClick.then((v) {
      _legacyMultiClickEnabled = v;
    });
  }

  /// Updates the legacy multi-click preference at runtime.
  void setLegacyHeadsetMultiClick(bool value) {
    _legacyMultiClickEnabled = value;
    _log.log(
      'legacy headset multi-click ${value ? "enabled" : "disabled"}',
      level: EventLogLevel.debug,
    );
  }

  // ---------------------------------------------------------------------------
  // Standard Transport Controls
  // ---------------------------------------------------------------------------

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> seek(Duration position) => _player.seek(position);

  @override
  Future<void> stop() => _player.stop();

  @override
  Future<void> skipToNext() {
    _log.log('skip to next (native)', level: EventLogLevel.info);
    _markNativeSkip();
    return _player.seekToNext();
  }

  @override
  Future<void> skipToPrevious() {
    _log.log('skip to previous (native)', level: EventLogLevel.info);
    _markNativeSkip();
    return _player.seekToPrevious();
  }

  // ---------------------------------------------------------------------------
  // Media Button (Click) Handling
  // ---------------------------------------------------------------------------

  @override
  Future<void> click([MediaButton button = MediaButton.media]) async {
    // If the OS already handled this burst via native skip commands, ignore clicks.
    if (_nativeSkipFired) return;

    // Fallback logic for headsets that only send play/pause clicks.
    if (!_legacyMultiClickEnabled) {
      if (_player.playing) {
        return pause();
      } else {
        return play();
      }
    }

    _clickCount++;
    _clickTimer?.cancel();
    _clickTimer = Timer(const Duration(milliseconds: 300), () {
      final total = _clickCount;
      _clickCount = 0;

      switch (total) {
        case 1:
          if (_player.playing) {
            pause();
          } else {
            play();
          }
          break;
        case 2:
          _log.log('skip to next (multi-click fallback)', level: EventLogLevel.info);
          skipToNext();
          break;
        case >= 3:
          _log.log('skip to previous (multi-click fallback)', level: EventLogLevel.info);
          skipToPrevious();
          break;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /// Marks a native skip as fired to suppress manual click interpretation
  /// for the next 500ms.
  void _markNativeSkip() {
    _nativeSkipFired = true;
    _nativeSkipResetTimer?.cancel();
    _nativeSkipResetTimer = Timer(const Duration(milliseconds: 500), () {
      _nativeSkipFired = false;
    });
  }

  PlaybackState _transformEvent(PlaybackEvent event) {
    return PlaybackState(
      controls: [
        MediaControl.skipToPrevious,
        if (_player.playing) MediaControl.pause else MediaControl.play,
        MediaControl.stop,
        MediaControl.skipToNext,
      ],
      systemActions: const {
        MediaAction.seek,
        MediaAction.seekForward,
        MediaAction.seekBackward,
      },
      androidCompactActionIndices: const [0, 1, 3],
      processingState: const {
        ProcessingState.idle: AudioProcessingState.idle,
        ProcessingState.loading: AudioProcessingState.loading,
        ProcessingState.buffering: AudioProcessingState.buffering,
        ProcessingState.ready: AudioProcessingState.ready,
        ProcessingState.completed: AudioProcessingState.completed,
      }[_player.processingState]!,
      playing: _player.playing,
      updatePosition: _player.position,
      bufferedPosition: _player.bufferedPosition,
      speed: _player.speed,
      queueIndex: event.currentIndex,
    );
  }
}
