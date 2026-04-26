import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:background_downloader/background_downloader.dart';

class OfflineService extends ChangeNotifier {
  static const String _offlineTracksKey = 'offline_tracks';
  static const String _explicitOfflineTracksKey = 'explicit_offline_tracks';
  static const String _offlineAlbumsKey = 'offline_albums';
  static const String _offlinePlaylistsKey = 'offline_playlists';
  static const String _offlineModeKey = 'offline_mode';
  static const String _albumListCacheFile = 'album_list_cache.json';
  static const String _playlistListCacheFile = 'playlist_list_cache.json';
  static const String _trackListCacheFile = 'track_list_cache.json';
  static const String _artistListCacheFile = 'artist_list_cache.json';

  final Dio _dio = Dio();

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

  // #20: notify UI of offline mode changes
  final ValueNotifier<bool> offlineModeNotifier = ValueNotifier(false);
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  // #12: track active downloads for cancellation and controller cleanup
  final Set<String> _cancelledDownloads = {};
  final Map<String, StreamController<OfflineProgress>> _progressControllers = {};
  
  // throttling for UI updates during download
  final Map<String, DateTime> _lastProgressEmitted = {};
  Timer? _persistenceTimer;

  static final OfflineService _instance = OfflineService._internal();
  factory OfflineService() => _instance;
  OfflineService._internal();

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
    offlineModeNotifier.value = _isOfflineMode;
    _isInitialized = true;

