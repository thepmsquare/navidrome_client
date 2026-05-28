import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:sentry_dio/sentry_dio.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/lyrics_service.dart';
import 'package:background_downloader/background_downloader.dart';

class OfflineService extends ChangeNotifier {
  static const String _offlineTracksKey = 'offline_tracks';
  static const String _explicitOfflineTracksKey = 'explicit_offline_tracks';
  static const String _offlineAlbumsKey = 'offline_albums';
  static const String _offlinePlaylistsKey = 'offline_playlists';
  static const String _offlineModeKey = 'offline_mode';
  static const String _autoSaveOfflineOrderKey = 'auto_save_offline_order';
  static const String _albumListCacheFile = 'album_list_cache.json';
  static const String _playlistListCacheFile = 'playlist_list_cache.json';
  static const String _trackListCacheFile = 'track_list_cache.json';
  static const String _artistListCacheFile = 'artist_list_cache.json';

  final Dio _dio = Dio()..addSentry();

  // #5: cached storage path — resolved once, reused everywhere
  String? _cachedStoragePath;

  // #7: in-memory sets for O(1) synchronous checks — no disk I/O in build()
  Set<String> _offlineTrackIds = {};
  Set<String> _explicitOfflineTrackIds = {};
  Set<String> _offlineAlbumIds = {};
  Set<String> _offlinePlaylistIds = {};
  bool _isOfflineMode = false;
  bool _isAutoOffline = false;
  bool _isInitialized = false;

  // LRU order for auto-saved offline tracks — oldest at index 0
  List<String> _autoSaveOfflineOrder = [];

  // #20: notify UI of offline mode changes
  // OfflineState distinguishes between user-toggled and no-internet-triggered
  final ValueNotifier<OfflineState> offlineModeNotifier = ValueNotifier(OfflineState.online);
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  // #12: track active saves offline for cancellation and controller cleanup
  final Set<String> _cancelledSavesOffline = {};
  final Map<String, StreamController<OfflineProgress>> _progressControllers = {};
  
  // throttling for UI updates during save offline
  final Map<String, DateTime> _lastProgressEmitted = {};
  Timer? _persistenceTimer;

  static final OfflineService _instance = OfflineService._internal();
  factory OfflineService() => _instance;
  OfflineService._internal();

  /// Resets the initialised guard so [initialize] can be called again in tests.
  /// Do NOT call this in production code.
  @visibleForTesting
  void resetForTesting() {
    _isInitialized = false;
    _connectivitySub?.cancel();
    _connectivitySub = null;
  }

  // ---------------------------------------------------------------------------
  // Initialization — must be called once at app startup before using sync APIs
  // ---------------------------------------------------------------------------

