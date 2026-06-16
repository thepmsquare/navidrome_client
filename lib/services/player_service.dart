import 'dart:async';
import 'package:flutter/material.dart';
import 'package:audio_session/audio_session.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/event_log_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/services/session_service.dart';
import 'package:navidrome_client/utils/constants.dart';

class SleepTimerState {
  final Duration? remainingTime;
  final bool pauseAtEndOfTrack;
  final bool isPendingEndOfTrackPause;

  const SleepTimerState({
    this.remainingTime,
    this.pauseAtEndOfTrack = false,
    this.isPendingEndOfTrackPause = false,
  });

  bool get isActive => remainingTime != null || isPendingEndOfTrackPause;
}

class PlayerService with WidgetsBindingObserver {
  static final PlayerService _instance = PlayerService._internal();
  static PlayerService get instance => _instance;
  factory PlayerService() => _instance;

  final AudioPlayer _player = AudioPlayer();
  List<Map<String, dynamic>> _currentQueue = [];
  ConcatenatingAudioSource? _playlist;
  ApiService? _apiService;
  String? _lastScrobbledId;
  String? _lastSubmittedId;
  final _sessionService = SessionService();
  final _log = EventLogService();
  Timer? _positionSaveTimer;
  Timer? _sleepTimer;
  Timer? _sleepCountdownTimer;
  DateTime? _sleepTimerEndTime;
  final ValueNotifier<SleepTimerState> sleepTimerNotifier = ValueNotifier(const SleepTimerState());
  bool _stopPlaybackOnTaskRemoved = false;
  // True while a real audio interruption is active (begin fired, end not yet).
  bool _audioInterruptionActive = false;
  // Cached audio session reference for re-activation on resume.
  AudioSession? _audioSession;

  // Media button multi-tap detection state.
  // Earphone double/triple taps arrive as rapid PLAY_PAUSE key events which
  // just_audio_background translates into individual play/pause calls.  We
  // count these rapid state-toggles and dispatch skip actions accordingly.
  int _mediaButtonTapCount = 0;
  Timer? _mediaButtonTapTimer;
  bool? _mediaButtonStateBeforeTaps;
  bool _lastKnownPlaying = false;
  static const _mediaButtonTapWindow = Duration(milliseconds: 600);

  bool _programmaticActionPending = false;
  Timer? _pendingActionTimeout;

  void _markProgrammaticAction(bool targetPlaying) {
    if (_player.playing != targetPlaying) {
      _programmaticActionPending = true;
      _pendingActionTimeout?.cancel();
      _pendingActionTimeout = Timer(const Duration(seconds: 2), () {
        _programmaticActionPending = false;
      });
    }
  }

  PlayerService._internal() {
    _init();
  }

