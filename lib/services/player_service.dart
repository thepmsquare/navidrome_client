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

class PlayerService with WidgetsBindingObserver {
  static final PlayerService _instance = PlayerService._internal();
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
  bool _stopPlaybackOnTaskRemoved = false;
  // True while a real audio interruption is active (begin fired, end not yet).
  bool _audioInterruptionActive = false;
  // Cached audio session reference for re-activation on resume.
  AudioSession? _audioSession;

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
          _player.play();
        }
      }
    });

    // load initial setting for stopping playback on task removal
    _stopPlaybackOnTaskRemoved = await _sessionService.stopPlaybackOnTaskRemoved;

    // Bug 1 fix: use ?.toString() ?? '' instead of `as String` to avoid _TypeError
    // on null or non-String id values (some Subsonic implementations return int ids).
    _player.currentIndexStream.listen((index) {
      if (index != null && index >= 0 && index < _currentQueue.length) {
        _sessionService.setLastIndex(index);
        final track = _currentQueue[index];
        final id = track['id']?.toString() ?? '';
        if (id.isNotEmpty && id != _lastScrobbledId) {
          _lastScrobbledId = id;
          _log.log('now playing track id=$id', level: EventLogLevel.info);
          _apiService?.scrobble(id, submission: false);
          if (_apiService != null) {
            _maybeAutoDownload(track, _apiService!);
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
        if (id.isNotEmpty && id != _lastSubmittedId && position.inSeconds >= 5) {
          _lastSubmittedId = id;
          _log.log('scrobbling track id=$id (submitted)', level: EventLogLevel.debug);
          _apiService?.scrobble(id, submission: true);
        }
      }
    });

    _player.playbackEventStream.listen(
      (_) {},
      onError: (Object e, StackTrace st) {
        _log.log('playback event error', level: EventLogLevel.error, error: e, stackTrace: st);
        // attempt to skip past a broken/unreachable track so the queue continues
        if (_currentQueue.length > 1) {
          _player.seekToNext().catchError((_) {});
        }
      },
    );

    // periodic position saving
    _positionSaveTimer = Timer.periodic(sessionSaveInterval, (_) => _saveCurrentPosition());
    _log.log('player service initialised', level: EventLogLevel.debug);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
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

  Stream<int?> get currentIndexStream => _player.currentIndexStream;

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

  Future<void> play(List<Map<String, dynamic>> queue, int initialIndex, ApiService apiService) async {
    // Check if the new queue is the same as the current one.
    bool isSameQueue = _currentQueue.length == queue.length && _currentQueue.isNotEmpty;
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
        await _player.play();
        return;
      } catch (e, st) {
        _log.log('error seeking to track index=$initialIndex', level: EventLogLevel.warning, error: e, stackTrace: st);
      }
    }

    _currentQueue = List.from(queue);
    _apiService = apiService;
    _lastScrobbledId = null;
    _lastSubmittedId = null;

    // persist session
    _sessionService.setLastQueue(_currentQueue);
    _sessionService.setLastIndex(initialIndex);

    _log.log('building audio source for ${queue.length} track(s), starting at index $initialIndex', level: EventLogLevel.info);

    late ConcatenatingAudioSource playlist;
    try {
      playlist = await _buildAudioSource(_currentQueue, apiService);
    } catch (e, st) {
      _log.log('failed to build audio source', level: EventLogLevel.error, error: e, stackTrace: st);
      _currentQueue = [];
      return;
    }

    try {
      await _player.stop();
      _playlist = playlist;
      await _player.setAudioSource(playlist, initialIndex: initialIndex);
      await _player.play();
      _log.log('playback started', level: EventLogLevel.info);
    } catch (e, st) {
      _log.log('error loading audio source', level: EventLogLevel.error, error: e, stackTrace: st);
      _currentQueue = [];
      // Bug 2 fix: reset player to idle so subsequent play() calls start clean.
      try {
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

    final index = await _sessionService.lastIndex;
    final positionMs = await _sessionService.lastPositionMs;

    _currentQueue = queue;
    _apiService = apiService;
    // reset scrobble guards so the first restored track is submitted correctly
    _lastScrobbledId = null;
    _lastSubmittedId = null;

    late ConcatenatingAudioSource playlist;
    try {
      playlist = await _buildAudioSource(_currentQueue, apiService);
    } catch (e, st) {
      _log.log('failed to build audio source during session restore', level: EventLogLevel.error, error: e, stackTrace: st);
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
      _log.log('session restored: index=$safeIndex position=${safePositionMs}ms', level: EventLogLevel.info);
      // do not auto-play on restoration per plan
    } catch (e, st) {
      _log.log('error restoring session', level: EventLogLevel.error, error: e, stackTrace: st);
      _currentQueue = [];
      try {
        await _player.stop();
      } catch (_) {}
    }
  }

  Future<ConcatenatingAudioSource> _buildAudioSource(List<Map<String, dynamic>> queue, ApiService apiService) async {
    final offlineService = OfflineService();
    final localPaths = await Future.wait(
      queue.map((t) => offlineService.getLocalPath(t['id']?.toString() ?? '')),
    );
    // Bug 4 fix: use ?.toString() instead of `as String?` to avoid _TypeError
    // when a Subsonic server returns coverArt as an integer id.
    final localCoverPaths = await Future.wait(
      queue.map((t) => offlineService.getLocalCoverArtPath(t['coverArt']?.toString())),
    );

    final playlistList = <AudioSource>[];
    final validQueue = <Map<String, dynamic>>[];
    for (int i = 0; i < queue.length; i++) {
      final track = queue[i];
      final trackId = track['id']?.toString() ?? '';
      final localPath = localPaths[i];
      final localCoverPath = localCoverPaths[i];

      if (trackId.isEmpty) {
        _log.log('skipping track at index $i: missing id', level: EventLogLevel.warning);
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
            : AudioSource.uri(Uri.parse(apiService.getStreamUrl(trackId)), tag: tag),
      );
    }

    // Sync _currentQueue to only the tracks that made it into the playlist.
    // Any skipped (empty-id) tracks would otherwise cause a permanent index
    // offset between _currentQueue and ConcatenatingAudioSource.
    if (validQueue.length != queue.length) {
      _currentQueue = validQueue;
    }

    _log.log('audio source built: ${playlistList.length}/${queue.length} tracks', level: EventLogLevel.debug);

    return ConcatenatingAudioSource(
      useLazyPreparation: true,
      children: playlistList,
    );
  }

  Future<void> pause() => _player.pause();
  Future<void> resume() => _player.play();
  Future<void> stop() => _player.stop();
  Future<void> seek(Duration position) => _player.seek(position);
  Future<void> seekToIndex(int index) => _player.seek(Duration.zero, index: index);
  Future<void> skipToNext() => _player.seekToNext();
  Future<void> skipToPrevious() => _player.seekToPrevious();

  void setStopPlaybackOnTaskRemoved(bool value) {
    _stopPlaybackOnTaskRemoved = value;
  }

  /// Fire-and-forget: auto-download the current track if the feature is enabled
  /// and the storage cap has not been exceeded.
  void _maybeAutoDownload(Map<String, dynamic> track, ApiService apiService) {
    () async {
      try {
        final enabled = await _sessionService.autoDownloadPlayed;
        if (!enabled) return;

        final trackId = track['id']?.toString() ?? '';
        if (trackId.isEmpty) return;

        final offlineService = OfflineService();
        if (offlineService.isTrackOfflineSync(trackId)) return;

        final maxBytes = await _sessionService.autoDownloadMaxBytes;
        final lruEvict = await _sessionService.autoDownloadLruEvict;

        var currentSize = await offlineService.getOfflineTracksSizeBytes();

        // evict oldest auto-downloaded tracks until we have room or nothing left
        while (currentSize >= maxBytes && lruEvict) {
          final evicted = await offlineService.evictOldestAutoDownload();
          if (evicted == null) break;
          _log.log(
            'auto-download: evicted $evicted to make room',
            level: EventLogLevel.debug,
          );
          currentSize = await offlineService.getOfflineTracksSizeBytes();
        }

        if (currentSize >= maxBytes) {
          _log.log(
            'auto-download: skipping $trackId — storage cap reached (${currentSize}B >= ${maxBytes}B)',
            level: EventLogLevel.debug,
          );
          return;
        }

        _log.log('auto-download: queuing $trackId', level: EventLogLevel.debug);
        await offlineService.downloadTrack(track, apiService, isExplicit: false);
      } catch (e, st) {
        _log.log(
          'auto-download failed',
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
    _log.log('removed track at index $index from queue', level: EventLogLevel.debug);
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
    _log.log('reordered queue: $oldIndex to $newIndex', level: EventLogLevel.debug);
  }

  Future<void> clearQueue() async {
    await stop();
    _currentQueue = [];
    _playlist = null;
    _apiService = null;
    _sessionService.setLastQueue([]);
    _log.log('queue cleared', level: EventLogLevel.info);
  }

  Future<void> reset() async {
    await clearQueue();
    _lastScrobbledId = null;
    _lastSubmittedId = null;
    _log.log('player service reset', level: EventLogLevel.debug);
  }

  Future<void> toggleShuffleMode() async {
    final enabled = !_player.shuffleModeEnabled;
    await _player.setShuffleModeEnabled(enabled);
    _log.log('shuffle mode ${enabled ? 'enabled' : 'disabled'}', level: EventLogLevel.debug);
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
    final index = _currentQueue.indexWhere((t) => (t['id']?.toString() ?? '') == id);
    if (index != -1) {
      _currentQueue[index]['userRating'] = rating;
      _log.log('updated track rating for $id to $rating in queue', level: EventLogLevel.debug);
    }
  }

  void updateTrackStarred(String id, bool starred) {
    final index = _currentQueue.indexWhere((t) => (t['id']?.toString() ?? '') == id);
    if (index != -1) {
      if (starred) {
        _currentQueue[index]['starred'] = DateTime.now().toIso8601String();
      } else {
        _currentQueue[index].remove('starred');
      }
      _log.log('updated track starred status for $id to $starred in queue', level: EventLogLevel.debug);
    }
  }

  // PlayerService is a singleton that lives for the entire app lifetime.
  // dispose() should only be called from the root widget's dispose() if the
  // app ever tears down the player intentionally (e.g., on logout).
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _positionSaveTimer?.cancel();
    _player.dispose();
  }
}
