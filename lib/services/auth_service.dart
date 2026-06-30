import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  static const String _keyUrl = 'server_url';
  static const String _keyAlternateUrls = 'alternate_server_urls';
  static const String _keyUsername = 'username';
  static const String _keyPassword = 'password'; // we will store it to re-generate tokens for each request if needed
  static const String _keyIsLoggedIn = 'is_logged_in';

  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  SharedPreferences? _prefs;

  Future<SharedPreferences> get _getPrefs async {
    return _prefs ??= await SharedPreferences.getInstance();
  }

  Future<void> saveCredentials(String url, String username, String password) async {
    final prefs = await _getPrefs;
    await prefs.setString(_keyUrl, url);
    await prefs.remove(_keyAlternateUrls);
    await prefs.setString(_keyUsername, username);
    await prefs.setString(_keyPassword, password);
    await prefs.setBool(_keyIsLoggedIn, true);
  }

  Future<void> logout() async {
    final prefs = await _getPrefs;
    await prefs.clear();
  }

  Future<bool> get isLoggedIn async {
    final prefs = await _getPrefs;
    return prefs.getBool(_keyIsLoggedIn) ?? false;
  }

  Future<String?> get serverUrl async {
    final prefs = await _getPrefs;
    return prefs.getString(_keyUrl);
  }

  Future<List<String>> get alternateServerUrls async {
    final prefs = await _getPrefs;
    return prefs.getStringList(_keyAlternateUrls) ?? [];
  }

  Future<void> setAlternateServerUrls(List<String> urls) async {
    final prefs = await _getPrefs;
    await prefs.setStringList(_keyAlternateUrls, urls);
  }

  Future<String?> get username async {
    final prefs = await _getPrefs;
    return prefs.getString(_keyUsername);
  }

  Future<String?> get password async {
    final prefs = await _getPrefs;
    return prefs.getString(_keyPassword);
  }
}

