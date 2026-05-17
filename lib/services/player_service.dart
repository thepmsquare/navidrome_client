import 'dart:async';
import 'package:flutter/material.dart';
import 'package:audio_session/audio_session.dart';
import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/event_log_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/services/session_service.dart';
import 'package:navidrome_client/utils/constants.dart';
import 'package:navidrome_client/domain/track.dart';
import 'package:navidrome_client/repositories/queue_repository.dart';
import 'package:navidrome_client/services/queue_coordinator.dart';

class PlayerService with WidgetsBindingObserver {
  static final PlayerService _instance = PlayerService._internal();
  factory PlayerService() => _instance;

  final AudioPlayer _player = AudioPlayer();
  AudioPlayer get player => _player;
  final QueueRepository _queueRepository = QueueRepository();
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

  late final Future<void> _initFuture;
  bool _isInitialized = false;

  PlayerService._internal() {
    _initFuture = _init();
  }

  Future<void> ensureInitialized() async {
    await _initFuture;
  }

  Future<void> _init() async {
    if (_isInitialized) return;
    WidgetsBinding.instance.addObserver(this);
    final session = await AudioSession.instance;
    _audioSession = session;
    await session.configure(const AudioSessionConfiguration(
      avAudioSessionCategory: AVAudioSessionCategory.playback,
      avAudioSessionMode: AVAudioSessionMode.defaultMode,
      avAudioSessionRouteSharingPolicy: AVAudioSessionRouteSharingPolicy.defaultPolicy,
      avAudioSessionCategoryOptions: AVAudioSessionCategoryOptions.none,
      androidAudioAttributes: AndroidAudioAttributes(
        contentType: AndroidAudioContentType.music,
        usage: AndroidAudioUsage.media,
      ),
      androidAudioFocusGainType: AndroidAudioFocusGainType.gain,
    ));
    // Note: We don't call setActive(true) here anymore. 
    // We'll call it right before we actually start playing.

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

    session.becomingNoisyEventStream.listen((_) {
      _log.log('audio becoming noisy (headphones unplugged), pausing', level: EventLogLevel.info);
      _player.pause();
    });

    // load initial setting for stopping playback on task removal
    _stopPlaybackOnTaskRemoved = await _sessionService.stopPlaybackOnTaskRemoved;

    // Bug 1 fix: use ?.toString() ?? '' instead of `as String` to avoid _TypeError
    // on null or non-String id values (some Subsonic implementations return int ids).
    _player.currentIndexStream.listen((index) {
      _log.log('player index changed to $index', level: EventLogLevel.debug);
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
      (event) {
        _log.log('playback event: ${event.processingState}, position: ${event.updatePosition}', level: EventLogLevel.debug);
      },
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

    // 1. run atomic one-time play queue migration from shared preferences
    await _migrateLegacyQueueIfNeeded();

    // 2. load initial queue from database synchronously
    final initialTracks = await _queueRepository.getQueue();
    _currentQueue = initialTracks.map((t) => t.toJson()).toList();

    // 3. start database-authoritative queue stream subscription
    _queueRepository.watchQueue().listen((tracks) {
      _currentQueue = tracks.map((t) => t.toJson()).toList();
      _log.log('player service: shadow queue mirror updated. count: ${_currentQueue.length}', level: EventLogLevel.debug);
    });

    _isInitialized = true;
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

  Future<void> _migrateLegacyQueueIfNeeded() async {
    final startTime = DateTime.now();
    try {
      final isComplete = await _sessionService.isQueueMigrationComplete;
      if (isComplete) {
        _log.log('queue migration: already completed in previous launch.', level: EventLogLevel.debug);
        return;
      }

      final legacyQueue = await _sessionService.lastQueue;
      if (legacyQueue == null || legacyQueue.isEmpty) {
        _log.log('queue migration: no legacy queue to migrate.', level: EventLogLevel.info);
        await _sessionService.setQueueMigrationComplete();
        return;
      }

      _log.log('queue migration: starting atomic migration of ${legacyQueue.length} items...', level: EventLogLevel.info);

      // parse and validate defensively using Track.fromJson
      final tracks = <Track>[];
      for (final raw in legacyQueue) {
        tracks.add(Track.fromJson(raw));
      }

      final index = await _sessionService.lastIndex;
      final safeIndex = index < tracks.length ? index : 0;

      // write atomically to database using QueueRepository
      await _queueRepository.replaceQueue(tracks);
      
      // set the active track index in the database table
      if (tracks.isNotEmpty) {
        await _queueRepository.setActiveTrack(tracks[safeIndex].id);
      }

      // verify post-migration constraints
      final migratedQueue = await _queueRepository.getQueue();
      final verifiedCount = migratedQueue.length;
      final expectedCount = tracks.length;

      if (verifiedCount != expectedCount) {
        throw Exception('verification failed: queue count mismatch. expected $expectedCount, got $verifiedCount');
      }

      // successfully verified!
      await _sessionService.setQueueMigrationComplete();
      final duration = DateTime.now().difference(startTime);
      _log.log('queue migration: completed successfully in ${duration.inMilliseconds}ms. count: $verifiedCount', level: EventLogLevel.info);
    } catch (e, st) {
      _log.log('queue migration: failed during atomic write. rolling back transaction...', level: EventLogLevel.error, error: e, stackTrace: st);
      // clean up any database artifacts to ensure absolute rollback
      try {
        await _queueRepository.replaceQueue([]);
      } catch (_) {}
    }
  }

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
    await ensureInitialized();
    return QueueCoordinator().enqueue(() async {
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
          await _audioSession?.setActive(true);
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

      // persist session to authoritative sqlite table
      final tracks = queue.map((raw) => Track.fromJson(raw)).toList();
      await _queueRepository.replaceQueue(tracks);
      if (tracks.isNotEmpty && initialIndex < tracks.length) {
        await _queueRepository.setActiveTrack(tracks[initialIndex].id);
      }
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
        _playlist = playlist;
        // Do NOT call _player.stop() here — just_audio handles stopping
        // internally when setAudioSource is called with a new source.
        // Calling stop() first causes just_audio_background to reset its
        // AudioHandler state, briefly clearing the MediaSession queue and
        // breaking headphone skip gestures.
        await _player.setAudioSource(playlist, initialIndex: initialIndex);
        _log.log('activating audio session', level: EventLogLevel.info);
        await _audioSession?.setActive(true);
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
    }, 'play');
  }

  Future<void> restoreSession(ApiService apiService) async {
    await ensureInitialized();
    return QueueCoordinator().enqueue(() async {
      _log.log('restoring playback session', level: EventLogLevel.info);
      final isMigrated = await _sessionService.isQueueMigrationComplete;
      List<Map<String, dynamic>> queue;
      if (isMigrated) {
        final dbQueue = await _queueRepository.getQueue();
        queue = dbQueue.map((t) => t.toJson()).toList();
        _log.log('restoring session from authoritative database. count: ${queue.length}', level: EventLogLevel.info);
      } else {
        final legacy = await _sessionService.lastQueue;
        queue = legacy ?? [];
        _log.log('restoring session from fallback legacy storage. count: ${queue.length}', level: EventLogLevel.info);
      }

      if (queue.isEmpty) {
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
    }, 'restoreSession');
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
        duration: Duration(
          seconds: int.tryParse(track['duration']?.toString() ?? '0') ?? 0,
        ),
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

  Future<void> pause() {
    _log.log('pause requested', level: EventLogLevel.info);
    return _player.pause();
  }
  Future<void> resume() {
    _log.log('resume requested', level: EventLogLevel.info);
    return _player.play();
  }
  Future<void> stop() {
    _log.log('stop requested', level: EventLogLevel.info);
    return _player.stop();
  }
  Future<void> seek(Duration position) {
    _log.log('seek requested to $position', level: EventLogLevel.info);
    return _player.seek(position);
  }
  Future<void> seekToIndex(int index) {
    _log.log('seek to index $index requested', level: EventLogLevel.info);
    return _player.seek(Duration.zero, index: index);
  }
  Future<void> skipToNext() {
    _log.log('skip to next requested', level: EventLogLevel.info);
    return _player.seekToNext();
  }
  Future<void> skipToPrevious() {
    _log.log('skip to previous requested', level: EventLogLevel.info);
    return _player.seekToPrevious();
  }

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

  Future<void> _verifyQueueIntegrity() async {
    try {
      final dbQueue = await _queueRepository.getQueue();
      final nativePlaylistLength = _playlist?.length ?? 0;
      final dbLength = dbQueue.length;

      if (_playlist != null && dbLength != nativePlaylistLength) {
        _log.log(
          'queue desync warning: database length ($dbLength) does not match native playlist length ($nativePlaylistLength)!',
          level: EventLogLevel.warning,
        );
        QueueCoordinator().recordDivergence();
        // trigger safe rebuild of native playlist to ensure perfect recovery
        final api = _apiService;
        if (api != null && _currentQueue.isNotEmpty) {
          _log.log('rebuilding native playlist from authoritative database to recover...', level: EventLogLevel.info);
          QueueCoordinator().recordRebuild();
          final safeIndex = _player.currentIndex ?? 0;
          final playlist = await _buildAudioSource(_currentQueue, api);
          _playlist = playlist;
          await _player.setAudioSource(playlist, initialIndex: safeIndex < _currentQueue.length ? safeIndex : 0);
        }
      }
    } catch (e, st) {
      _log.log('failed to perform queue integrity verification', level: EventLogLevel.warning, error: e, stackTrace: st);
    }
  }

  Future<void> removeFromQueue(int index) async {
    await ensureInitialized();
    return QueueCoordinator().enqueue(() async {
      if (index < 0 || index >= _currentQueue.length) return;

      // bail if the playlist is not loaded — mutating _currentQueue alone would
      // create a permanent index offset between _currentQueue and the audio source
      if (_playlist == null) return;

      _currentQueue.removeAt(index);
      await _playlist!.removeAt(index);
      await _queueRepository.removeFromQueue(index);

      if (_currentQueue.isEmpty) {
        await stop();
      }

      _log.log('removed track at index $index from queue', level: EventLogLevel.debug);
      await _verifyQueueIntegrity();
    }, 'removeFromQueue');
  }

  Future<void> reorderQueue(int oldIndex, int newIndex) async {
    await ensureInitialized();
    return QueueCoordinator().enqueue(() async {
      if (oldIndex < 0 || oldIndex >= _currentQueue.length) return;
      if (newIndex < 0 || newIndex >= _currentQueue.length) return;

      // bail if the playlist is not loaded to prevent index desync
      if (_playlist == null) return;

      final item = _currentQueue.removeAt(oldIndex);
      _currentQueue.insert(newIndex, item);

      await _playlist!.move(oldIndex, newIndex);
      await _queueRepository.reorderQueue(oldIndex, newIndex);

      _log.log('reordered queue: $oldIndex to $newIndex', level: EventLogLevel.debug);
      await _verifyQueueIntegrity();
    }, 'reorderQueue');
  }

  Future<void> clearQueue() async {
    await ensureInitialized();
    return QueueCoordinator().enqueue(() async {
      await stop();
      _currentQueue = [];
      _playlist = null;
      _apiService = null;
      await _queueRepository.replaceQueue([]);
      _log.log('queue cleared', level: EventLogLevel.info);
    }, 'clearQueue');
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
