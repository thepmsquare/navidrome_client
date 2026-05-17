import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:drift/native.dart';
import 'package:navidrome_client/domain/track.dart';
import 'package:navidrome_client/repositories/queue_repository.dart';
import 'package:navidrome_client/services/database/app_database.dart';
import 'package:navidrome_client/services/session_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AppDatabase db;
  late QueueRepository repository;
  late SessionService sessionService;

  setUp(() async {
    db = AppDatabase.testing(NativeDatabase.memory());
    repository = QueueRepository(db: db);
    sessionService = SessionService();
  });

  tearDown(() async {
    await db.close();
  });

  group('player service atomic migration test suite', () {
    test('one-time seeding migrates and validates cleanly', () async {
      SharedPreferences.setMockInitialValues({
        'last_playback_queue': '[{"id":"track_01","title":"migrated track 1","artist":"artist 1","album":"album 1","duration":"180"},{"id":"track_02","title":"migrated track 2","artist":"artist 2","album":"album 2","duration":"240"}]',
        'last_playback_index': 1,
        'queue_migration_complete': false,
      });

      final isCompleteBefore = await sessionService.isQueueMigrationComplete;
      expect(isCompleteBefore, isFalse);

      // run migration logic matching PlayerService's implementation
      final legacyQueue = await sessionService.lastQueue;
      expect(legacyQueue?.length, 2);

      final tracks = legacyQueue!.map((raw) => Track.fromJson(raw)).toList();
      await repository.replaceQueue(tracks);
      await repository.setActiveTrack(tracks[1].id);

      // verify post-migration constraints
      final migratedQueue = await repository.getQueue();
      expect(migratedQueue.length, 2);
      expect(migratedQueue[1].id, 'track_02');

      // mark complete
      await sessionService.setQueueMigrationComplete();

      final isCompleteAfter = await sessionService.isQueueMigrationComplete;
      expect(isCompleteAfter, isTrue);
    });
  });
}
