import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:navidrome_client/services/api_service.dart';

class OfflineService {
  static const String _offlineTracksKey = 'offline_tracks';
  static const String _offlineAlbumsKey = 'offline_albums';
  static const String _offlineModeKey = 'offline_mode';
  static const String _albumListCacheFile = 'album_list_cache.json';

  final Dio _dio = Dio();

  // #5: cached storage path — resolved once, reused everywhere
  String? _cachedStoragePath;

  // #7: in-memory sets for O(1) synchronous checks — no disk I/O in build()
  Set<String> _offlineTrackIds = {};
  Set<String> _offlineAlbumIds = {};
  bool _isOfflineMode = false;
  bool _isInitialized = false;

  // #20: notify UI of offline mode changes
  final ValueNotifier<bool> offlineModeNotifier = ValueNotifier(false);
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  // #12: track active downloads for cancellation and controller cleanup
  final Map<String, CancelToken> _cancelTokens = {};
  final Map<String, StreamController<OfflineProgress>> _progressControllers = {};

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
    _offlineAlbumIds = Set<String>.from(prefs.getStringList(_offlineAlbumsKey) ?? []);
    _isOfflineMode = prefs.getBool(_offlineModeKey) ?? false;
    offlineModeNotifier.value = _isOfflineMode;
    _isInitialized = true;

