import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navidrome_client/services/version_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('version service tests', () {
    setUp(() {
      // Mock loading CHANGELOG.md from rootBundle
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMessageHandler('flutter/assets', (ByteData? message) async {
        final String key = utf8.decode(message!.buffer.asUint8List(message.offsetInBytes, message.lengthInBytes));
        if (key == 'CHANGELOG.md') {
          final String mockChangelog = '''
# changelog

## 1.0.0+16

- fix bug that autoplays music on startup.

## 1.0.0+15

- fix logout functionality.
- save lyrics offline on saving songs offline.

## 1.0.0+14

- implement fuzzy search.
''';
          return ByteData.sublistView(Uint8List.fromList(utf8.encode(mockChangelog)));
        }
        return null;
      });
    });

    test('getAllChangelogEntries parses changelog correctly', () async {
      final entries = await VersionService().getAllChangelogEntries();

      expect(entries.length, 3);

      expect(entries[0].version, '1.0.0+16');
      expect(entries[0].notes, '- fix bug that autoplays music on startup.');

      expect(entries[1].version, '1.0.0+15');
      expect(entries[1].notes, '- fix logout functionality.\n- save lyrics offline on saving songs offline.');

      expect(entries[2].version, '1.0.0+14');
      expect(entries[2].notes, '- implement fuzzy search.');
    });
  });
}