  Future<void> _init() async {
    WidgetsBinding.instance.addObserver(this);
    final session = await AudioSession.instance;
    _audioSession = session;
    await session.configure(const AudioSessionConfiguration.music());
    await session.setActive(true);

    // handle audio interruptions (phone calls, navigation prompts, other apps)
    session.interruptionEventStream.listen((event) {
      if (event.begin) {
        _audioInterruptionActive = true;
        if (event.type == AudioInterruptionType.duck) {
          _player.setVolume(0.5);
        } else {
          _player.pause();
        }
      } else {
        if (!_audioInterruptionActive) return;
        _audioInterruptionActive = false;
        if (event.type == AudioInterruptionType.duck) {
          _player.setVolume(1.0);
        } else {
          // Just call play. just_audio is smart enough to handle its own
          // internal state, and we've removed the manual 'resume' logic
          // that was causing conflicts.
          _markProgrammaticAction(true);
          _player.play();
        }
      }
    });

    // load initial setting for stopping playback on task removal
    _stopPlaybackOnTaskRemoved =
        await _sessionService.stopPlaybackOnTaskRemoved;

    // Bug 1 fix: use ?.toString() ?? '' instead of `as String` to avoid _TypeError
    // on null or non-String id values (some Subsonic implementations return int ids).
    _player.currentIndexStream.listen((index) {
      if (sleepTimerNotifier.value.isPendingEndOfTrackPause) {
        pause();
        cancelSleepTimer();
        return;
      }
      if (index != null && index >= 0 && index < _currentQueue.length) {
        _sessionService.setLastIndex(index);
        final track = _currentQueue[index];
        final id = track['id']?.toString() ?? '';
        if (id.isNotEmpty && id != _lastScrobbledId) {
          _lastScrobbledId = id;
          _log.log('now playing track id=$id', level: EventLogLevel.info);
          _apiService?.scrobble(id, submission: false);
          if (_apiService != null) {
            _maybeAutoSaveOffline(track, _apiService!);
          }
        }
      }
    });

    _player.positionStream.listen((position) {
      final index = _player.currentIndex;
      if (index != null && index >= 0 && index < _currentQueue.length) {
        final track = _currentQueue[index];
        // Bug 1 fix: same safe cast here
        final id = track['id']?.toString() ?? '';
        if (id.isNotEmpty &&
            id != _lastSubmittedId &&
            position.inSeconds >= 5) {
          _lastSubmittedId = id;
          _log.log(
            'scrobbling track id=$id (submitted)',
            level: EventLogLevel.debug,
          );
          _apiService?.scrobble(id, submission: true);
        }
      }
    });

    _player.playbackEventStream.listen(
      (_) {},
      onError: (Object e, StackTrace st) {
        _log.log(
          'playback event error',
          level: EventLogLevel.error,
          error: e,
          stackTrace: st,
        );
        // attempt to skip past a broken/unreachable track so the queue continues
        if (_currentQueue.length > 1) {
          skipToNext().catchError((_) {});
        }
      },
    );

    // periodic position saving
    _positionSaveTimer = Timer.periodic(
      sessionSaveInterval,
      (_) => _saveCurrentPosition(),
    );

    // media button multi-tap detection.
    // earphone double/triple taps arrive as rapid PLAY_PAUSE key events.
    // we watch for rapid playing-state toggles and coalesce them into skip
    // actions.  a single tap is left as a normal play/pause.
    _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        if (sleepTimerNotifier.value.isPendingEndOfTrackPause) {
          pause();
        }
        cancelSleepTimer();
      }
      // don't interfere during audio interruptions
      if (_audioInterruptionActive) return;
      // only detect when we have a queue loaded
      if (_currentQueue.isEmpty) return;
      // only count actual play/pause toggles — ignore state transitions
      // from setAudioSource (idle→loading→ready) which would otherwise be
      // misdetected as rapid media-button taps and trigger auto-play.
      if (state.processingState != ProcessingState.ready) return;

      final isPlaying = state.playing;

      // only count when the playing boolean actually flips — a ready-state
      // emission without a toggle (e.g. from setAudioSource finishing) must
      // not be counted as a media-button tap.
      if (isPlaying == _lastKnownPlaying) return;

      if (_programmaticActionPending) {
        _programmaticActionPending = false;
        _pendingActionTimeout?.cancel();
        _lastKnownPlaying = isPlaying;
        _mediaButtonTapCount = 0;
        _mediaButtonTapTimer?.cancel();
        _mediaButtonStateBeforeTaps = null;
        return;
      }

      _lastKnownPlaying = isPlaying;

      _mediaButtonTapCount++;

      if (_mediaButtonTapCount == 1) {
        // first tap — remember the state before any taps so we can
        // restore it if we need to cancel the play/pause side-effect
        _mediaButtonStateBeforeTaps = !isPlaying;
      }

