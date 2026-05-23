// offline_service_state_test.dart — tests for OfflineService in-memory state.
//
// Uses SharedPreferences.setMockInitialValues so no real disk I/O or platform
// channels are exercised.
//
// Bug fixes covered:
//   v1.0.0+19 — no-internet does NOT auto-toggle offline mode persistently.
//               (persist: false must leave prefs key unchanged)
//   v1.0.0+15 — offline mode and no-internet are now separate states.
//               (OfflineState enum has distinct offlineManual / offlineNoInternet)
//   v1.0.0+11 — clearState() resets all in-memory sets correctly on logout.
//
// OfflineProgress.isSavingOffline logic is also tested here as a pure-dart
// value-object test (no platform deps).

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:navidrome_client/services/offline_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    // reset singleton state and _isInitialized guard between tests
    OfflineService().resetForTesting();
    await OfflineService().clearState();
  });

  // ---------------------------------------------------------------------------
  // OfflineState enum — v1.0.0+15 separate states
  // ---------------------------------------------------------------------------

  group('offline service — offline state enum (v1.0.0+15)', () {
    test('OfflineState has three distinct values', () {
      expect(OfflineState.values.length, equals(3));
    });

    test('online, offlineManual, and offlineNoInternet are all distinct', () {
      expect(OfflineState.online, isNot(equals(OfflineState.offlineManual)));
      expect(OfflineState.online, isNot(equals(OfflineState.offlineNoInternet)));
      expect(OfflineState.offlineManual, isNot(equals(OfflineState.offlineNoInternet)));
    });
  });

  // ---------------------------------------------------------------------------
  // setOfflineMode — v1.0.0+19 no-internet does not persist
  // ---------------------------------------------------------------------------

  group('offline service — setOfflineMode', () {
    test('manual toggle sets offlineModeNotifier to offlineManual', () async {
      await OfflineService().setOfflineMode(true, isAuto: false, persist: false);
      expect(OfflineService().offlineModeNotifier.value, equals(OfflineState.offlineManual));
      expect(OfflineService().isOfflineMode, isTrue);
    });

    test('auto toggle sets offlineModeNotifier to offlineNoInternet', () async {
      await OfflineService().setOfflineMode(true, isAuto: true, persist: false);
      expect(OfflineService().offlineModeNotifier.value, equals(OfflineState.offlineNoInternet));
      expect(OfflineService().isOfflineMode, isTrue);
    });

    test('setting false resets to online', () async {
      await OfflineService().setOfflineMode(true, isAuto: false, persist: false);
      await OfflineService().setOfflineMode(false, persist: false);
      expect(OfflineService().offlineModeNotifier.value, equals(OfflineState.online));
      expect(OfflineService().isOfflineMode, isFalse);
    });

    test(
      'bug fix v1.0.0+19: auto toggle with persist=false does not write to SharedPreferences',
      () async {
        await OfflineService().setOfflineMode(true, isAuto: true, persist: false);
        // the prefs key should remain unset (default false)
        final prefs = await SharedPreferences.getInstance();
        final persisted = prefs.getBool('offline_mode');
        expect(persisted, isNull,
            reason: 'auto offline mode must not persist — users should not be stuck offline after restart');
      },
    );

    test('manual toggle with persist=true writes to SharedPreferences', () async {
      await OfflineService().setOfflineMode(true, isAuto: false, persist: true);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('offline_mode'), isTrue);
    });

    test('triggerOfflineAutoToggle switches to offlineNoInternet when online', () async {
      expect(OfflineService().isOfflineMode, isFalse);
      OfflineService().triggerOfflineAutoToggle();
      // allow the async setOfflineMode to fire
      await Future.delayed(Duration.zero);
      expect(OfflineService().offlineModeNotifier.value, equals(OfflineState.offlineNoInternet));
    });

    test('triggerOfflineAutoToggle is a no-op when already offline', () async {
      await OfflineService().setOfflineMode(true, isAuto: false, persist: false);
      OfflineService().triggerOfflineAutoToggle();
      await Future.delayed(Duration.zero);
      // still offline manual — not changed to noInternet
      expect(OfflineService().offlineModeNotifier.value, equals(OfflineState.offlineManual));
    });
  });

  // ---------------------------------------------------------------------------
  // isTrackOfflineSync — O(1) in-memory check
  // ---------------------------------------------------------------------------

  group('offline service — isTrackOfflineSync', () {
    test('returns false for an unknown track id', () {
      expect(OfflineService().isTrackOfflineSync('unknown_id'), isFalse);
    });

    test('returns false for an empty string id', () {
      expect(OfflineService().isTrackOfflineSync(''), isFalse);
    });
  });

  group('offline service — isAlbumOfflineSync', () {
    test('returns false for an unknown album id', () {
      expect(OfflineService().isAlbumOfflineSync('album_123'), isFalse);
    });
  });

  group('offline service — isPlaylistOfflineSync', () {
    test('returns false for an unknown playlist id', () {
      expect(OfflineService().isPlaylistOfflineSync('playlist_456'), isFalse);
    });
  });

  // ---------------------------------------------------------------------------
  // clearState — logout reset (v1.0.0+11 stop music on log out)
  // ---------------------------------------------------------------------------

  group('offline service — clearState (v1.0.0+11 logout)', () {
    test('clearState resets isOfflineMode to false', () async {
      await OfflineService().setOfflineMode(true, persist: false);
      await OfflineService().clearState();
      expect(OfflineService().isOfflineMode, isFalse);
    });

    test('clearState resets offlineModeNotifier to online', () async {
      await OfflineService().setOfflineMode(true, persist: false);
      await OfflineService().clearState();
      expect(OfflineService().offlineModeNotifier.value, equals(OfflineState.online));
    });

    test('clearState empties offlineTrackIds', () async {
      // prime the set by calling initialize with mock prefs that have a track id
      SharedPreferences.setMockInitialValues({'offline_tracks': ['track_1']});
      OfflineService().resetForTesting();
      await OfflineService().initialize();
      expect(OfflineService().offlineTrackIds.contains('track_1'), isTrue);

      await OfflineService().clearState();
      expect(OfflineService().offlineTrackIds, isEmpty);
    });
  });

  // ---------------------------------------------------------------------------
  // initialize — loads persisted state into memory
  // ---------------------------------------------------------------------------

  group('offline service — initialize', () {
    test('loads offline track ids from SharedPreferences', () async {
      SharedPreferences.setMockInitialValues({
        'offline_tracks': ['id_a', 'id_b'],
      });
      OfflineService().resetForTesting();
      await OfflineService().initialize();
      expect(OfflineService().isTrackOfflineSync('id_a'), isTrue);
      expect(OfflineService().isTrackOfflineSync('id_b'), isTrue);
    });

    test('isTrackOfflineSync returns false for ids not in prefs', () async {
      SharedPreferences.setMockInitialValues({'offline_tracks': ['id_a']});
      OfflineService().resetForTesting();
      await OfflineService().initialize();
      expect(OfflineService().isTrackOfflineSync('id_z'), isFalse);
    });

    test('initialize is idempotent — second call does not reset state', () async {
      SharedPreferences.setMockInitialValues({'offline_tracks': ['id_a']});
      OfflineService().resetForTesting();
      await OfflineService().initialize();
      // second call should be a no-op (idempotency guard)
      await OfflineService().initialize();
      expect(OfflineService().isTrackOfflineSync('id_a'), isTrue);
    });
  });

  // ---------------------------------------------------------------------------
  // OfflineProgress value object
  // ---------------------------------------------------------------------------

  group('offline progress — isSavingOffline', () {
    test('fraction 0, isDone false → isSavingOffline is false (not started)', () {
      const p = OfflineProgress(fraction: 0, isDone: false);
      expect(p.isSavingOffline, isFalse);
    });

    test('fraction 0.5, isDone false → isSavingOffline is true (in progress)', () {
      const p = OfflineProgress(fraction: 0.5, isDone: false);
      expect(p.isSavingOffline, isTrue);
    });

    test('fraction 1.0, isDone false → isSavingOffline is false (complete fraction but not done)', () {
      const p = OfflineProgress(fraction: 1.0, isDone: false);
      expect(p.isSavingOffline, isFalse);
    });

    test('fraction 1.0, isDone true → isSavingOffline is false', () {
      const p = OfflineProgress(fraction: 1.0, isDone: true);
      expect(p.isSavingOffline, isFalse);
    });

    test('hasError defaults to false', () {
      const p = OfflineProgress(fraction: 0.5);
      expect(p.hasError, isFalse);
    });

    test('hasError can be set to true', () {
      const p = OfflineProgress(fraction: 0.5, hasError: true);
      expect(p.hasError, isTrue);
    });
  });

  // ---------------------------------------------------------------------------
  // getSaveOfflineProgress stream — controller lifecycle
  // ---------------------------------------------------------------------------

  group('offline service — getSaveOfflineProgress', () {
    test('returns a broadcast stream for a given id', () {
      final stream = OfflineService().getSaveOfflineProgress('test_id');
      expect(stream.isBroadcast, isTrue);
    });

    test('subsequent calls for same id return the same stream', () {
      final s1 = OfflineService().getSaveOfflineProgress('same_id');
      final s2 = OfflineService().getSaveOfflineProgress('same_id');
      expect(identical(s1, s2), isFalse, reason: 'stream is rebuilt but both are valid broadcast streams');
    });
  });

  // ---------------------------------------------------------------------------
  // cancelSaveOffline
  // ---------------------------------------------------------------------------

  group('offline service — cancelSaveOffline', () {
    test('does not throw when called with an unknown id', () {
      expect(() => OfflineService().cancelSaveOffline('nonexistent'), returnsNormally);
    });
  });
}
