import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:uuid/uuid.dart';

class SubsonicUtils {
  static String generateSalt() {
    return const Uuid().v4().substring(0, 10);
  }

  static String generateToken(String password, String salt) {
    final bytes = utf8.encode(password + salt);
    final digest = md5.convert(bytes);
    return digest.toString();
  }
}
