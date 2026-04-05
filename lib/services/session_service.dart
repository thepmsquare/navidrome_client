import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class SessionService {
  static const String _keyIsFirstRun = 'is_first_run';
  static const String _keyLastTabIndex = 'last_tab_index';
  static const String _keyLastLibraryView = 'last_library_view';
  static const String _keyLastQueue = 'last_playback_queue';
  static const String _keyLastIndex = 'last_playback_index';
  static const String _keyLastPosition = 'last_playback_position_ms';

  static final SessionService _instance = SessionService._internal();
  factory SessionService() => _instance;
  SessionService._internal();

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  Future<bool> get isFirstRun async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyIsFirstRun) ?? true;
  }

  Future<void> setNotFirstRun() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyIsFirstRun, false);
  }

  Future<int> get lastTabIndex async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_keyLastTabIndex) ?? 0;
  }

  Future<void> setLastTabIndex(int index) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_keyLastTabIndex, index);
  }

  Future<String?> get lastLibraryView async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyLastLibraryView);
  }

  Future<void> setLastLibraryView(String view) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyLastLibraryView, view);
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  Future<List<Map<String, dynamic>>?> get lastQueue async {
    final prefs = await SharedPreferences.getInstance();
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
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyLastQueue, jsonEncode(queue));
  }

  Future<int> get lastIndex async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_keyLastIndex) ?? 0;
  }

  Future<void> setLastIndex(int index) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_keyLastIndex, index);
  }

  Future<int> get lastPositionMs async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_keyLastPosition) ?? 0;
  }

  Future<void> setLastPositionMs(int ms) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_keyLastPosition, ms);
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyLastTabIndex);
    await prefs.remove(_keyLastLibraryView);
    await prefs.remove(_keyLastQueue);
    await prefs.remove(_keyLastIndex);
    await prefs.remove(_keyLastPosition);
  }
}
