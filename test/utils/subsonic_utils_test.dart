// subsonic_utils_test.dart — pure-dart tests for SubsonicUtils.
// no platform channels needed.
// covers: salt generation, token generation, determinism, sensitivity.

import 'package:flutter_test/flutter_test.dart';
import 'package:navidrome_client/utils/subsonic_utils.dart';

void main() {
  group('subsonic utils — salt generation', () {
    test('generateSalt returns a 10-character string', () {
      final salt = SubsonicUtils.generateSalt();
      expect(salt.length, 10);
    });

    test('generateSalt returns different values on each call', () {
      final salts = List.generate(20, (_) => SubsonicUtils.generateSalt());
      // with uuid v4 it is astronomically unlikely for any two to match
      final unique = salts.toSet();
      expect(unique.length, 20);
    });

    test('generateSalt contains only alphanumeric and hyphen characters (uuid v4 subset)', () {
      final salt = SubsonicUtils.generateSalt();
      expect(RegExp(r'^[a-f0-9\-]+$').hasMatch(salt), isTrue,
          reason: 'salt should only contain uuid hex chars and hyphens');
    });
  });

  group('subsonic utils — token generation', () {
    test('generateToken returns a 32-character lowercase hex md5 string', () {
      final token = SubsonicUtils.generateToken('password', 'saltsalt');
      expect(token.length, 32);
      expect(RegExp(r'^[a-f0-9]+$').hasMatch(token), isTrue);
    });

    test('generateToken is deterministic for same inputs', () {
      const password = 'mypassword';
      const salt = 'abcdef1234';
      final t1 = SubsonicUtils.generateToken(password, salt);
      final t2 = SubsonicUtils.generateToken(password, salt);
      expect(t1, equals(t2));
    });

    test('generateToken produces different output for different passwords', () {
      const salt = 'fixedsalt1';
      final t1 = SubsonicUtils.generateToken('password1', salt);
      final t2 = SubsonicUtils.generateToken('password2', salt);
      expect(t1, isNot(equals(t2)));
    });

    test('generateToken produces different output for different salts', () {
      const password = 'samepassword';
      final t1 = SubsonicUtils.generateToken(password, 'salt00001a');
      final t2 = SubsonicUtils.generateToken(password, 'salt00002b');
      expect(t1, isNot(equals(t2)));
    });

    test('generateToken matches known md5(password+salt) value', () {
      // md5('sesame' + 'c19b2d') == 26719a1196d2a940705a59634eb18eab (subsonic API docs example)
      final token = SubsonicUtils.generateToken('sesame', 'c19b2d');
      expect(token, equals('26719a1196d2a940705a59634eb18eab'));
    });
  });
}