    // automatic check on startup
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity.contains(ConnectivityResult.none) && !_isOfflineMode) {
      await setOfflineMode(true);
    }

    // start listening for changes
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      if (results.contains(ConnectivityResult.none) && !_isOfflineMode) {
        setOfflineMode(true);
      }
    });
  }

  void dispose() {
    _connectivitySub?.cancel();
  }

  // ---------------------------------------------------------------------------
  // Storage directory — #5: cached after first resolve
  // ---------------------------------------------------------------------------

  Future<String> _getStoragePath() async {
    if (_cachedStoragePath != null) return _cachedStoragePath!;

    if (kIsWeb) throw UnsupportedError('offline storage not supported on web');

    Directory baseDir;
    if (Platform.isWindows || Platform.isMacOS || Platform.isLinux) {
      baseDir = await getApplicationSupportDirectory();
    } else {
      baseDir = await getApplicationDocumentsDirectory();
    }

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
  String _albumListCachePath(String basePath) => '$basePath/meta/$_albumListCacheFile';

  // ---------------------------------------------------------------------------
  // Synchronous status checks — #7: O(1) using in-memory sets
  // ---------------------------------------------------------------------------

  bool get isOfflineMode => _isOfflineMode;
  bool isTrackOfflineSync(String trackId) => _offlineTrackIds.contains(trackId);
  bool isAlbumOfflineSync(String albumId) => _offlineAlbumIds.contains(albumId);

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
    _progressControllers[id]?.add(OfflineProgress(fraction: fraction, isDone: done));
    if (done) {
      // #12: close and remove controller when download finishes
      _progressControllers[id]?.close();
      _progressControllers.remove(id);
      _cancelTokens.remove(id);
    }
  }

  // ---------------------------------------------------------------------------
  // SharedPreferences sync helpers
  // ---------------------------------------------------------------------------

  Future<void> _persistTrackIds() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_offlineTracksKey, _offlineTrackIds.toList());
  }

  Future<void> _persistAlbumIds() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_offlineAlbumsKey, _offlineAlbumIds.toList());
  }

  // ---------------------------------------------------------------------------
  // Cover art — #duplicate prevention via in-memory check + file existence
  // ---------------------------------------------------------------------------

  Future<void> downloadCoverArt(String coverArtId, ApiService apiService) async {
    final base = await _getStoragePath();
    final path = _coverPath(base, coverArtId);
    if (await File(path).exists()) return; // already have it

    try {
      await _dio.download(apiService.getCoverArtUrl(coverArtId, size: 600), path);
    } catch (e) {
      debugPrint('cover art $coverArtId download failed: $e');
    }
  }

  /// Returns local cover art path synchronously if known, else null.
  /// For UI: use this after initialize() has run.
  Future<String?> getLocalCoverArtPath(String? coverArtId) async {
    if (coverArtId == null) return null;
    final base = await _getStoragePath();
    final path = _coverPath(base, coverArtId);
    return await File(path).exists() ? path : null;
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

  Future<void> downloadTrack(Map<String, dynamic> track, ApiService apiService) async {
    final trackId = track['id'] as String;
    if (_offlineTrackIds.contains(trackId)) return; // #duplicate: already downloaded

    final base = await _getStoragePath();
    final path = _trackPath(base, trackId);

    // #11: create cancel token for this download
    final cancelToken = CancelToken();
    _cancelTokens[trackId] = cancelToken;

    try {
      await _dio.download(
        apiService.getStreamUrl(trackId),
        path,
        cancelToken: cancelToken,
        onReceiveProgress: (count, total) {
          if (total > 0) _emitProgress(trackId, count / total);
        },
      );

      // also cache cover art (deduplication handled inside)
      final coverArtId = track['coverArt'] as String?;
      if (coverArtId != null) {
        await downloadCoverArt(coverArtId, apiService);
      }

      _offlineTrackIds.add(trackId);
      await _persistTrackIds();
      _emitProgress(trackId, 1.0, done: true);
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) {
        debugPrint('track $trackId download cancelled');
        // clean up partial file
        final f = File(path);
        if (await f.exists()) await f.delete();
      } else {
        debugPrint('track $trackId download failed: $e');
        rethrow;
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
    _cancelTokens.putIfAbsent(albumId, () => CancelToken());

    int completed = 0;

    for (final track in tracks) {
      // #11: check if album-level cancel was requested
      if (_cancelTokens[albumId]?.isCancelled == true) break;

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
        controller.add(OfflineProgress(fraction: completed / tracks.length, hasError: true));
      }
    }

    _offlineAlbumIds.add(albumId);
    await _persistAlbumIds();
    _emitProgress(albumId, 1.0, done: true);
  }

  // ---------------------------------------------------------------------------
  // Cancellation — #11
  // ---------------------------------------------------------------------------

  void cancelDownload(String id) {
    _cancelTokens[id]?.cancel('user cancelled');
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  Future<void> deleteTrack(String trackId) async {
    final base = await _getStoragePath();
    final file = File(_trackPath(base, trackId));
    if (await file.exists()) await file.delete();

    _offlineTrackIds.remove(trackId);
    await _persistTrackIds();
  }

  /// #10: deletes all tracks, album metadata, and associated cover art.
  Future<void> deleteAlbum(String albumId) async {
    final base = await _getStoragePath();
    final cached = await getCachedAlbumMetadata(albumId);

    if (cached != null) {
      // collect cover art IDs used by this album's tracks
      final coverArtIds = cached
          .map((t) => t['coverArt'] as String?)
          .whereType<String>()
          .toSet();

      // delete tracks
      for (final track in cached) {
        final trackId = track['id'] as String?;
        if (trackId != null) await deleteTrack(trackId);
      }

      // delete cover art only if no other offline album uses it
      for (final coverArtId in coverArtIds) {
        final usedByOthers = await _isCoverUsedByOtherAlbums(coverArtId, albumId, base);
        if (!usedByOthers) {
          final coverFile = File(_coverPath(base, coverArtId));
          if (await coverFile.exists()) await coverFile.delete();
        }
      }

      // delete metadata file
      final metaFile = File(_albumMetaPath(base, albumId));
      if (await metaFile.exists()) await metaFile.delete();
    }

    _offlineAlbumIds.remove(albumId);
    await _persistAlbumIds();
  }

  Future<bool> _isCoverUsedByOtherAlbums(
    String coverArtId,
    String excludeAlbumId,
    String basePath,
  ) async {
    for (final albumId in _offlineAlbumIds) {
      if (albumId == excludeAlbumId) continue;
      final cached = await getCachedAlbumMetadata(albumId);
      if (cached == null) continue;
      final usesThisCover = cached.any((t) => t['coverArt'] == coverArtId);
      if (usesThisCover) return true;
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

  // ---------------------------------------------------------------------------
  // Offline mode toggle
  // ---------------------------------------------------------------------------

  Future<void> setOfflineMode(bool value) async {
    _isOfflineMode = value;
    offlineModeNotifier.value = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_offlineModeKey, value);
  }

  /// Triggered by api failures to automatically switch into offline mode
  void triggerOfflineAutoToggle() {
    if (!_isOfflineMode) {
      setOfflineMode(true);
    }
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
