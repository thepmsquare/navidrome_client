// disk_utility_test.dart — pure-dart tests for DiskUtility.formatBytes.
// no platform channels or I/O needed — tests the formatting logic only.

import 'package:flutter_test/flutter_test.dart';
import 'package:navidrome_client/utils/disk_utility.dart';

void main() {
  group('disk utility — formatBytes', () {
    test('0 bytes returns "0 b"', () {
      expect(DiskUtility.formatBytes(0), equals('0 b'));
    });

    test('negative value returns "0 b"', () {
      expect(DiskUtility.formatBytes(-1), equals('0 b'));
    });

    test('1 byte returns "1.0 b"', () {
      expect(DiskUtility.formatBytes(1), equals('1.0 b'));
    });

    test('1023 bytes stays in bytes unit', () {
      expect(DiskUtility.formatBytes(1023), equals('1023.0 b'));
    });

    test('1024 bytes returns "1.0 kb"', () {
      expect(DiskUtility.formatBytes(1024), equals('1.0 kb'));
    });

    test('1536 bytes returns "1.5 kb"', () {
      expect(DiskUtility.formatBytes(1536), equals('1.5 kb'));
    });

    test('1048576 bytes (1 MiB) returns "1.0 mb"', () {
      expect(DiskUtility.formatBytes(1048576), equals('1.0 mb'));
    });

    test('1073741824 bytes (1 GiB) returns "1.0 gb"', () {
      expect(DiskUtility.formatBytes(1073741824), equals('1.0 gb'));
    });

    test('1099511627776 bytes (1 TiB) returns "1.0 tb"', () {
      expect(DiskUtility.formatBytes(1099511627776), equals('1.0 tb'));
    });

    test('512 mb (536870912 bytes) formats correctly', () {
      expect(DiskUtility.formatBytes(536870912), equals('512.0 mb'));
    });
  });
}