      _mediaButtonTapTimer?.cancel();
      _mediaButtonTapTimer = Timer(_mediaButtonTapWindow, () {
        final taps = _mediaButtonTapCount;
        final wasPlaying = _mediaButtonStateBeforeTaps ?? false;
        _mediaButtonTapCount = 0;
        _mediaButtonStateBeforeTaps = null;

        if (taps == 2) {
          _log.log(
            'media button double-tap detected — skip to next',
            level: EventLogLevel.debug,
          );
          // restore original play state then skip
          if (wasPlaying && !_player.playing) {
            _player.play();
          }
          skipToNext();
        } else if (taps >= 3) {
          _log.log(
            'media button triple-tap detected — skip to previous',
            level: EventLogLevel.debug,
          );
          // restore original play state then skip back
          if (wasPlaying && !_player.playing) {
            _player.play();
          }
          skipToPrevious();
        }
        // taps == 1 → normal play/pause, already handled by just_audio
      });
    });

    _log.log('player service initialised', level: EventLogLevel.debug);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _saveCurrentPosition();
    }

    if (state == AppLifecycleState.resumed) {
      // Re-activate session just in case, but don't touch the player.
      _audioSession?.setActive(true);
    }

    // handle stopping playback when app is swiped away from recents (Android specific)
    if (state == AppLifecycleState.detached) {
      if (_stopPlaybackOnTaskRemoved) {
        _player.stop();
      }
    }
  }

  Future<void> _saveCurrentPosition() async {
    final pos = _player.position;
    if (pos > Duration.zero) {
      await _sessionService.setLastPositionMs(pos.inMilliseconds);
    }
  }

  AudioPlayer get player => _player;
  List<Map<String, dynamic>> get currentQueue => _currentQueue;

  Stream<int?> get currentIndexStream =>
      _player.sequenceStateStream.map((state) => state?.currentIndex);

  Map<String, dynamic>? get currentTrack {
    final index = _player.currentIndex;
    if (index != null && index >= 0 && index < _currentQueue.length) {
      final tag = _player.sequence?[index].tag;
      if (tag is MediaItem) {
        return _currentQueue[index];
      }
    }
    return null;
  }

  String get queueSignature {
    if (_currentQueue.isEmpty) return 'empty';
    final firstId = _currentQueue.first['id']?.toString() ?? 'none';
    final lastId = _currentQueue.last['id']?.toString() ?? 'none';
    return '${firstId}_${lastId}_${_currentQueue.length}';
  }

  Future<void> play(
    List<Map<String, dynamic>> queue,
    int initialIndex,
    ApiService apiService,
  ) async {
    // Check if the new queue is the same as the current one.
    bool isSameQueue =
        _currentQueue.length == queue.length && _currentQueue.isNotEmpty;
    if (isSameQueue) {
      for (int i = 0; i < queue.length; i++) {
        if (_currentQueue[i]['id'] != queue[i]['id']) {
          isSameQueue = false;
          break;
        }
      }
    }

    if (isSameQueue) {
      try {
        await _player.seek(Duration.zero, index: initialIndex);
        _markProgrammaticAction(true);
        await _player.play();
        return;
      } catch (e, st) {
        _log.log(
          'error seeking to track index=$initialIndex',
          level: EventLogLevel.warning,
          error: e,
          stackTrace: st,
        );
      }
    }

    _currentQueue = List.from(queue);
    _apiService = apiService;
    _lastScrobbledId = null;
    _lastSubmittedId = null;

    // persist session
    _sessionService.setLastQueue(_currentQueue);
    _sessionService.setLastIndex(initialIndex);

    _log.log(
      'building audio source for ${queue.length} track(s), starting at index $initialIndex',
      level: EventLogLevel.info,
    );

    late ConcatenatingAudioSource playlist;
    try {
      playlist = await _buildAudioSource(_currentQueue, apiService);
    } catch (e, st) {
      _log.log(
        'failed to build audio source',
        level: EventLogLevel.error,
        error: e,
        stackTrace: st,
      );
      _currentQueue = [];
      return;
    }

    try {
      _markProgrammaticAction(false);
      await _player.stop();
      _playlist = playlist;
      await _player.setAudioSource(playlist, initialIndex: initialIndex);
      _markProgrammaticAction(true);
      await _player.play();
      _log.log('playback started', level: EventLogLevel.info);
    } catch (e, st) {
      _log.log(
        'error loading audio source',
        level: EventLogLevel.error,
        error: e,
        stackTrace: st,
      );
      _currentQueue = [];
      // Bug 2 fix: reset player to idle so subsequent play() calls start clean.
      try {
        _markProgrammaticAction(false);
        await _player.stop();
      } catch (_) {}
    }
  }

  Future<void> restoreSession(ApiService apiService) async {
    _log.log('restoring playback session', level: EventLogLevel.info);
    final queue = await _sessionService.lastQueue;
    if (queue == null || queue.isEmpty) {
      _log.log('no session to restore', level: EventLogLevel.debug);
      return;
    }

    _apiService = apiService;

    // if player already has an active audio source or sequence, sync UI/memory state only
    if (_player.audioSource != null || _player.sequence != null) {
      _log.log(
        'player is already active, syncing in-memory state without resetting playback',
        level: EventLogLevel.info,
      );
      _currentQueue = queue;
      if (_player.audioSource is ConcatenatingAudioSource) {
        _playlist = _player.audioSource as ConcatenatingAudioSource;
      }
      return;
    }

    final index = await _sessionService.lastIndex;
    final positionMs = await _sessionService.lastPositionMs;

    _currentQueue = queue;
    // reset scrobble guards so the first restored track is submitted correctly
    _lastScrobbledId = null;
    _lastSubmittedId = null;

    late ConcatenatingAudioSource playlist;
    try {
      playlist = await _buildAudioSource(_currentQueue, apiService);
    } catch (e, st) {
      _log.log(
        'failed to build audio source during session restore',
        level: EventLogLevel.error,
        error: e,
        stackTrace: st,
      );
      _currentQueue = [];
      return;
    }

    try {
      final safeIndex = index < queue.length ? index : 0;
      // Bug 3 fix: clamp initialPosition to avoid out-of-range position crashing
      // setAudioSource (track duration is unknown until loaded, so we pass the
      // saved position and let the backend clamp it; we also guard against
      // clearly bogus values).
      final safePositionMs = positionMs > 0 ? positionMs : 0;
      _playlist = playlist;
      await _player.setAudioSource(
        playlist,
        initialIndex: safeIndex,
        initialPosition: Duration(milliseconds: safePositionMs),
      );
      _log.log(
        'session restored: index=$safeIndex position=${safePositionMs}ms',
        level: EventLogLevel.info,
      );
      // do not auto-play on restoration per plan
    } catch (e, st) {
      _log.log(
        'error restoring session',
        level: EventLogLevel.error,
        error: e,
        stackTrace: st,
      );
      _currentQueue = [];
      try {
        await _player.stop();
      } catch (_) {}
    }
  }

  Future<ConcatenatingAudioSource> _buildAudioSource(
    List<Map<String, dynamic>> queue,
    ApiService apiService,
  ) async {
    final offlineService = OfflineService();
    final localPaths = await Future.wait(
      queue.map((t) => offlineService.getLocalPath(t['id']?.toString() ?? '')),
    );
    // Bug 4 fix: use ?.toString() instead of `as String?` to avoid _TypeError
    // when a Subsonic server returns coverArt as an integer id.
    final localCoverPaths = await Future.wait(
      queue.map(
        (t) => offlineService.getLocalCoverArtPath(t['coverArt']?.toString()),
      ),
    );

    final playlistList = <AudioSource>[];
    final validQueue = <Map<String, dynamic>>[];
    for (int i = 0; i < queue.length; i++) {
      final track = queue[i];
      final trackId = track['id']?.toString() ?? '';
      final localPath = localPaths[i];
      final localCoverPath = localCoverPaths[i];

      if (trackId.isEmpty) {
        _log.log(
          'skipping track at index $i: missing id',
          level: EventLogLevel.warning,
        );
        continue;
      }

      validQueue.add(track);

      final artUri = localCoverPath != null
          ? Uri.file(localCoverPath)
          : Uri.parse(apiService.getCoverArtUrl(trackId));

      final tag = MediaItem(
        id: trackId,
        album: track['album']?.toString(),
        title: (track['title']?.toString()) ?? 'unknown',
        artist: track['artist']?.toString(),
        artUri: artUri,
      );

      playlistList.add(
        localPath != null
            ? AudioSource.file(localPath, tag: tag)
            : AudioSource.uri(
                Uri.parse(apiService.getStreamUrl(trackId)),
                tag: tag,
              ),
      );
    }

    // Sync _currentQueue to only the tracks that made it into the playlist.
    // Any skipped (empty-id) tracks would otherwise cause a permanent index
    // offset between _currentQueue and ConcatenatingAudioSource.
    if (validQueue.length != queue.length) {
      _currentQueue = validQueue;
    }

    _log.log(
      'audio source built: ${playlistList.length}/${queue.length} tracks',
      level: EventLogLevel.debug,
    );

    return ConcatenatingAudioSource(
      useLazyPreparation: true,
      children: playlistList,
    );
  }

  Future<void> pause() {
    _markProgrammaticAction(false);
    return _player.pause();
  }

  Future<void> resume() {
    _markProgrammaticAction(true);
    return _player.play();
  }

  Future<void> stop() {
    _markProgrammaticAction(false);
    return _player.stop();
  }

  Future<void> seek(Duration position) => _player.seek(position);
  Future<void> seekToIndex(int index) async {
    // If the player is already at this index, don't seek to Duration.zero
    // which would reset the playback position (e.g. after catching up from
    // background track-skips).
    if (_player.currentIndex == index) return;
    return _player.seek(Duration.zero, index: index);
  }

  Future<void> skipToNext() async {
    if (_player.loopMode == LoopMode.one) {
      try {
        await _player.setLoopMode(LoopMode.all);
        await _player.seekToNext();
      } finally {
        await _player.setLoopMode(LoopMode.one);
      }
    } else {
      await _player.seekToNext();
    }
  }

  Future<void> skipToPrevious() async {
    if (_player.loopMode == LoopMode.one) {
      try {
        await _player.setLoopMode(LoopMode.all);
        await _player.seekToPrevious();
      } finally {
        await _player.setLoopMode(LoopMode.one);
      }
    } else {
      await _player.seekToPrevious();
    }
  }

  void setStopPlaybackOnTaskRemoved(bool value) {
    _stopPlaybackOnTaskRemoved = value;
  }

  /// Fire-and-forget: auto-save offline the current track if the feature is enabled
  /// and the storage cap has not been exceeded.
  void _maybeAutoSaveOffline(
    Map<String, dynamic> track,
    ApiService apiService,
  ) {
    () async {
      try {
        final enabled = await _sessionService.autoSaveOfflinePlayed;
        if (!enabled) return;

        final trackId = track['id']?.toString() ?? '';
        if (trackId.isEmpty) return;

        final offlineService = OfflineService();
        if (offlineService.isTrackOfflineSync(trackId)) return;

        final maxBytes = await _sessionService.autoSaveOfflineMaxBytes;
        final lruEvict = await _sessionService.autoSaveOfflineLruEvict;

        var currentSize = await offlineService.getOfflineTracksSizeBytes();

        // evict oldest auto-saved tracks until we have room or nothing left
        while (currentSize >= maxBytes && lruEvict) {
          final evicted = await offlineService.evictOldestAutoSaveOffline();
          if (evicted == null) break;
          _log.log(
            'auto-save offline: evicted $evicted to make room',
            level: EventLogLevel.debug,
          );
          currentSize = await offlineService.getOfflineTracksSizeBytes();
        }

        if (currentSize >= maxBytes) {
          _log.log(
            'auto-save offline: skipping $trackId — storage cap reached (${currentSize}B >= ${maxBytes}B)',
            level: EventLogLevel.debug,
          );
          return;
        }

        _log.log(
          'auto-save offline: queuing $trackId',
          level: EventLogLevel.debug,
        );
        await offlineService.saveTrackOffline(
          track,
          apiService,
          isExplicit: false,
        );
      } catch (e, st) {
        _log.log(
          'auto-save offline failed',
          level: EventLogLevel.warning,
          error: e,
          stackTrace: st,
        );
      }
    }();
  }

  Future<void> removeFromQueue(int index) async {
    if (index < 0 || index >= _currentQueue.length) return;

    // bail if the playlist is not loaded — mutating _currentQueue alone would
    // create a permanent index offset between _currentQueue and the audio source
    if (_playlist == null) return;

    _currentQueue.removeAt(index);
    await _playlist!.removeAt(index);

    if (_currentQueue.isEmpty) {
      await stop();
    }

    _sessionService.setLastQueue(_currentQueue);
    _log.log(
      'removed track at index $index from queue',
      level: EventLogLevel.debug,
    );
  }

  Future<void> reorderQueue(int oldIndex, int newIndex) async {
    if (oldIndex < 0 || oldIndex >= _currentQueue.length) return;
    if (newIndex < 0 || newIndex >= _currentQueue.length) return;

    // bail if the playlist is not loaded to prevent index desync
    if (_playlist == null) return;

    final item = _currentQueue.removeAt(oldIndex);
    _currentQueue.insert(newIndex, item);

    await _playlist!.move(oldIndex, newIndex);

    _sessionService.setLastQueue(_currentQueue);
    _log.log(
      'reordered queue: $oldIndex to $newIndex',
      level: EventLogLevel.debug,
    );
  }

  Future<void> clearQueue() async {
    await stop();
    _currentQueue = [];
    _playlist = null;
    _apiService = null;
    _sessionService.setLastQueue([]);
    cancelSleepTimer();
    _log.log('queue cleared', level: EventLogLevel.info);
  }

  Future<void> reset() async {
    await clearQueue();
    _lastScrobbledId = null;
    _lastSubmittedId = null;
    _mediaButtonTapTimer?.cancel();
    _mediaButtonTapCount = 0;
    _mediaButtonStateBeforeTaps = null;
    _lastKnownPlaying = false;
    cancelSleepTimer();
    _log.log('player service reset', level: EventLogLevel.debug);
  }

  Future<void> toggleShuffleMode() async {
    final enabled = !_player.shuffleModeEnabled;
    await _player.setShuffleModeEnabled(enabled);
    _log.log(
      'shuffle mode ${enabled ? 'enabled' : 'disabled'}',
      level: EventLogLevel.debug,
    );
  }

  Future<void> toggleLoopMode() async {
    final current = _player.loopMode;
    late LoopMode next;
    switch (current) {
      case LoopMode.off:
        next = LoopMode.all;
      case LoopMode.all:
        next = LoopMode.one;
      case LoopMode.one:
        next = LoopMode.off;
    }
    await _player.setLoopMode(next);
    _log.log('loop mode set to $next', level: EventLogLevel.debug);
  }

  void updateTrackRating(String id, int rating) {
    final index = _currentQueue.indexWhere(
      (t) => (t['id']?.toString() ?? '') == id,
    );
    if (index != -1) {
      _currentQueue[index]['userRating'] = rating;
      _log.log(
        'updated track rating for $id to $rating in queue',
        level: EventLogLevel.debug,
      );
    }
  }

  void updateTrackStarred(String id, bool starred) {
    final index = _currentQueue.indexWhere(
      (t) => (t['id']?.toString() ?? '') == id,
    );
    if (index != -1) {
      if (starred) {
        _currentQueue[index]['starred'] = DateTime.now().toIso8601String();
      } else {
        _currentQueue[index].remove('starred');
      }
      _log.log(
        'updated track starred status for $id to $starred in queue',
        level: EventLogLevel.debug,
      );
    }
  }

  void setSleepTimer(Duration duration, {required bool pauseAtEndOfTrack}) {
    cancelSleepTimer();
    _sleepTimerEndTime = DateTime.now().add(duration);
    _log.log(
      'sleep timer set for $duration (pause at end of track: $pauseAtEndOfTrack)',
      level: EventLogLevel.info,
    );

    sleepTimerNotifier.value = SleepTimerState(
      remainingTime: duration,
      pauseAtEndOfTrack: pauseAtEndOfTrack,
      isPendingEndOfTrackPause: false,
    );

    _sleepTimer = Timer(duration, () {
      _triggerSleepTimeout();
    });

    _sleepCountdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_sleepTimerEndTime == null) {
        timer.cancel();
        return;
      }
      final remaining = _sleepTimerEndTime!.difference(DateTime.now());
      if (remaining.isNegative) {
        timer.cancel();
      } else {
        sleepTimerNotifier.value = SleepTimerState(
          remainingTime: remaining,
          pauseAtEndOfTrack: pauseAtEndOfTrack,
          isPendingEndOfTrackPause: false,
        );
      }
    });
  }

  void cancelSleepTimer() {
    _sleepTimer?.cancel();
    _sleepTimer = null;
    _sleepCountdownTimer?.cancel();
    _sleepCountdownTimer = null;
    _sleepTimerEndTime = null;
    sleepTimerNotifier.value = const SleepTimerState();
    _log.log('sleep timer cancelled', level: EventLogLevel.debug);
  }

  void _triggerSleepTimeout() {
    _sleepTimer?.cancel();
    _sleepTimer = null;
    _sleepCountdownTimer?.cancel();
    _sleepCountdownTimer = null;
    _sleepTimerEndTime = null;

    final state = sleepTimerNotifier.value;
    if (state.pauseAtEndOfTrack) {
      _log.log(
        'sleep timer duration expired, waiting for song to end before pausing',
        level: EventLogLevel.info,
      );
      sleepTimerNotifier.value = const SleepTimerState(
        remainingTime: null,
        pauseAtEndOfTrack: true,
        isPendingEndOfTrackPause: true,
      );
    } else {
      _log.log('sleep timer triggered, pausing playback', level: EventLogLevel.info);
      pause();
      cancelSleepTimer();
    }
  }

  // PlayerService is a singleton that lives for the entire app lifetime.
  // dispose() should only be called from the root widget's dispose() if the
  // app ever tears down the player intentionally (e.g., on logout).
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _positionSaveTimer?.cancel();
    _mediaButtonTapTimer?.cancel();
    _pendingActionTimeout?.cancel();
    cancelSleepTimer();
    _player.dispose();
  }
}
