import 'package:flutter_test/flutter_test.dart';
import 'package:drift/native.dart';
import 'package:drift/drift.dart';
import 'package:navidrome_client/domain/track.dart';
import 'package:navidrome_client/services/database/app_database.dart';

void main() {
  late AppDatabase db;

  setUp(() {
    // Spawns an isolated in-memory native database for isolated testing
    db = AppDatabase.testing(NativeDatabase.memory());
  });

  tearDown(() async {
    await db.close();
  });

  group('database queue persistence tests', () {
    final track1 = Track(id: 't1', title: 'song 1', artist: 'art 1', album: 'alb 1', duration: 120);
    final track2 = Track(id: 't2', title: 'song 2', artist: 'art 2', album: 'alb 2', duration: 150);
    final track3 = Track(id: 't3', title: 'song 3', artist: 'art 3', album: 'alb 3', duration: 180);

    test('replaceQueue inserts companions and preserves ordering indices', () async {
      await db.replaceQueue([
        track1.toCompanion(0),
        track2.toCompanion(1),
        track3.toCompanion(2),
      ]);

      final queue = await db.getQueue();
      expect(queue.length, 3);
      expect(queue[0].trackId, 't1');
      expect(queue[0].sortIndex, 0);
      expect(queue[1].trackId, 't2');
      expect(queue[1].sortIndex, 1);
      expect(queue[2].trackId, 't3');
      expect(queue[2].sortIndex, 2);
    });

    test('removeFromQueue deletes row and decrements subsequent indices', () async {
      await db.replaceQueue([
        track1.toCompanion(0),
        track2.toCompanion(1),
        track3.toCompanion(2),
      ]);

      // Remove middle item (sortIndex 1)
      await db.removeFromQueue(1);

      final queue = await db.getQueue();
      expect(queue.length, 2);
      expect(queue[0].trackId, 't1');
      expect(queue[0].sortIndex, 0);
      expect(queue[1].trackId, 't3');
      expect(queue[1].sortIndex, 1); // shifted from 2 to 1!
    });

    test('reorderQueue moves items and aligns all index coordinates', () async {
      await db.replaceQueue([
        track1.toCompanion(0),
        track2.toCompanion(1),
        track3.toCompanion(2),
      ]);

      // Reorder: move index 2 (t3) to index 0 (t1)
      await db.reorderQueue(2, 0);

      final queue = await db.getQueue();
      expect(queue.length, 3);
      expect(queue[0].trackId, 't3');
      expect(queue[0].sortIndex, 0);
      expect(queue[1].trackId, 't1');
      expect(queue[1].sortIndex, 1);
      expect(queue[2].trackId, 't2');
      expect(queue[2].sortIndex, 2);
    });

    test('setActiveTrack isolates active track and clears other markers', () async {
      await db.replaceQueue([
        track1.toCompanion(0),
        track2.toCompanion(1),
      ]);

      await db.setActiveTrack('t2');

      final queue = await db.getQueue();
      expect(queue[0].isActive, isFalse);
      expect(queue[1].isActive, isTrue);
    });
  });
}
