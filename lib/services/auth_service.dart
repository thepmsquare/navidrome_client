import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  static const String _keyUrl = 'server_url';
  static const String _keyUsername = 'username';
  static const String _keyPassword = 'password'; // we will store it to re-generate tokens for each request if needed
  static const String _keyIsLoggedIn = 'is_logged_in';

  Future<void> saveCredentials(String url, String username, String password) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyUrl, url);
    await prefs.setString(_keyUsername, username);
    await prefs.setString(_keyPassword, password);
    await prefs.setBool(_keyIsLoggedIn, true);
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }

  Future<bool> get isLoggedIn async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyIsLoggedIn) ?? false;
  }

  Future<String?> get serverUrl async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyUrl);
  }

  Future<String?> get username async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyUsername);
  }

  Future<String?> get password async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyPassword);
  }
}
