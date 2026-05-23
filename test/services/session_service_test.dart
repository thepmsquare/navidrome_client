// session_service_test.dart — tests for SessionService persistence layer.
//
// Uses SharedPreferences.setMockInitialValues so no real disk I/O or platform
// channels are exercised.
//
// Features/bug fixes covered:
//   v1.0.0+13 — stopPlaybackOnTaskRemoved now defaults to true.
//   v1.0.0+14 — recently_played section added to home page.
//   v1.0.0+14 — recently_played is injected if missing from saved prefs
//               (migration for existing users).
//   v1.0.0+11 — stop music on logout → clearSession() removes playback state
//               but preserves settings.

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:navidrome_client/services/session_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  // ---------------------------------------------------------------------------
  // Defaults
  // ---------------------------------------------------------------------------

  group('session service — defaults', () {
    test('isFirstRun defaults to true', () async {
      expect(await SessionService().isFirstRun, isTrue);
    });

    test('lastTabIndex defaults to 0', () async {
      expect(await SessionService().lastTabIndex, equals(0));
    });

    test('lastIndex defaults to 0', () async {
      expect(await SessionService().lastIndex, equals(0));
    });

    test('lastPositionMs defaults to 0', () async {
      expect(await SessionService().lastPositionMs, equals(0));
    });

    test(
      'stopPlaybackOnTaskRemoved defaults to true (v1.0.0+13 changed default)',
      () async {
        expect(await SessionService().stopPlaybackOnTaskRemoved, isTrue);
      },
    );

    test('autoSaveOfflinePlayed defaults to true', () async {
      expect(await SessionService().autoSaveOfflinePlayed, isTrue);
    });

    test('autoSaveOfflineLruEvict defaults to true', () async {
      expect(await SessionService().autoSaveOfflineLruEvict, isTrue);
    });

    test('autoSaveOfflineMaxBytes defaults to 1 GiB (1073741824)', () async {
      expect(await SessionService().autoSaveOfflineMaxBytes, equals(1073741824));
    });

    test('lastVersion defaults to null when not set', () async {
      expect(await SessionService().lastVersion, isNull);
    });

    test('lastQueue defaults to null when not set', () async {
      expect(await SessionService().lastQueue, isNull);
    });

    test('lastLibraryView defaults to null when not set', () async {
      expect(await SessionService().lastLibraryView, isNull);
    });
  });

  // ---------------------------------------------------------------------------
  // Setters round-trip
  // ---------------------------------------------------------------------------

  group('session service — setters round-trip', () {
    test('setNotFirstRun marks isFirstRun as false', () async {
      await SessionService().setNotFirstRun();
      expect(await SessionService().isFirstRun, isFalse);
    });

    test('setLastTabIndex persists and retrieves correctly', () async {
      await SessionService().setLastTabIndex(2);
      expect(await SessionService().lastTabIndex, equals(2));
    });

    test('setLastIndex persists and retrieves correctly', () async {
      await SessionService().setLastIndex(5);
      expect(await SessionService().lastIndex, equals(5));
    });

    test('setLastPositionMs persists and retrieves correctly', () async {
      await SessionService().setLastPositionMs(12345);
      expect(await SessionService().lastPositionMs, equals(12345));
    });

    test('setLastVersion persists and retrieves correctly', () async {
      await SessionService().setLastVersion('1.0.0+19');
      expect(await SessionService().lastVersion, equals('1.0.0+19'));
    });

    test('setLastLibraryView persists and retrieves correctly', () async {
      await SessionService().setLastLibraryView('albums');
      expect(await SessionService().lastLibraryView, equals('albums'));
    });

    test('setStopPlaybackOnTaskRemoved persists false correctly', () async {
      await SessionService().setStopPlaybackOnTaskRemoved(false);
      expect(await SessionService().stopPlaybackOnTaskRemoved, isFalse);
    });
  });

  // ---------------------------------------------------------------------------
  // Queue round-trip
  // ---------------------------------------------------------------------------

  group('session service — lastQueue json round-trip', () {
    test('queue encodes and decodes correctly', () async {
      final queue = [
        {'id': '1', 'title': 'song a', 'artist': 'artist x'},
        {'id': '2', 'title': 'song b', 'artist': 'artist y'},
      ];
      await SessionService().setLastQueue(queue);
      final retrieved = await SessionService().lastQueue;

      expect(retrieved, isNotNull);
      expect(retrieved!.length, equals(2));
      expect(retrieved[0]['id'], equals('1'));
      expect(retrieved[0]['title'], equals('song a'));
      expect(retrieved[1]['id'], equals('2'));
    });

    test('empty queue is stored and retrieved as empty list', () async {
      await SessionService().setLastQueue([]);
      final retrieved = await SessionService().lastQueue;
      expect(retrieved, isNotNull);
      expect(retrieved, isEmpty);
    });

    test('queue with numeric id values round-trips correctly', () async {
      final queue = [{'id': 42, 'title': 'int id track'}];
      await SessionService().setLastQueue(queue);
      final retrieved = await SessionService().lastQueue;
      expect(retrieved, isNotNull);
      expect(retrieved!.first['id'], equals(42));
    });
  });

  // ---------------------------------------------------------------------------
  // clearSession — v1.0.0+11: stop on logout
  // ---------------------------------------------------------------------------

  group('session service — clearSession (v1.0.0+11 logout)', () {
    test('clears lastQueue, lastIndex, and lastPositionMs', () async {
      await SessionService().setLastQueue([{'id': '1'}]);
      await SessionService().setLastIndex(3);
      await SessionService().setLastPositionMs(9000);

      await SessionService().clearSession();

      expect(await SessionService().lastQueue, isNull);
      expect(await SessionService().lastIndex, equals(0));
      expect(await SessionService().lastPositionMs, equals(0));
    });

    test('clearSession does not clear stopPlaybackOnTaskRemoved setting', () async {
      await SessionService().setStopPlaybackOnTaskRemoved(false);
      await SessionService().clearSession();
      // setting should survive a session clear (only playback state is wiped)
      expect(await SessionService().stopPlaybackOnTaskRemoved, isFalse);
    });

    test('clearSession does not clear lastVersion', () async {
      await SessionService().setLastVersion('1.0.0+18');
      await SessionService().clearSession();
      expect(await SessionService().lastVersion, equals('1.0.0+18'));
    });
  });

  // ---------------------------------------------------------------------------
  // homeSections — v1.0.0+14 recently_played
  // ---------------------------------------------------------------------------

  group('session service — homeSections (v1.0.0+14)', () {
    test('default sections include recently_played', () async {
      final sections = await SessionService().homeSections;
      final ids = sections.map((s) => s['id']).toList();
      expect(ids.contains('recently_played'), isTrue);
    });

    test('default sections include most_played and random_tracks', () async {
      final sections = await SessionService().homeSections;
      final ids = sections.map((s) => s['id']).toList();
      expect(ids.contains('most_played'), isTrue);
      expect(ids.contains('random_tracks'), isTrue);
    });

    test('all default sections are visible by default', () async {
      final sections = await SessionService().homeSections;
      for (final section in sections) {
        expect(section['visible'], isTrue,
            reason: 'section ${section['id']} should be visible by default');
      }
    });

    test(
      'migration: recently_played is added if missing from saved prefs',
      () async {
        // simulate an old user who only has most_played and random_tracks
        SharedPreferences.setMockInitialValues({
          'home_sections':
              '[{"id":"most_played","visible":true},{"id":"random_tracks","visible":true}]',
        });
        final sections = await SessionService().homeSections;
        final ids = sections.map((s) => s['id']).toList();
        expect(ids.contains('recently_played'), isTrue,
            reason: 'recently_played should be injected for existing users');
      },
    );

    test('setHomeSections persists and retrieves correctly', () async {
      final custom = [
        {'id': 'most_played', 'visible': false},
        {'id': 'random_tracks', 'visible': true},
        {'id': 'recently_played', 'visible': true},
      ];
      await SessionService().setHomeSections(custom);
      final retrieved = await SessionService().homeSections;
      expect(retrieved.length, equals(3));
      expect(retrieved[0]['visible'], isFalse);
    });

    test('corrupted home_sections json falls back to defaults', () async {
      SharedPreferences.setMockInitialValues({'home_sections': 'invalid_json{'});
      final sections = await SessionService().homeSections;
      // fallback to defaults — should include all three
      final ids = sections.map((s) => s['id']).toList();
      expect(ids.contains('most_played'), isTrue);
      expect(ids.contains('recently_played'), isTrue);
    });
  });
}
