import 'dart:convert';
import 'package:crypto/crypto.dart';

/// Holds connection info for a Navidrome / Subsonic server.
class NavidromeCredentials {
  final String serverUrl;   // e.g. "https://music.example.com"
  final String username;
  final String password;
  final String clientName;  // arbitrary app identifier
  final String apiVersion;

  const NavidromeCredentials({
    required this.serverUrl,
    required this.username,
    required this.password,
    this.clientName = 'flutter_navidrome',
    this.apiVersion = '1.16.1',
  });

  /// Builds the token-based auth query parameters (Subsonic API ≥ 1.13.0).
  ///
  /// token = md5(password + salt), salt is a random string.
  Map<String, String> authParams() {
    final salt = _generateSalt();
    final token = _md5(password + salt);

    return {
      'u': username,
      't': token,
      's': salt,
      'v': apiVersion,
      'c': clientName,
      'f': 'json',
    };
  }

  String _generateSalt([int length = 10]) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    final rand = DateTime.now().microsecondsSinceEpoch;
    // Simple deterministic-enough salt; replace with dart:math Random if preferred
    return List.generate(
      length,
      (i) => chars[(rand + i * 31) % chars.length],
    ).join();
  }

  String _md5(String input) {
    final bytes = utf8.encode(input);
    return md5.convert(bytes).toString();
  }
}