// version_service_test.dart — tests for VersionService.getAllChangelogEntries().
// covers: standard parsing, multi-line notes, in-progress version suffix,
// empty changelog, and the exact note content from real changelog entries.
//
// rootBundle uses CachingAssetBundle internally; we must call rootBundle.clear()
// in tearDown to prevent each test from receiving the previous test's cached asset.

import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navidrome_client/services/version_service.dart';

void _mockChangelog(String content) {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMessageHandler('flutter/assets', (ByteData? message) async {
    final String key = utf8.decode(
      message!.buffer.asUint8List(message.offsetInBytes, message.lengthInBytes),
    );
    if (key == 'CHANGELOG.md') {
      return ByteData.sublistView(Uint8List.fromList(utf8.encode(content)));
    }
    return null;
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    // clear the rootBundle cache so each test gets a fresh load
    rootBundle.clear();
  });

  tearDown(() {
    // clear mock messenger and cache after each test
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler('flutter/assets', null);
    rootBundle.clear();
  });

  group('version service — changelog parsing', () {
    test('parses standard entries correctly', () async {
      _mockChangelog('''
# changelog

## 1.0.0+16

- fix bug that autoplays music on startup.

## 1.0.0+15

- fix logout functionality.
- save lyrics offline on saving songs offline.

## 1.0.0+14

- implement fuzzy search.
''');

      final entries = await VersionService().getAllChangelogEntries();

      expect(entries.length, 3);
      expect(entries[0].version, '1.0.0+16');
      expect(entries[0].notes, '- fix bug that autoplays music on startup.');
      expect(entries[1].version, '1.0.0+15');
      expect(
        entries[1].notes,
        '- fix logout functionality.\n- save lyrics offline on saving songs offline.',
      );
      expect(entries[2].version, '1.0.0+14');
      expect(entries[2].notes, '- implement fuzzy search.');
    });

    test('parses version with (in progress) suffix — keeps full raw version string', () async {
      _mockChangelog('''
# changelog

## 1.0.0+19 (in progress)

- bug fix: some fix.

## 1.0.0+18

- add feature.
''');

      final entries = await VersionService().getAllChangelogEntries();

      expect(entries.length, 2);
      expect(entries[0].version, '1.0.0+19 (in progress)');
      expect(entries[0].notes, '- bug fix: some fix.');
      expect(entries[1].version, '1.0.0+18');
    });

    test('parses multi-line notes preserving all lines', () async {
      _mockChangelog('''
# changelog

## 1.0.0+11

- bug fix: stop music play on log out.
- cache network images and other performance tweaks.
- remove offline mode from profile exports.
- add auto-save offline played songs with configurable storage cap and lru eviction (both on by default).
- bug fix: prevent playback from stopping on unlock after a song transition while locked.
''');

      final entries = await VersionService().getAllChangelogEntries();

      expect(entries.length, 1);
      expect(entries[0].version, '1.0.0+11');
      final lines = entries[0].notes.split('\n');
      expect(lines.length, 5);
    });

    test('empty changelog content returns empty list', () async {
      _mockChangelog('');
      final entries = await VersionService().getAllChangelogEntries();
      expect(entries, isEmpty);
    });

    test('changelog with only a title line and no version blocks returns empty list', () async {
      _mockChangelog('# changelog\n\n');
      final entries = await VersionService().getAllChangelogEntries();
      expect(entries, isEmpty);
    });

    test('single version with no notes returns entry with empty notes', () async {
      _mockChangelog('''
# changelog

## 1.0.0+1

''');

      final entries = await VersionService().getAllChangelogEntries();
      expect(entries.length, 1);
      expect(entries[0].version, '1.0.0+1');
      expect(entries[0].notes, '');
    });

    test('ChangelogEntry constructor stores version and notes', () {
      const entry = ChangelogEntry(version: '1.2.3+4', notes: '- something');
      expect(entry.version, '1.2.3+4');
      expect(entry.notes, '- something');
    });
  });
}