    // automatic check on startup
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity.contains(ConnectivityResult.none) && !_isOfflineMode) {
      await setOfflineMode(true, isAuto: true, persist: false);
    }

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

    await tracksDir.create(recursive: true);
    await coversDir.create(recursive: true);
    await metaDir.create(recursive: true);

    _cachedStoragePath = '${baseDir.path}/offline';
    return _cachedStoragePath!;
  }

  String _trackPath(String basePath, String trackId) => '$basePath/tracks/$trackId.audio';
  String _coverPath(String basePath, String coverArtId) => '$basePath/covers/$coverArtId.jpg';
  String _albumMetaPath(String basePath, String albumId) => '$basePath/meta/album_$albumId.json';
  String _playlistMetaPath(String basePath, String playlistId) => '$basePath/meta/playlist_$playlistId.json';
  String _albumListCachePath(String basePath) => '$basePath/meta/$_albumListCacheFile';
  String _playlistListCachePath(String basePath) => '$basePath/meta/$_playlistListCacheFile';
  static String _trackListCachePath(String basePath) => '$basePath/meta/$_trackListCacheFile';
  static String _artistListCachePath(String basePath) => '$basePath/meta/$_artistListCacheFile';

  // ---------------------------------------------------------------------------
  // Synchronous status checks — #7: O(1) using in-memory sets
  // ---------------------------------------------------------------------------

  bool get isOfflineMode => _isOfflineMode;
  bool isTrackOfflineSync(String trackId) => _offlineTrackIds.contains(trackId);
  bool isAlbumOfflineSync(String albumId) => _offlineAlbumIds.contains(albumId);
  bool isPlaylistOfflineSync(String playlistId) => _offlinePlaylistIds.contains(playlistId);

  // ---------------------------------------------------------------------------
  // Progress stream — typed and cleaned up after use
  // ---------------------------------------------------------------------------

  Stream<OfflineProgress> getDownloadProgress(String id) {
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
      _cancelledDownloads.remove(id);
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
    });
  }

  // ---------------------------------------------------------------------------
  // Cover art — #duplicate prevention via in-memory check + file existence
  // ---------------------------------------------------------------------------

  Future<void> downloadCoverArt(String coverArtId, ApiService apiService) async {
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
      debugPrint('cover art $coverArtId download failed: $e');
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
  // Track download
  // ---------------------------------------------------------------------------

  /// Returns local audio path if the track is cached.
  Future<String?> getLocalPath(String trackId) async {
    if (!_offlineTrackIds.contains(trackId)) return null;
    final base = await _getStoragePath();
    final path = _trackPath(base, trackId);
    // verify file actually exists (handles edge case of prefs/file mismatch)
    return await File(path).exists() ? path : null;
  }

  Future<void> downloadTrack(Map<String, dynamic> track, ApiService apiService, {bool isExplicit = false}) async {
    final trackId = track['id'] as String;
    
    if (_offlineTrackIds.contains(trackId)) {
      // #duplicate: already downloaded, tag explicit
      if (isExplicit && !_explicitOfflineTrackIds.contains(trackId)) {
        _explicitOfflineTrackIds.add(trackId);
        _requestPersistence();
      }
      return; 
    }

    final base = await _getStoragePath();
    final path = _trackPath(base, trackId);
    _cancelledDownloads.remove(trackId);

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
          await downloadCoverArt(coverArtId, apiService);
        }

        _offlineTrackIds.add(trackId);
        if (isExplicit) _explicitOfflineTrackIds.add(trackId);
        
        _requestPersistence();
        _emitProgress(trackId, 1.0, done: true);
        notifyListeners();
      } else if (status.status == TaskStatus.canceled) {
        debugPrint('track $trackId download cancelled');
        final f = File(path);
        if (await f.exists()) await f.delete();
      } else {
        debugPrint('track $trackId download failed: $status');
        throw Exception('Download failed with status $status');
      }
    } catch (e) {
      debugPrint('track $trackId download failed: $e');
      rethrow;
    }
  }

  // ---------------------------------------------------------------------------
  // Album download
  // ---------------------------------------------------------------------------

  Future<void> downloadAlbum(
    String albumId,
    List<Map<String, dynamic>> tracks,
    ApiService apiService,
  ) async {
    // save metadata immediately so album is openable offline even mid-download
    await saveAlbumMetadata(albumId, tracks);

    final controller = _progressControllers.putIfAbsent(
      albumId, () => StreamController<OfflineProgress>.broadcast(),
    );
    _cancelledDownloads.remove(albumId);

    int completed = 0;
    bool hasErrors = false;

    for (final track in tracks) {
      // #11: check if album-level cancel was requested
      if (_cancelledDownloads.contains(albumId)) break;

      final trackId = track['id'] as String;
      if (_offlineTrackIds.contains(trackId)) {
        // already have this track — count it but skip
        completed++;
        controller.add(OfflineProgress(fraction: completed / tracks.length));
        continue;
      }

      try {
        await downloadTrack(track, apiService);
        completed++;
        controller.add(OfflineProgress(fraction: completed / tracks.length));
      } catch (e) {
        debugPrint('skipping track $trackId in album $albumId: $e');
        completed++;
        hasErrors = true;
        controller.add(OfflineProgress(fraction: completed / tracks.length, hasError: true));
      }
    }

    if (_cancelledDownloads.contains(albumId)) {
      _cancelledDownloads.remove(albumId);
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
  // Playlist download
  // ---------------------------------------------------------------------------

  Future<void> downloadPlaylist(
    String playlistId,
    List<Map<String, dynamic>> tracks,
    ApiService apiService,
  ) async {
    // save metadata immediately
    await savePlaylistMetadata(playlistId, tracks);

    final controller = _progressControllers.putIfAbsent(
      playlistId, () => StreamController<OfflineProgress>.broadcast(),
    );
    _cancelledDownloads.remove(playlistId);

    int completed = 0;
    bool hasErrors = false;

    for (final track in tracks) {
      if (_cancelledDownloads.contains(playlistId)) break;

      final trackId = track['id'] as String;
      if (_offlineTrackIds.contains(trackId)) {
        completed++;
        controller.add(OfflineProgress(fraction: completed / tracks.length));
        continue;
      }

      try {
        await downloadTrack(track, apiService);
        completed++;
        controller.add(OfflineProgress(fraction: completed / tracks.length));
      } catch (e) {
        debugPrint('skipping track $trackId in playlist $playlistId: $e');
        completed++;
        hasErrors = true;
        controller.add(OfflineProgress(fraction: completed / tracks.length, hasError: true));
      }
    }

    if (_cancelledDownloads.contains(playlistId)) {
      _cancelledDownloads.remove(playlistId);
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

  void cancelDownload(String id) {
    _cancelledDownloads.add(id);
    FileDownloader().cancelTaskWithId(id);
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  Future<void> deleteTrack(String trackId) async {
    final base = await _getStoragePath();
    final file = File(_trackPath(base, trackId));
    if (await file.exists()) await file.delete();

    _offlineTrackIds.remove(trackId);
    _explicitOfflineTrackIds.remove(trackId);
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
    offlineModeNotifier.value = value;
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

  /// #11: Clear all music downloads and specific metadata, but preserve internal list caches.
  Future<void> clearAllDownloads() async {
    final base = await _getStoragePath();
    
    // Clear tracks and covers
    final tracksDir = Directory('$base/tracks');
    final coversDir = Directory('$base/covers');
    if (await tracksDir.exists()) await tracksDir.delete(recursive: true);
    if (await coversDir.exists()) await coversDir.delete(recursive: true);

    // Recreate empty directories
    await tracksDir.create(recursive: true);
    await coversDir.create(recursive: true);

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
    _requestPersistence();
    notifyListeners();
  }
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

  bool get isDownloading => !isDone && fraction > 0 && fraction < 1.0;
}