  /// Loads all persisted state into memory. Call once in main() or app init.
  Future<void> initialize() async {
    if (_isInitialized) return;
    final prefs = await SharedPreferences.getInstance();
    _offlineTrackIds = Set<String>.from(prefs.getStringList(_offlineTracksKey) ?? []);
    _explicitOfflineTrackIds = Set<String>.from(prefs.getStringList(_explicitOfflineTracksKey) ?? []);
    _offlineAlbumIds = Set<String>.from(prefs.getStringList(_offlineAlbumsKey) ?? []);
    _offlinePlaylistIds = Set<String>.from(prefs.getStringList(_offlinePlaylistsKey) ?? []);
    _isOfflineMode = prefs.getBool(_offlineModeKey) ?? false;
    offlineModeNotifier.value = _isOfflineMode
        ? (_isAutoOffline ? OfflineState.offlineNoInternet : OfflineState.offlineManual)
        : OfflineState.online;
    Sentry.configureScope((scope) {
      scope.setTag(
        'connection_state',
        _isOfflineMode
            ? (_isAutoOffline ? 'offline_no_internet' : 'offline_manual')
            : 'online',
      );
    });
    _autoSaveOfflineOrder = List<String>.from(prefs.getStringList(_autoSaveOfflineOrderKey) ?? []);
    _isInitialized = true;

    // automatic check on startup — delay briefly to let the network stack
    // settle after a cold start (connectivity_plus can briefly report 'none'
    // before the OS has finished reconnecting).
    Future.delayed(const Duration(seconds: 2), () async {
      final connectivity = await Connectivity().checkConnectivity();
      if (connectivity.contains(ConnectivityResult.none) && !_isOfflineMode) {
        await setOfflineMode(true, isAuto: true, persist: false);
      }
    });

    // start listening for changes
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final hasNoConnection = results.contains(ConnectivityResult.none);
      
      if (hasNoConnection && !_isOfflineMode) {
        // auto-toggle into offline mode, but don't persist
        setOfflineMode(true, isAuto: true, persist: false);
      } else if (!hasNoConnection && _isOfflineMode && _isAutoOffline) {
        // auto-toggle back to online if we were only offline due to an auto-toggle
        setOfflineMode(false, persist: false);
      }
    });
  }

  @override
  void dispose() {
    _connectivitySub?.cancel();
    _persistenceTimer?.cancel();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Storage directory — #5: cached after first resolve
  // ---------------------------------------------------------------------------

  Future<String> _getStoragePath() async {
    if (_cachedStoragePath != null) return _cachedStoragePath!;

    final baseDir = await getApplicationDocumentsDirectory();

    final tracksDir = Directory('${baseDir.path}/offline/tracks');
    final coversDir = Directory('${baseDir.path}/offline/covers');
    final metaDir = Directory('${baseDir.path}/offline/meta');
    final lyricsDir = Directory('${baseDir.path}/offline/lyrics');

    await tracksDir.create(recursive: true);
    await coversDir.create(recursive: true);
    await metaDir.create(recursive: true);
    await lyricsDir.create(recursive: true);

    _cachedStoragePath = '${baseDir.path}/offline';
    return _cachedStoragePath!;
  }

  String _trackPath(String basePath, String trackId) => '$basePath/tracks/$trackId.audio';
  String _coverPath(String basePath, String coverArtId) => '$basePath/covers/$coverArtId.jpg';
  String _albumMetaPath(String basePath, String albumId) => '$basePath/meta/album_$albumId.json';
  String _playlistMetaPath(String basePath, String playlistId) => '$basePath/meta/playlist_$playlistId.json';
  String _lyricsPath(String basePath, String trackId) => '$basePath/lyrics/$trackId.json';
  String _albumListCachePath(String basePath) => '$basePath/meta/$_albumListCacheFile';
  String _playlistListCachePath(String basePath) => '$basePath/meta/$_playlistListCacheFile';
  static String _trackListCachePath(String basePath) => '$basePath/meta/$_trackListCacheFile';
  static String _artistListCachePath(String basePath) => '$basePath/meta/$_artistListCacheFile';

  // ---------------------------------------------------------------------------
  // Synchronous status checks — #7: O(1) using in-memory sets
  // ---------------------------------------------------------------------------

  bool get isOfflineMode => _isOfflineMode;
  Set<String> get offlineTrackIds => _offlineTrackIds;
  Set<String> get offlineAlbumIds => _offlineAlbumIds;
  Set<String> get offlinePlaylistIds => _offlinePlaylistIds;
  bool isTrackOfflineSync(String trackId) => _offlineTrackIds.contains(trackId);
  bool isAlbumOfflineSync(String albumId) => _offlineAlbumIds.contains(albumId);
  bool isPlaylistOfflineSync(String playlistId) => _offlinePlaylistIds.contains(playlistId);

  // ---------------------------------------------------------------------------
  // Progress stream — typed and cleaned up after use
  // ---------------------------------------------------------------------------

  Stream<OfflineProgress> getSaveOfflineProgress(String id) {
    _progressControllers.putIfAbsent(
      id, () => StreamController<OfflineProgress>.broadcast(),
    );
    return _progressControllers[id]!.stream;
  }

  void _emitProgress(String id, double fraction, {bool done = false}) {
    if (done) {
      _progressControllers[id]?.add(OfflineProgress(fraction: fraction, isDone: done));
      _progressControllers[id]?.close();
      _progressControllers.remove(id);
      _cancelledSavesOffline.remove(id);
      _lastProgressEmitted.remove(id);
      return;
    }

    // throttle updates to ~10Hz to prevent UI flickering/rebuild overload
    final now = DateTime.now();
    final last = _lastProgressEmitted[id];
    if (last == null || now.difference(last) > const Duration(milliseconds: 100)) {
      _lastProgressEmitted[id] = now;
      _progressControllers[id]?.add(OfflineProgress(fraction: fraction, isDone: false));
    }
  }

  // ---------------------------------------------------------------------------
  // SharedPreferences sync helpers — debounced to avoid I/O pressure
  // ---------------------------------------------------------------------------

  void _requestPersistence() {
    _persistenceTimer?.cancel();
    _persistenceTimer = Timer(const Duration(seconds: 1), () async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_offlineTracksKey, _offlineTrackIds.toList());
      await prefs.setStringList(_explicitOfflineTracksKey, _explicitOfflineTrackIds.toList());
      await prefs.setStringList(_offlineAlbumsKey, _offlineAlbumIds.toList());
      await prefs.setStringList(_offlinePlaylistsKey, _offlinePlaylistIds.toList());
      await prefs.setStringList(_autoSaveOfflineOrderKey, _autoSaveOfflineOrder);
    });
  }

  // ---------------------------------------------------------------------------
  // Cover art — #duplicate prevention via in-memory check + file existence
  // ---------------------------------------------------------------------------

  Future<void> saveCoverArtOffline(String coverArtId, ApiService apiService) async {
    final base = await _getStoragePath();
    final path = _coverPath(base, coverArtId);
    if (await File(path).exists()) return; // already have it

    final tempPath = '$path.temp';
    try {
      await _dio.download(apiService.getCoverArtUrl(coverArtId, size: 600), tempPath);
      final tempFile = File(tempPath);
      if (await tempFile.exists()) {
        await tempFile.rename(path);
        notifyListeners(); // notify to update images (OfflineImage)
      }
    } catch (e) {
      debugPrint('cover art $coverArtId save offline failed: $e');
      final tempFile = File(tempPath);
      if (await tempFile.exists()) {
        try {
          await tempFile.delete();
        } catch (_) {}
      }
    }
  }

  /// Returns local cover art path synchronously if known, else null.
  /// For UI: use this after initialize() has run.
  Future<String?> getLocalCoverArtPath(String? coverArtId) async {
    if (coverArtId == null) return null;
    final base = await _getStoragePath();
    final path = _coverPath(base, coverArtId);
    final file = File(path);
    
    if (await file.exists()) {
      try {
        final randomAccessFile = await file.open(mode: FileMode.read);
        final bytes = await randomAccessFile.read(4);
        await randomAccessFile.close();
        
        bool isValid = false;
        if (bytes.length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) {
          isValid = true; // JPEG
        } else if (bytes.length >= 4 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) {
          isValid = true; // PNG
        } else if (bytes.length >= 4 && bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x38) {
          isValid = true; // GIF
        } else if (bytes.length >= 4 && bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46) {
          isValid = true; // WEBP (RIFF)
        }
        
        if (isValid) {
          return path;
        }
        
        // If not a valid image, delete the corrupted file
        await file.delete();
        debugPrint('deleted corrupted cover art file: $path');
      } catch (e) {
        debugPrint('error checking cover art file: $e');
        // if we couldn't read it (e.g. locked), return null to fallback safely
        return null;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Lyrics storage
  // ---------------------------------------------------------------------------

  Future<void> saveLyricsOffline(Map<String, dynamic> track, ApiService apiService) async {
    final trackId = track['id'] as String;
    final base = await _getStoragePath();
    final path = _lyricsPath(base, trackId);
    
    if (await File(path).exists()) return;

    try {
      final lyricsService = LyricsService(apiService);
      final lyrics = await lyricsService.getLyrics(track);
      if (lyrics != null) {
        await File(path).writeAsString(jsonEncode(lyrics.toJson()));
        debugPrint('saved lyrics for track $trackId');
      }
    } catch (e) {
      debugPrint('failed to save lyrics offline for track $trackId: $e');
    }
  }

  Future<LyricsData?> getCachedLyrics(String trackId) async {
    try {
      final base = await _getStoragePath();
      final path = _lyricsPath(base, trackId);
      final file = File(path);
      if (!await file.exists()) return null;
      
      final content = await file.readAsString();
      return LyricsData.fromJson(jsonDecode(content));
    } catch (e) {
      debugPrint('failed to load cached lyrics for track $trackId: $e');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Offline tracks size & LRU eviction
  // ---------------------------------------------------------------------------

  /// Returns the total size in bytes of all cached track audio files.
  Future<int> getOfflineTracksSizeBytes() async {
    final base = await _getStoragePath();
    final tracksDir = Directory('$base/tracks');
    int total = 0;
    if (await tracksDir.exists()) {
      await for (final entity in tracksDir.list(recursive: false, followLinks: false)) {
        if (entity is File) {
          try {
            total += await entity.length();
          } catch (_) {}
        }
      }
    }
    return total;
  }

  /// Deletes the oldest auto-saved offline track and returns its ID, or null if
  /// there are no auto-saved offline tracks to evict.
  Future<String?> evictOldestAutoSaveOffline() async {
    while (_autoSaveOfflineOrder.isNotEmpty) {
      final oldest = _autoSaveOfflineOrder.removeAt(0);
      if (!_offlineTrackIds.contains(oldest)) continue; // already gone
      final base = await _getStoragePath();
      final file = File(_trackPath(base, oldest));
      if (await file.exists()) await file.delete();
      final lyricsFile = File(_lyricsPath(base, oldest));
      if (await lyricsFile.exists()) await lyricsFile.delete();
      _offlineTrackIds.remove(oldest);
      _requestPersistence();
      notifyListeners();
      debugPrint('auto-save offline evicted: $oldest');
      return oldest;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Track save offline
  // ---------------------------------------------------------------------------

  /// Returns local audio path if the track is cached.
  Future<String?> getLocalPath(String trackId) async {
    if (!_offlineTrackIds.contains(trackId)) return null;
    final base = await _getStoragePath();
    final path = _trackPath(base, trackId);
    // verify file actually exists (handles edge case of prefs/file mismatch)
    return await File(path).exists() ? path : null;
  }

  Future<void> saveTrackOffline(Map<String, dynamic> track, ApiService apiService, {bool isExplicit = false}) async {
    final trackId = track['id'] as String;
    
    if (_offlineTrackIds.contains(trackId)) {
      // #duplicate: already saved, tag explicit
      if (isExplicit && !_explicitOfflineTrackIds.contains(trackId)) {
        _explicitOfflineTrackIds.add(trackId);
        _requestPersistence();
      }
      return; 
    }

    final base = await _getStoragePath();
    final path = _trackPath(base, trackId);
    _cancelledSavesOffline.remove(trackId);

    try {
      final task = DownloadTask(
        taskId: trackId,
        url: apiService.getStreamUrl(trackId),
        filename: '$trackId.audio',
        directory: 'offline/tracks',
        baseDirectory: BaseDirectory.applicationDocuments,
        updates: Updates.statusAndProgress,
      );

      final status = await FileDownloader().download(
        task,
        onProgress: (progress) {
          if (progress > 0) _emitProgress(trackId, progress);
        },
      );

      if (status.status == TaskStatus.complete) {
        // also cache cover art (deduplication handled inside)
        final coverArtId = track['coverArt'] as String?;
        if (coverArtId != null) {
          await saveCoverArtOffline(coverArtId, apiService);
        }

        // save offline and save lyrics
        await saveLyricsOffline(track, apiService);
        await _addOfflineTrackMetadata(track);

        _offlineTrackIds.add(trackId);
        if (isExplicit) {
          _explicitOfflineTrackIds.add(trackId);
        } else {
          // track insertion order for LRU eviction
          _autoSaveOfflineOrder.remove(trackId); // avoid duplicates
          _autoSaveOfflineOrder.add(trackId);
        }
        
        _requestPersistence();
        _emitProgress(trackId, 1.0, done: true);
        notifyListeners();
      } else if (status.status == TaskStatus.canceled) {
        debugPrint('track $trackId save offline cancelled');
        final f = File(path);
        if (await f.exists()) await f.delete();
      } else {
        debugPrint('track $trackId save offline failed: $status');
        throw Exception('Save offline failed with status $status');
      }
    } catch (e) {
      debugPrint('track $trackId save offline failed: $e');
      rethrow;
    }
  }

  // ---------------------------------------------------------------------------
  // Album save offline
  // ---------------------------------------------------------------------------

  Future<void> saveAlbumOffline(
    String albumId,
    List<Map<String, dynamic>> tracks,
    ApiService apiService,
  ) async {
    // save metadata immediately so album is openable offline even mid-save offline
    await saveAlbumMetadata(albumId, tracks);

    final controller = _progressControllers.putIfAbsent(
      albumId, () => StreamController<OfflineProgress>.broadcast(),
    );
    _cancelledSavesOffline.remove(albumId);

    int completed = 0;
    bool hasErrors = false;

    for (final track in tracks) {
      // #11: check if album-level cancel was requested
      if (_cancelledSavesOffline.contains(albumId)) break;

      final trackId = track['id'] as String;
      if (_offlineTrackIds.contains(trackId)) {
        // already have this track — count it but skip
        completed++;
        controller.add(OfflineProgress(fraction: completed / tracks.length));
        continue;
      }

      try {
        await saveTrackOffline(track, apiService);
        completed++;
        controller.add(OfflineProgress(fraction: completed / tracks.length));
      } catch (e) {
        debugPrint('skipping track $trackId in album $albumId: $e');
        completed++;
        hasErrors = true;
        controller.add(OfflineProgress(fraction: completed / tracks.length, hasError: true));
      }
    }

    if (_cancelledSavesOffline.contains(albumId)) {
      _cancelledSavesOffline.remove(albumId);
      _emitProgress(albumId, 1.0, done: true);
      return;
    }

    if (!hasErrors) {
      _offlineAlbumIds.add(albumId);
      _requestPersistence();
    }
    
    _emitProgress(albumId, 1.0, done: true);
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Playlist save offline
  // ---------------------------------------------------------------------------

  Future<void> savePlaylistOffline(
    String playlistId,
    List<Map<String, dynamic>> tracks,
    ApiService apiService,
  ) async {
    // save metadata immediately
    await savePlaylistMetadata(playlistId, tracks);

    final controller = _progressControllers.putIfAbsent(
      playlistId, () => StreamController<OfflineProgress>.broadcast(),
    );
    _cancelledSavesOffline.remove(playlistId);

    int completed = 0;
    bool hasErrors = false;

    for (final track in tracks) {
      if (_cancelledSavesOffline.contains(playlistId)) break;

      final trackId = track['id'] as String;
      if (_offlineTrackIds.contains(trackId)) {
        completed++;
        controller.add(OfflineProgress(fraction: completed / tracks.length));
        continue;
      }

      try {
        await saveTrackOffline(track, apiService);
        completed++;
        controller.add(OfflineProgress(fraction: completed / tracks.length));
      } catch (e) {
        debugPrint('skipping track $trackId in playlist $playlistId: $e');
        completed++;
        hasErrors = true;
        controller.add(OfflineProgress(fraction: completed / tracks.length, hasError: true));
      }
    }

    if (_cancelledSavesOffline.contains(playlistId)) {
      _cancelledSavesOffline.remove(playlistId);
      _emitProgress(playlistId, 1.0, done: true);
      return;
    }

    if (!hasErrors) {
      _offlinePlaylistIds.add(playlistId);
      _requestPersistence();
    }
    
    _emitProgress(playlistId, 1.0, done: true);
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Cancellation — #11
  // ---------------------------------------------------------------------------

  void cancelSaveOffline(String id) {
    _cancelledSavesOffline.add(id);
    FileDownloader().cancelTaskWithId(id);
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  Future<void> deleteTrack(String trackId) async {
    final base = await _getStoragePath();
    final file = File(_trackPath(base, trackId));
    if (await file.exists()) await file.delete();

    final lyricsFile = File(_lyricsPath(base, trackId));
    if (await lyricsFile.exists()) await lyricsFile.delete();

    _offlineTrackIds.remove(trackId);
    _explicitOfflineTrackIds.remove(trackId);
    _autoSaveOfflineOrder.remove(trackId);
    await _removeOfflineTrackMetadata(trackId);
    _requestPersistence();
    notifyListeners();
  }

  /// #10: deletes all tracks, album metadata, and associated cover art.
  Future<void> deleteAlbum(String albumId) async {
    final base = await _getStoragePath();
    final cached = await getCachedAlbumMetadata(albumId);

    if (cached != null) {
      final coverArtIds = cached
          .map((t) => t['coverArt'] as String?)
          .whereType<String>()
          .toSet();

      for (final track in cached) {
        final trackId = track['id'] as String?;
        if (trackId != null) {
          // only delete track if it's not used by any other offline album OR other offline playlist
          final usedElsewhere = await _isTrackUsedElsewhere(trackId, excludeAlbumId: albumId);
          if (!usedElsewhere) {
            await deleteTrack(trackId);
          }
        }
      }

      for (final coverArtId in coverArtIds) {
        final usedByOthers = await _isCoverUsedByOthers(coverArtId, excludeAlbumId: albumId);
        if (!usedByOthers) {
          final coverFile = File(_coverPath(base, coverArtId));
          if (await coverFile.exists()) await coverFile.delete();
        }
      }

      final metaFile = File(_albumMetaPath(base, albumId));
      if (await metaFile.exists()) await metaFile.delete();
    }

    _offlineAlbumIds.remove(albumId);
    _requestPersistence();
    notifyListeners();
  }

  /// Deletes all local files for tracks in the playlist and the playlist metadata.
  Future<void> deletePlaylist(String playlistId) async {
    final base = await _getStoragePath();
    final cached = await getCachedPlaylistMetadata(playlistId);

    if (cached != null) {
      final coverArtIds = cached
          .map((t) => t['coverArt'] as String?)
          .whereType<String>()
          .toSet();

      for (final track in cached) {
        final trackId = track['id'] as String?;
        if (trackId != null) {
          // only delete track if it's not used by any offline album OR other offline playlist
          final usedElsewhere = await _isTrackUsedElsewhere(trackId, excludePlaylistId: playlistId);
          if (!usedElsewhere) {
            await deleteTrack(trackId);
          }
        }
      }

      for (final coverArtId in coverArtIds) {
        final usedByOthers = await _isCoverUsedByOthers(coverArtId, excludePlaylistId: playlistId);
        if (!usedByOthers) {
          final coverFile = File(_coverPath(base, coverArtId));
          if (await coverFile.exists()) await coverFile.delete();
        }
      }

      final metaFile = File(_playlistMetaPath(base, playlistId));
      if (await metaFile.exists()) await metaFile.delete();
    }

    _offlinePlaylistIds.remove(playlistId);
    _requestPersistence();
    notifyListeners();
  }

  Future<List<Map<String, dynamic>>> getOfflineTracksMetadata() async {
    try {
      final base = await _getStoragePath();
      final file = File('$base/meta/offline_tracks_meta.json');
      if (!await file.exists()) return [];
      final decoded = jsonDecode(await file.readAsString()) as List<dynamic>;
      return List<Map<String, dynamic>>.from(
        decoded.map((e) => Map<String, dynamic>.from(e as Map)),
      );
    } catch (e) {
      debugPrint('failed to read offline tracks metadata: $e');
      return [];
    }
  }

  Future<void> _addOfflineTrackMetadata(Map<String, dynamic> track) async {
    final list = await getOfflineTracksMetadata();
    final trackId = track['id']?.toString();
    list.removeWhere((t) => t['id']?.toString() == trackId);
    list.add(track);
    final base = await _getStoragePath();
    await File('$base/meta/offline_tracks_meta.json').writeAsString(jsonEncode(list));
  }

  Future<void> _removeOfflineTrackMetadata(String trackId) async {
    final list = await getOfflineTracksMetadata();
    list.removeWhere((t) => t['id']?.toString() == trackId);
    final base = await _getStoragePath();
    await File('$base/meta/offline_tracks_meta.json').writeAsString(jsonEncode(list));
  }

  Future<bool> _isTrackUsedElsewhere(String trackId, {String? excludeAlbumId, String? excludePlaylistId}) async {
    if (_explicitOfflineTrackIds.contains(trackId)) return true; // protected from aggregate deletion
    
    // check other albums
    for (final albumId in _offlineAlbumIds) {
      if (albumId == excludeAlbumId) continue;
      final cached = await getCachedAlbumMetadata(albumId);
      if (cached != null && cached.any((t) => t['id'] == trackId)) return true;
    }
    // check other playlists
    for (final playlistId in _offlinePlaylistIds) {
      if (playlistId == excludePlaylistId) continue;
      final cached = await getCachedPlaylistMetadata(playlistId);
      if (cached != null && cached.any((t) => t['id'] == trackId)) return true;
    }
    return false;
  }

  Future<bool> _isCoverUsedByOthers(String coverArtId, {String? excludeAlbumId, String? excludePlaylistId}) async {
    // check other albums
    for (final albumId in _offlineAlbumIds) {
      if (albumId == excludeAlbumId) continue;
      final cached = await getCachedAlbumMetadata(albumId);
      if (cached != null && cached.any((t) => t['coverArt'] == coverArtId)) return true;
    }
    // check other playlists
    for (final playlistId in _offlinePlaylistIds) {
      if (playlistId == excludePlaylistId) continue;
      final cached = await getCachedPlaylistMetadata(playlistId);
      if (cached != null && cached.any((t) => t['coverArt'] == coverArtId)) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Album & album-list metadata
  // ---------------------------------------------------------------------------

  Future<void> saveAlbumMetadata(String albumId, List<Map<String, dynamic>> tracks) async {
    final base = await _getStoragePath();
    await File(_albumMetaPath(base, albumId)).writeAsString(jsonEncode(tracks));
  }

  /// #2: fixed cast — uses List.from + Map.from instead of .cast<>()
  Future<List<Map<String, dynamic>>?> getCachedAlbumMetadata(String albumId) async {
    final base = await _getStoragePath();
    final file = File(_albumMetaPath(base, albumId));
    if (!await file.exists()) return null;
    try {
      final decoded = jsonDecode(await file.readAsString()) as List<dynamic>;
      return List<Map<String, dynamic>>.from(
        decoded.map((e) => Map<String, dynamic>.from(e as Map)),
      );
    } catch (e) {
      debugPrint('failed to read album metadata $albumId: $e');
      return null;
    }
  }

  Future<void> savePlaylistMetadata(String playlistId, List<Map<String, dynamic>> tracks) async {
    final base = await _getStoragePath();
    await File(_playlistMetaPath(base, playlistId)).writeAsString(jsonEncode(tracks));
  }

  Future<List<Map<String, dynamic>>?> getCachedPlaylistMetadata(String playlistId) async {
    final base = await _getStoragePath();
    final file = File(_playlistMetaPath(base, playlistId));
    if (!await file.exists()) return null;
    try {
      final decoded = jsonDecode(await file.readAsString()) as List<dynamic>;
      return List<Map<String, dynamic>>.from(
        decoded.map((e) => Map<String, dynamic>.from(e as Map)),
      );
    } catch (e) {
      debugPrint('failed to read playlist metadata $playlistId: $e');
      return null;
    }
  }

  /// #9: cache the full album list so the library works fully offline
  Future<void> saveAlbumListCache(List<Map<String, dynamic>> albums) async {
    final base = await _getStoragePath();
    await File(_albumListCachePath(base)).writeAsString(jsonEncode(albums));
  }

  Future<List<Map<String, dynamic>>?> getCachedAlbumList() async {
    try {
      final base = await _getStoragePath();
      final file = File(_albumListCachePath(base));
      if (!await file.exists()) return null;
      final decoded = jsonDecode(await file.readAsString()) as List<dynamic>;
      return List<Map<String, dynamic>>.from(
        decoded.map((e) => Map<String, dynamic>.from(e as Map)),
      );
    } catch (e) {
      debugPrint('failed to read album list cache: $e');
      return null;
    }
  }

  Future<void> savePlaylistListCache(List<Map<String, dynamic>> playlists) async {
    final base = await _getStoragePath();
    await File(_playlistListCachePath(base)).writeAsString(jsonEncode(playlists));
  }

  Future<List<Map<String, dynamic>>?> getCachedPlaylistList() async {
    try {
      final base = await _getStoragePath();
      final file = File(_playlistListCachePath(base));
      if (!await file.exists()) return null;
      final decoded = jsonDecode(await file.readAsString()) as List<dynamic>;
      return List<Map<String, dynamic>>.from(
        decoded.map((e) => Map<String, dynamic>.from(e as Map)),
      );
    } catch (e) {
      debugPrint('failed to read playlist list cache: $e');
      return null;
    }
  }

  Future<void> saveTrackListCache(List<Map<String, dynamic>> tracks) async {
    final base = await _getStoragePath();
    await File(_trackListCachePath(base)).writeAsString(jsonEncode(tracks));
  }

  Future<List<Map<String, dynamic>>?> getCachedTrackList() async {
    try {
      final base = await _getStoragePath();
      final file = File(_trackListCachePath(base));
      if (!await file.exists()) return null;
      final decoded = jsonDecode(await file.readAsString()) as List<dynamic>;
      return List<Map<String, dynamic>>.from(
        decoded.map((e) => Map<String, dynamic>.from(e as Map)),
      );
    } catch (e) {
      debugPrint('failed to read track list cache: $e');
      return null;
    }
  }

  Future<void> saveArtistListCache(List<Map<String, dynamic>> artists) async {
    final base = await _getStoragePath();
    await File(_artistListCachePath(base)).writeAsString(jsonEncode(artists));
  }

  Future<List<Map<String, dynamic>>?> getCachedArtistList() async {
    try {
      final base = await _getStoragePath();
      final file = File(_artistListCachePath(base));
      if (!await file.exists()) return null;
      final decoded = jsonDecode(await file.readAsString()) as List<dynamic>;
      return List<Map<String, dynamic>>.from(
        decoded.map((e) => Map<String, dynamic>.from(e as Map)),
      );
    } catch (e) {
      debugPrint('failed to read artist list cache: $e');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Offline mode toggle
  // ---------------------------------------------------------------------------

  Future<void> setOfflineMode(bool value, {bool isAuto = false, bool persist = true}) async {
    _isOfflineMode = value;
    _isAutoOffline = value ? isAuto : false;
    offlineModeNotifier.value = value
        ? (isAuto ? OfflineState.offlineNoInternet : OfflineState.offlineManual)
        : OfflineState.online;
    Sentry.configureScope((scope) {
      scope.setTag(
        'connection_state',
        value
            ? (isAuto ? 'offline_no_internet' : 'offline_manual')
            : 'online',
      );
    });
    if (persist) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_offlineModeKey, value);
    }
    notifyListeners();
  }

  /// Triggered by api failures to automatically switch into offline mode
  void triggerOfflineAutoToggle() {
    if (!_isOfflineMode) {
      setOfflineMode(true, isAuto: true, persist: false);
    }
  }

  /// Re-checks connectivity and exits offline mode if a connection is
  /// available. Returns true if the retry succeeded (back online).
  Future<bool> retryConnection() async {
    final results = await Connectivity().checkConnectivity();
    final hasConnection = !results.contains(ConnectivityResult.none);
    if (hasConnection && _isOfflineMode && _isAutoOffline) {
      await setOfflineMode(false, persist: false);
      return true;
    }
    return false;
  }

  /// Resets in-memory state and optionally clears all offline saves.
  Future<void> clearState({bool deleteFiles = false}) async {
    _persistenceTimer?.cancel();
    if (deleteFiles) {
      await clearAllOfflineSaves();
    } else {
      _offlineTrackIds.clear();
      _explicitOfflineTrackIds.clear();
      _offlineAlbumIds.clear();
      _offlinePlaylistIds.clear();
      _autoSaveOfflineOrder.clear();
    }
    _isOfflineMode = false;
    offlineModeNotifier.value = OfflineState.online;
    notifyListeners();
  }

  /// #11: Clear all offline saves and specific metadata, but preserve internal list caches.
  Future<void> clearAllOfflineSaves() async {
    final base = await _getStoragePath();
    
    // Clear tracks and covers
    final tracksDir = Directory('$base/tracks');
    final coversDir = Directory('$base/covers');
    final lyricsDir = Directory('$base/lyrics');
    if (await tracksDir.exists()) await tracksDir.delete(recursive: true);
    if (await coversDir.exists()) await coversDir.delete(recursive: true);
    if (await lyricsDir.exists()) await lyricsDir.delete(recursive: true);

    // Recreate empty directories
    await tracksDir.create(recursive: true);
    await coversDir.create(recursive: true);
    await lyricsDir.create(recursive: true);

    // Surgical clear of meta directory
    final metaDir = Directory('$base/meta');
    if (await metaDir.exists()) {
      final cacheFiles = {
        _albumListCacheFile,
        _playlistListCacheFile,
        _trackListCacheFile,
        _artistListCacheFile,
      };

      await for (final entity in metaDir.list()) {
        if (entity is File) {
          final fileName = entity.path.split(Platform.pathSeparator).last;
          if (!cacheFiles.contains(fileName)) {
            await entity.delete();
          }
        }
      }
    }

    _offlineTrackIds.clear();
    _explicitOfflineTrackIds.clear();
    _offlineAlbumIds.clear();
    _offlinePlaylistIds.clear();
    _autoSaveOfflineOrder.clear();
    _requestPersistence();
    notifyListeners();
  }
}

// ---------------------------------------------------------------------------
// Offline state — distinguishes user-toggled from no-internet auto-toggle
// ---------------------------------------------------------------------------

enum OfflineState {
  online,
  offlineManual,
  offlineNoInternet,
}

// ---------------------------------------------------------------------------
// Typed progress value — replaces raw double
// ---------------------------------------------------------------------------

class OfflineProgress {
  final double fraction;
  final bool isDone;
  final bool hasError;

  const OfflineProgress({
    required this.fraction,
    this.isDone = false,
    this.hasError = false,
  });

  bool get isSavingOffline => !isDone && fraction > 0 && fraction < 1.0;
}
