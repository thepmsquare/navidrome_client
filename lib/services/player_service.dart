import 'package:flutter/foundation.dart';
import 'package:audio_session/audio_session.dart';
import 'package:just_audio/just_audio.dart';
import 'package:navidrome_client/services/api_service.dart';

class PlayerService {
  static final PlayerService _instance = PlayerService._internal();
  factory PlayerService() => _instance;

  final AudioPlayer _player = AudioPlayer();
  List<Map<String, dynamic>> _currentQueue = [];
  ApiService? _apiService;
  String? _lastScrobbledId;
  String? _lastSubmittedId;

  PlayerService._internal() {
    _init();
  }

  Future<void> _init() async {
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());

    _player.currentIndexStream.listen((index) {
      if (index != null && index >= 0 && index < _currentQueue.length) {
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
  }

  AudioPlayer get player => _player;
  List<Map<String, dynamic>> get currentQueue => _currentQueue;

  Stream<int?> get currentIndexStream => _player.currentIndexStream;

  Map<String, dynamic>? get currentTrack {
    final index = _player.currentIndex;
    if (index != null && index >= 0 && index < _currentQueue.length) {
      return _currentQueue[index];
    }
    return null;
  }

  Future<void> play(List<Map<String, dynamic>> queue, int initialIndex, ApiService apiService) async {
    _currentQueue = queue;
    _apiService = apiService;
    _lastScrobbledId = null;
    _lastSubmittedId = null;
    
    final playlist = ConcatenatingAudioSource(
      useLazyPreparation: true,
      children: queue.map((track) {
        final trackId = track['id'] as String;
        return AudioSource.uri(
          Uri.parse(apiService.getStreamUrl(trackId)),
          tag: track, // store the whole track map as tag
        );
      }).toList(),
    );

    try {
      await _player.setAudioSource(playlist, initialIndex: initialIndex);
      await _player.play();
    } catch (e) {
      debugPrint("error loading audio: $e");
    }
  }

  Future<void> pause() => _player.pause();
  Future<void> resume() => _player.play();
  Future<void> stop() => _player.stop();
  Future<void> seek(Duration position) => _player.seek(position);
  Future<void> skipToNext() => _player.seekToNext();
  Future<void> skipToPrevious() => _player.seekToPrevious();
  
  void dispose() {
    _player.dispose();
  }
}
