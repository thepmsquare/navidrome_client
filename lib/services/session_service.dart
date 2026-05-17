import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class SessionService {
  static const String _keyIsFirstRun = 'is_first_run';
  static const String _keyLastTabIndex = 'last_tab_index';
  static const String _keyLastLibraryView = 'last_library_view';
  static const String _keyLastQueue = 'last_playback_queue';
  static const String _keyLastIndex = 'last_playback_index';
  static const String _keyLastPosition = 'last_playback_position_ms';
  static const String _keyStopPlaybackOnTaskRemoved = 'stop_playback_on_task_removed';
  static const String _keyAutoDownloadPlayed = 'auto_download_played';
  static const String _keyAutoDownloadMaxBytes = 'auto_download_max_bytes';
  static const String _keyAutoDownloadLruEvict = 'auto_download_lru_evict';
  static const String _keyHomeSections = 'home_sections';
  static const String _keyLastVersion = 'last_version';

  static final SessionService _instance = SessionService._internal();
  factory SessionService() => _instance;
  SessionService._internal();

  SharedPreferences? _prefs;

  Future<SharedPreferences> get _getPrefs async {
    return _prefs ??= await SharedPreferences.getInstance();
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  Future<bool> get isFirstRun async {
    final prefs = await _getPrefs;
    return prefs.getBool(_keyIsFirstRun) ?? true;
  }

  Future<void> setNotFirstRun() async {
    final prefs = await _getPrefs;
    await prefs.setBool(_keyIsFirstRun, false);
  }

  Future<int> get lastTabIndex async {
    final prefs = await _getPrefs;
    return prefs.getInt(_keyLastTabIndex) ?? 0;
  }

  Future<void> setLastTabIndex(int index) async {
    final prefs = await _getPrefs;
    await prefs.setInt(_keyLastTabIndex, index);
  }

  Future<String?> get lastLibraryView async {
    final prefs = await _getPrefs;
    return prefs.getString(_keyLastLibraryView);
  }

  Future<void> setLastLibraryView(String view) async {
    final prefs = await _getPrefs;
    await prefs.setString(_keyLastLibraryView, view);
  }

  Future<String?> get lastVersion async {
    final prefs = await _getPrefs;
    return prefs.getString(_keyLastVersion);
  }

  Future<void> setLastVersion(String version) async {
    final prefs = await _getPrefs;
    await prefs.setString(_keyLastVersion, version);
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  Future<List<Map<String, dynamic>>?> get lastQueue async {
    final prefs = await _getPrefs;
    final data = prefs.getString(_keyLastQueue);
    if (data == null) return null;
    try {
      final decoded = jsonDecode(data) as List;
      return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return null;
    }
  }

  Future<void> setLastQueue(List<Map<String, dynamic>> queue) async {
    final prefs = await _getPrefs;
    await prefs.setString(_keyLastQueue, jsonEncode(queue));
  }

  Future<int> get lastIndex async {
    final prefs = await _getPrefs;
    return prefs.getInt(_keyLastIndex) ?? 0;
  }

  Future<void> setLastIndex(int index) async {
    final prefs = await _getPrefs;
    await prefs.setInt(_keyLastIndex, index);
  }

  Future<int> get lastPositionMs async {
    final prefs = await _getPrefs;
    return prefs.getInt(_keyLastPosition) ?? 0;
  }

  Future<void> setLastPositionMs(int ms) async {
    final prefs = await _getPrefs;
    await prefs.setInt(_keyLastPosition, ms);
  }

  Future<void> clearSession() async {
    final prefs = await _getPrefs;
    await prefs.remove(_keyLastTabIndex);
    await prefs.remove(_keyLastLibraryView);
    await prefs.remove(_keyLastQueue);
    await prefs.remove(_keyLastIndex);
    await prefs.remove(_keyLastPosition);
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  Future<bool> get stopPlaybackOnTaskRemoved async {
    final prefs = await _getPrefs;
    return prefs.getBool(_keyStopPlaybackOnTaskRemoved) ?? true;
  }

  Future<void> setStopPlaybackOnTaskRemoved(bool value) async {
    final prefs = await _getPrefs;
    await prefs.setBool(_keyStopPlaybackOnTaskRemoved, value);
  }

  Future<bool> get autoDownloadPlayed async {
    final prefs = await _getPrefs;
    return prefs.getBool(_keyAutoDownloadPlayed) ?? true;
  }

  Future<void> setAutoDownloadPlayed(bool value) async {
    final prefs = await _getPrefs;
    await prefs.setBool(_keyAutoDownloadPlayed, value);
  }

  // stored as bytes; default 1 GiB
  Future<int> get autoDownloadMaxBytes async {
    final prefs = await _getPrefs;
    return prefs.getInt(_keyAutoDownloadMaxBytes) ?? 1073741824;
  }

  Future<void> setAutoDownloadMaxBytes(int bytes) async {
    final prefs = await _getPrefs;
    await prefs.setInt(_keyAutoDownloadMaxBytes, bytes);
  }

  Future<bool> get autoDownloadLruEvict async {
    final prefs = await _getPrefs;
    return prefs.getBool(_keyAutoDownloadLruEvict) ?? true;
  }

  Future<void> setAutoDownloadLruEvict(bool value) async {
    final prefs = await _getPrefs;
    await prefs.setBool(_keyAutoDownloadLruEvict, value);
  }

  // ---------------------------------------------------------------------------
  // Home Page
  // ---------------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> get homeSections async {
    final prefs = await _getPrefs;
    final data = prefs.getString(_keyHomeSections);
    if (data == null) {
      return [
        {'id': 'most_played', 'visible': true},
        {'id': 'random_tracks', 'visible': true},
        {'id': 'recently_played', 'visible': true},
      ];
    }
    try {
      final decoded = jsonDecode(data) as List;
      final sections = decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      
      // Ensure recently_played is present (for existing users)
      if (!sections.any((s) => s['id'] == 'recently_played')) {
        sections.add({'id': 'recently_played', 'visible': true});
      }
      
      return sections;
    } catch (_) {
      return [
        {'id': 'most_played', 'visible': true},
        {'id': 'random_tracks', 'visible': true},
        {'id': 'recently_played', 'visible': true},
      ];
    }
  }

  Future<void> setHomeSections(List<Map<String, dynamic>> sections) async {
    final prefs = await _getPrefs;
    await prefs.setString(_keyHomeSections, jsonEncode(sections));
  }
}

