import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:audio_session/audio_session.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:navidrome_client/services/api_service.dart';
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
  Timer? _positionSaveTimer;

  PlayerService._internal() {
    _init();
  }

  Future<void> _init() async {
    WidgetsBinding.instance.addObserver(this);
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());

    _player.currentIndexStream.listen((index) {
      if (index != null && index >= 0 && index < _currentQueue.length) {
        _sessionService.setLastIndex(index);
        final track = _currentQueue[index];
        final id = track['id'] as String;
        if (id != _lastScrobbledId) {
          _lastScrobbledId = id;
          _apiService?.scrobble(id, submission: false);
        }
      }
    });

    _player.positionStream.listen((position) {
      final index = _player.currentIndex;
      if (index != null && index >= 0 && index < _currentQueue.length) {
        final track = _currentQueue[index];
        final id = track['id'] as String;
        if (id != _lastSubmittedId && position.inSeconds >= 5) {
          _lastSubmittedId = id;
          _apiService?.scrobble(id, submission: true);
        }
      }
    });

    // periodic position saving
    _positionSaveTimer = Timer.periodic(sessionSaveInterval, (_) => _saveCurrentPosition());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _saveCurrentPosition();
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
      } catch (e) {
        debugPrint("error seeking to track: $e");
      }
    }

    _currentQueue = List.from(queue);
    _apiService = apiService;
    _lastScrobbledId = null;
    _lastSubmittedId = null;

    // persist session
    _sessionService.setLastQueue(_currentQueue);
    _sessionService.setLastIndex(initialIndex);

    final playlist = await _buildAudioSource(_currentQueue, apiService);

    try {
      await _player.stop();
      await _player.setAudioSource(playlist, initialIndex: initialIndex);
      await _player.play();
    } catch (e) {
      debugPrint("error loading audio: $e");
      _currentQueue = [];
    }
  }

  Future<void> restoreSession(ApiService apiService) async {
    final queue = await _sessionService.lastQueue;
    if (queue == null || queue.isEmpty) return;

    final index = await _sessionService.lastIndex;
    final positionMs = await _sessionService.lastPositionMs;

    _currentQueue = queue;
    _apiService = apiService;

    final playlist = await _buildAudioSource(_currentQueue, apiService);

    try {
      await _player.setAudioSource(
        playlist,
        initialIndex: index < queue.length ? index : 0,
        initialPosition: Duration(milliseconds: positionMs),
      );
      // do not auto-play on restoration per plan
    } catch (e) {
      debugPrint("error restoring session: $e");
      _currentQueue = [];
    }
  }

  Future<ConcatenatingAudioSource> _buildAudioSource(List<Map<String, dynamic>> queue, ApiService apiService) async {
    final offlineService = OfflineService();
    final localPaths = await Future.wait(
      queue.map((t) => offlineService.getLocalPath(t['id'] as String)),
    );
    final localCoverPaths = await Future.wait(
      queue.map((t) => offlineService.getLocalCoverArtPath(t['coverArt'] as String?)),
    );

    final playlistList = <AudioSource>[];
    for (int i = 0; i < queue.length; i++) {
      final track = queue[i];
      final trackId = track['id'] as String;
      final localPath = localPaths[i];
      final localCoverPath = localCoverPaths[i];

      final artUri = localCoverPath != null
          ? Uri.file(localCoverPath)
          : Uri.parse(apiService.getCoverArtUrl(trackId));

      final tag = MediaItem(
        id: trackId,
        album: track['album'] as String?,
        title: (track['title'] as String?) ?? 'unknown',
        artist: track['artist'] as String?,
        artUri: artUri,
      );

      playlistList.add(
        localPath != null
            ? AudioSource.file(localPath, tag: tag)
            : AudioSource.uri(Uri.parse(apiService.getStreamUrl(trackId)), tag: tag),
      );
    }

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
  
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _positionSaveTimer?.cancel();
    _player.dispose();
  }
}
