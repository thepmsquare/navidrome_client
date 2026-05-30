import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  static final SecureStorageService _instance =
      SecureStorageService._internal();
  factory SecureStorageService() => _instance;
  SecureStorageService._internal();

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  bool _isLoggedIn = false;
  bool get isLoggedInSync => _isLoggedIn;

  Future<void> saveConnectionCredentials({
    required String connectionUrl,
    required String username,
    required String password,
  }) async {
    await _storage.write(key: 'connection_url', value: connectionUrl);
    await _storage.write(key: 'username', value: username);
    await _storage.write(key: 'password', value: password);
    await _storage.write(key: 'is_logged_in', value: 'true');
    _isLoggedIn = true; // keep cache in sync
  }

  Future<Map<String, String?>> getConnectionCredentials() async {
    final connectionUrl = await _storage.read(key: 'connection_url');
    final username = await _storage.read(key: 'username');
    final password = await _storage.read(key: 'password');
    return {
      'connectionUrl': connectionUrl,
      'username': username,
      'password': password,
    };
  }

  Future<bool> isLoggedIn() async {
    final value = await _storage.read(key: 'is_logged_in');
    _isLoggedIn = value == 'true';
    return _isLoggedIn;
  }

  Future<void> clearCredentials() async {
    await _storage.delete(key: 'connection_url');
    await _storage.delete(key: 'username');
    await _storage.delete(key: 'password');
    await _storage.delete(key: 'is_logged_in');
    _isLoggedIn = false;
  }
}
