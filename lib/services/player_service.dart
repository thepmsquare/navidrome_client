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
  ApiService? _apiService;
  String? _lastScrobbledId;
  String? _lastSubmittedId;
  final _sessionService = SessionService();
  final _log = EventLogService();
  Timer? _positionSaveTimer;
  bool _stopPlaybackOnTaskRemoved = false;

  PlayerService._internal() {
    _init();
  }

  Future<void> _init() async {
    WidgetsBinding.instance.addObserver(this);
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());

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

    // Log player errors to the event log so they're visible on the debug screen.
    _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.idle && _currentQueue.isNotEmpty) {
        _log.log('player returned to idle unexpectedly', level: EventLogLevel.warning);
      }
    });

    _player.playbackEventStream.listen(
      (_) {},
      onError: (Object e, StackTrace st) {
        _log.log('playback event error', level: EventLogLevel.error, error: e, stackTrace: st);
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

    // handle stopping playback when app is swiped away from recents (Android specific)
    if (state == AppLifecycleState.detached) {
      if (_stopPlaybackOnTaskRemoved) {
        _log.log('app detached, stopping playback per user setting', level: EventLogLevel.info);
        _player.stop();
      }
    }
  }

  Future<void> _saveCurrentPosition() async {
    if (_player.playing || _player.position > Duration.zero) {
      await _sessionService.setLastPositionMs(_player.position.inMilliseconds);
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
    for (int i = 0; i < queue.length; i++) {
      final track = queue[i];
      final trackId = track['id']?.toString() ?? '';
      final localPath = localPaths[i];
      final localCoverPath = localCoverPaths[i];

      if (trackId.isEmpty) {
        _log.log('skipping track at index $i: missing id', level: EventLogLevel.warning);
        continue;
      }

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
  Future<void> skipToNext() => _player.seekToNext();
  Future<void> skipToPrevious() => _player.seekToPrevious();

  void setStopPlaybackOnTaskRemoved(bool value) {
    _stopPlaybackOnTaskRemoved = value;
  }

  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _positionSaveTimer?.cancel();
    _player.dispose();
  }
}
